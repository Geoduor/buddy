-- Buddy: readiness score. get_readiness() returns the signed-in learner's readiness per exam domain + overall.
-- Owner: Geofry. Run once in the Supabase SQL editor AFTER 202610210100_study_buddy_support.sql.
-- Never edit this file after it is merged; add a new timestamped migration instead.
--
-- Rules (these are also written in docs/API_CONTRACTS.md, section 4):
--   * Only the learner's OWN attempts are used.
--   * For each question, only the LATEST attempt counts. This measures what the learner knows now,
--     and stops anyone inflating a score by retrying one easy question.
--   * A domain shows an accuracy only after the learner has answered at least `readiness_min_attempts`
--     different questions in it (default 5; change it in app_settings). Below that, accuracy is NULL.
--   * The overall accuracy weights each domain by the MIDPOINT of its official range (27.5 / 37.5 / 32.5),
--     normalised so the weights add up to 100%. It is NULL until ALL three domains have enough data,
--     so a learner is never shown a score built from a partial picture.
--   * It is an ESTIMATE. Microsoft's pass mark (700) is a scaled score, not a percentage.

insert into public.app_settings (key, value) values ('readiness_min_attempts', 5)
on conflict (key) do nothing;

create or replace function public.get_readiness()
returns table (
  domain_id    text,       -- 'D1', 'D2', 'D3' or 'OVERALL'
  domain_title text,
  weight       numeric,    -- official weight midpoint (overall row: 100)
  attempted    integer,    -- different questions answered
  correct      integer,    -- of those, answered correctly on the latest attempt
  accuracy     numeric     -- 0 to 1, or NULL when there is not enough data yet
)
language plpgsql
stable
security definer           -- needs to read app_settings; it only ever returns the caller's own aggregates
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_min integer;
begin
  if v_uid is null then
    return;                -- not signed in: no rows
  end if;

  select s.value into v_min from public.app_settings s where s.key = 'readiness_min_attempts';
  v_min := coalesce(v_min, 5);

  return query
  with latest as (
    select distinct on (a.question_id)
           a.question_id, a.is_correct, o.domain_id
      from public.attempts a
      join public.questions q on q.id = a.question_id
      join public.objectives o on o.id = q.objective_id
     where a.user_id = v_uid
     order by a.question_id, a.created_at desc, a.id desc
  ),
  per as (
    select d.id as domain_id,
           d.title as domain_title,
           ((d.weight_min + d.weight_max) / 2.0)::numeric as mid,
           count(l.question_id)::integer as attempted,
           (count(*) filter (where l.is_correct))::integer as correct
      from public.domains d
      left join latest l on l.domain_id = d.id
     group by d.id, d.title, d.weight_min, d.weight_max
  ),
  tot as (
    select sum(p.attempted)::integer as attempted,
           sum(p.correct)::integer as correct,
           case when bool_and(p.attempted >= v_min)
                then round(sum(p.correct::numeric / nullif(p.attempted, 0) * p.mid) / sum(p.mid), 4)
           end as overall
      from per p
  )
  select r.domain_id, r.domain_title, r.weight, r.attempted, r.correct, r.accuracy
    from (
      select p.domain_id, p.domain_title, p.mid as weight, p.attempted, p.correct,
             case when p.attempted >= v_min then round(p.correct::numeric / p.attempted, 4) end as accuracy
        from per p
      union all
      select 'OVERALL'::text, 'Overall'::text, 100::numeric, t.attempted, t.correct, t.overall
        from tot t
    ) r
   order by (r.domain_id = 'OVERALL'), r.domain_id;
end;
$$;

revoke all on function public.get_readiness() from public, anon;
grant execute on function public.get_readiness() to authenticated;
