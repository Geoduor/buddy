-- Buddy: support for Study Buddy (retrieval, AI usage caps) and the second-reviewer rule.
-- Owner: Geofry (reference implementation of search_knowledge is handed to Mark to tune).
-- Run once in the Supabase SQL editor AFTER 202610200900_initial_schema.sql.
-- Never edit this file after it is merged; add a new timestamped migration instead.

-- ---------------------------------------------------------------------------
-- 1. Second-reviewer rule: nothing goes live unless someone OTHER than the author verified it
-- ---------------------------------------------------------------------------
alter table public.questions add column verified_by text, add column verified_at timestamptz;
alter table public.notes     add column verified_by text, add column verified_at timestamptz, add column notes text;  -- notes.notes = reviewer comments, e.g. 'NEEDS CHECK: ...'

alter table public.questions add constraint questions_verified_needs_reviewer check (
  status <> 'verified'
  or (nullif(btrim(verified_by), '') is not null
      and lower(btrim(verified_by)) is distinct from lower(btrim(coalesce(author, ''))))
);
alter table public.notes add constraint notes_verified_needs_reviewer check (
  status <> 'verified'
  or (nullif(btrim(verified_by), '') is not null
      and lower(btrim(verified_by)) is distinct from lower(btrim(coalesce(author, ''))))
);

-- ---------------------------------------------------------------------------
-- 2. Retrieval: search_knowledge(question text) -> best matching VERIFIED notes/explanations
--    Returns NOTHING when there is no good match (an empty result is the correct answer).
--    security invoker => Row Level Security applies, so drafts can never be returned.
-- ---------------------------------------------------------------------------
create or replace function public.search_knowledge(query_text text, match_count integer default 4)
returns table (
  source_type    text,      -- 'note' or 'question'
  source_id      uuid,
  objective_id   text,
  objective_text text,
  title          text,      -- the question stem for 'question' rows, '' for notes
  content        text,      -- the note body, or the question's explanation
  source_url     text,      -- the Microsoft Learn page that was checked
  hits           integer,   -- how many distinct search words matched
  score          real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lexemes  text[];
  v_n        integer;
  v_min_hits integer;
  v_tsq      tsquery;
begin
  -- Reduce the learner's question to its meaningful, stemmed words (stop words disappear here)
  select coalesce(array_agg(l), '{}')
    into v_lexemes
    from unnest(tsvector_to_array(to_tsvector('english', left(coalesce(query_text, ''), 500)))) as l
   where l ~ '^[[:alnum:]_-]+$';

  v_n := coalesce(array_length(v_lexemes, 1), 0);
  if v_n = 0 then
    return;   -- nothing searchable (for example "the of"): return no rows
  end if;

  -- A passage must match at least half of the search words. This is what stops weak matches.
  v_min_hits := greatest(1, ceil(v_n * 0.5)::integer);

  select to_tsquery('simple', string_agg('''' || l || '''', ' | '))
    into v_tsq
    from unnest(v_lexemes) as l;

  return query
  with cand as (
    select 'note'::text as source_type, n.id as source_id, n.objective_id, ''::text as title,
           n.body as content, n.source_url, n.fts as f
      from public.notes n
     where n.status = 'verified'
    union all
    select 'question'::text, q.id, q.objective_id, q.stem,
           q.explanation, q.source_url, q.fts
      from public.questions q
     where q.status = 'verified'
  ),
  scored as (
    select c.*,
           (select count(*) from unnest(v_lexemes) as l
             where c.f @@ to_tsquery('simple', '''' || l || ''''))::integer as hits,
           ts_rank_cd(c.f, v_tsq) as score
      from cand c
     where c.f @@ v_tsq
  )
  select s.source_type, s.source_id, s.objective_id, o.text, s.title, s.content, s.source_url, s.hits, s.score
    from scored s
    join public.objectives o on o.id = s.objective_id
   where s.hits >= v_min_hits
   order by s.hits desc, s.score desc, s.source_type
   limit least(greatest(coalesce(match_count, 4), 1), 8);
end;
$$;

revoke all on function public.search_knowledge(text, integer) from public, anon;
grant execute on function public.search_knowledge(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. AI usage caps: protects the free-tier quota and the demo.
--    Caps live in app_settings (change them in the SQL editor, never from the browser).
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key   text primary key,
  value integer not null check (value >= 0)
);
insert into public.app_settings (key, value) values
  ('ai_user_daily_cap', 20),      -- AI answers per learner per rolling 24 hours
  ('ai_global_daily_cap', 200);   -- AI answers for everyone per rolling 24 hours

create table public.ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_time_idx on public.ai_usage (created_at desc);

-- RLS on with NO policies and no grants: learners cannot read or write these tables directly.
alter table public.app_settings enable row level security;
alter table public.ai_usage     enable row level security;
revoke all on public.app_settings from anon, authenticated;
revoke all on public.ai_usage     from anon, authenticated;

-- The only way in: this function. It takes NO parameters, so a caller cannot choose their own cap.
create or replace function public.reserve_ai_call()
returns text      -- 'ok' | 'user_cap' | 'global_cap' | 'unauthenticated'
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := auth.uid();
  v_user_cap      integer;
  v_global_cap    integer;
  v_user_count    integer;
  v_global_count  integer;
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  select s.value into v_user_cap   from public.app_settings s where s.key = 'ai_user_daily_cap';
  select s.value into v_global_cap from public.app_settings s where s.key = 'ai_global_daily_cap';
  v_user_cap   := coalesce(v_user_cap, 20);
  v_global_cap := coalesce(v_global_cap, 200);

  -- one reservation at a time, so two simultaneous requests cannot both slip under the cap
  perform pg_advisory_xact_lock(hashtext('buddy_ai_usage'));

  delete from public.ai_usage where created_at < now() - interval '7 days';

  select count(*) into v_global_count from public.ai_usage where created_at > now() - interval '24 hours';
  if v_global_count >= v_global_cap then
    return 'global_cap';
  end if;

  select count(*) into v_user_count from public.ai_usage
   where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_user_count >= v_user_cap then
    return 'user_cap';
  end if;

  insert into public.ai_usage (user_id) values (v_uid);
  return 'ok';
end;
$$;

revoke all on function public.reserve_ai_call() from public, anon;
grant execute on function public.reserve_ai_call() to authenticated;
