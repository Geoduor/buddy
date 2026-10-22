-- Buddy: read-only database health check. Paste the WHOLE thing into the Supabase SQL editor and Run.
-- It changes nothing. Every row should say OK. Rows that say CHECK or FIX need a look (see the detail column).
with
t as (select unnest(array['domains','objectives','questions','notes','attempts','app_settings','ai_usage']) as name),
grp as (select g.group_id as id from public.objectives g group by g.group_id),
qv as (select left(objective_id, length(objective_id) - position('.' in reverse(objective_id))) as grp, count(*) as n
         from public.questions where status = 'verified' group by 1),
nv as (select left(objective_id, length(objective_id) - position('.' in reverse(objective_id))) as grp, count(*) as n
         from public.notes where status = 'verified' group by 1),
fn as (select p.proname, p.prosecdef, p.prosrc, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('search_knowledge', 'get_readiness', 'reserve_ai_call'))
select * from (
  select 1 as ord, 'Row Level Security on all 7 tables' as check_name,
         case when (select count(*) from pg_tables where schemaname = 'public' and rowsecurity and tablename in (select name from t)) = 7 then 'OK' else 'FIX' end as result,
         (select count(*) from pg_tables where schemaname = 'public' and rowsecurity and tablename in (select name from t))::text || ' of 7 have RLS' as detail
  union all
  select 2, 'Browser cannot read app_settings or ai_usage',
         case when not has_table_privilege('authenticated', 'public.app_settings', 'select') and not has_table_privilege('anon', 'public.app_settings', 'select')
                   and not has_table_privilege('authenticated', 'public.ai_usage', 'select') then 'OK' else 'FIX' end, 'caps and usage must stay private'
  union all
  select 3, 'anon cannot run search_knowledge, get_readiness, reserve_ai_call',
         case when not has_function_privilege('anon', 'public.search_knowledge(text,integer)', 'execute')
                   and not has_function_privilege('anon', 'public.get_readiness()', 'execute')
                   and not has_function_privilege('anon', 'public.reserve_ai_call()', 'execute') then 'OK' else 'FIX' end, ''
  union all
  select 4, 'signed-in learners can run those three functions',
         case when has_function_privilege('authenticated', 'public.search_knowledge(text,integer)', 'execute')
                   and has_function_privilege('authenticated', 'public.get_readiness()', 'execute')
                   and has_function_privilege('authenticated', 'public.reserve_ai_call()', 'execute') then 'OK' else 'FIX' end, ''
  union all
  select 5, 'search_knowledge keeps Row Level Security (security invoker)',
         case when (select not prosecdef from fn where proname = 'search_knowledge') then 'OK' else 'FIX' end,
         case when (select prosrc like '%v_noise%' from fn where proname = 'search_knowledge') then 'v3 candidate is live' else 'v1 (original) is live' end
  union all
  select 6, 'app_settings has the three caps',
         case when (select count(*) from public.app_settings where key in ('ai_user_daily_cap', 'ai_global_daily_cap', 'readiness_min_attempts')) = 3 then 'OK' else 'FIX' end,
         (select string_agg(key || '=' || value::text, ', ' order by key) from public.app_settings)
  union all
  select 7, 'domains and objectives loaded (expect 3 and 57)',
         case when (select count(*) from public.domains) = 3 and (select count(*) from public.objectives) = 57 then 'OK' else 'FIX' end,
         (select count(*) from public.domains)::text || ' domains, ' || (select count(*) from public.objectives)::text || ' objectives'
  union all
  select 8, 'every one of the 11 groups has at least 6 verified questions',
         case when (select count(*) from grp where coalesce((select n from qv where qv.grp = grp.id), 0) >= 6) = 11 then 'OK' else 'FIX' end,
         coalesce((select string_agg(id || '=' || coalesce((select n from qv where qv.grp = grp.id), 0), ', ' order by id) from grp where coalesce((select n from qv where qv.grp = grp.id), 0) < 6), 'all groups have 6 or more')
  union all
  select 9, 'every group has at least 1 verified note (Ask Buddy needs these)',
         case when (select count(*) from grp where coalesce((select n from nv where nv.grp = grp.id), 0) >= 1) = 11 then 'OK' else 'FIX' end,
         coalesce((select string_agg(id, ', ' order by id) from grp where coalesce((select n from nv where nv.grp = grp.id), 0) = 0), 'none missing')
  union all
  select 10, 'drafts still waiting for review',
         case when (select count(*) from public.questions where status = 'draft') + (select count(*) from public.notes where status = 'draft') = 0 then 'OK' else 'CHECK' end,
         (select count(*) from public.questions where status = 'draft')::text || ' questions, ' || (select count(*) from public.notes where status = 'draft')::text || ' notes'
  union all
  select 11, 'verified totals',
         'INFO', (select count(*) from public.questions where status = 'verified')::text || ' questions, ' || (select count(*) from public.notes where status = 'verified')::text || ' notes'
  union all
  select 12, 'verified rows missing a source link or explanation (expect 0)',
         case when (select count(*) from public.questions where status = 'verified' and (btrim(source_url) = '' or btrim(explanation) = ''))
                 + (select count(*) from public.notes where status = 'verified' and btrim(source_url) = '') = 0 then 'OK' else 'FIX' end, ''
  union all
  select 13, 'verified rows whose verifier is also the author (expect 0)',
         case when (select count(*) from public.questions where status = 'verified' and lower(btrim(verified_by)) = lower(btrim(coalesce(author, ''))))
                 + (select count(*) from public.notes where status = 'verified' and lower(btrim(verified_by)) = lower(btrim(coalesce(author, '')))) = 0 then 'OK' else 'FIX' end, ''
  union all
  select 14, 'real learner attempts saved so far',
         'INFO', (select count(*) from public.attempts)::text || ' attempts'
  union all
  select 15, 'AI answers in the last 24 hours (the caps are per rolling 24 hours)',
         'INFO', (select count(*) from public.ai_usage where created_at > now() - interval '24 hours')::text || ' used, global cap ' || coalesce((select value::text from public.app_settings where key = 'ai_global_daily_cap'), '?')
) x order by ord;
