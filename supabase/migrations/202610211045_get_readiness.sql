-- MARK: readiness score. Output columns EXACTLY as docs/API_CONTRACTS.md section 4.
-- Frontend call: supabase.rpc('get_readiness')
--
-- ASSUMPTIONS to confirm against Geofry's schema before running:
--   domains(id, title)                      -- if the column is "name", change d.title
--   objectives(id, domain_id, weight_min, weight_max)
--   questions(id, objective_id), attempts(user_id, question_id, is_correct)
-- Expected result: weights 27.5 / 37.5 / 32.5 for D1 / D2 / D3 and 100 for OVERALL.

create or replace function public.get_readiness()
returns table (
  domain_id    text,
  domain_title text,
  weight       numeric,
  attempted    integer,
  correct      integer,
  accuracy     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select 5 as min_attempts                       -- starting value from the contract
  ),
  dom as (
    select d.id::text as domain_id,
           d.title::text as domain_title,
           max((o.weight_min + o.weight_max) / 2.0)::numeric as weight   -- midpoint of official range
    from domains d
    join objectives o on o.domain_id = d.id
    group by d.id, d.title
  ),
  mine as (                                          -- only the calling learner's answers
    select o.domain_id::text as domain_id,
           count(*)::int as attempted,
           (count(*) filter (where a.is_correct))::int as correct
    from attempts a
    join questions q on q.id = a.question_id
    join objectives o on o.id = q.objective_id
    where a.user_id = auth.uid()
    group by o.domain_id
  ),
  per_domain as (
    select dom.domain_id,
           dom.domain_title,
           dom.weight,
           coalesce(mine.attempted, 0) as attempted,
           coalesce(mine.correct, 0)   as correct,
           case when coalesce(mine.attempted, 0) >= (select min_attempts from params)
                then round(mine.correct::numeric / mine.attempted, 4)
           end as accuracy                           -- null = "Not enough data yet"
    from dom
    left join mine on mine.domain_id = dom.domain_id
  ),
  overall as (
    select 'OVERALL'::text, 'Overall'::text, 100::numeric,
           coalesce(sum(attempted), 0)::int, coalesce(sum(correct), 0)::int,
           -- weighted average, normalised by the weights; only when EVERY domain has enough data
           case when bool_and(accuracy is not null)
                then round(sum(weight * accuracy) / sum(weight), 4)
           end
    from per_domain
  )
  select * from (
    select * from per_domain
    union all
    select * from overall
  ) t
  order by (t.domain_id = 'OVERALL'), t.domain_id;
$$;

revoke all on function public.get_readiness() from public, anon;
grant execute on function public.get_readiness() to authenticated;  -- anonymous sign-in users are 'authenticated'
