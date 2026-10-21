-- MARK: retrieval tuning (v2 CANDIDATE). Do not merge until you have run
-- `node run_tests.js retrieval` on real verified content and compared before/after.
--
-- RULES (API_CONTRACTS section 6): same name, same arguments, same output columns as Geofry's
-- reference in 202610210100_study_buddy_support.sql. Return NOTHING rather than a weak match.
--
-- PREFLIGHT - run in the Supabase SQL editor and make the RETURNS TABLE types below identical:
--   select pg_get_function_result('public.search_knowledge(text,integer)'::regprocedure);
--   select pg_get_functiondef('public.search_knowledge(text,integer)'::regprocedure);
-- (If a type differs, "create or replace" fails with "cannot change return type" - that is the safety net.)
-- Also confirm: notes(id, objective_id, body, source_url, status), questions(id, objective_id, stem,
-- explanation, source_url, status), objectives(id, text).

create or replace function public.search_knowledge(query_text text, match_count int default 4)
returns table (
  source_type    text,
  source_id      uuid,      -- <- change to bigint/int if your tables use numeric ids
  objective_id   text,
  objective_text text,
  title          text,
  content        text,
  source_url     text,
  hits           int,
  score          real
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  all_words  text[];
  words      text[];
  noise      text[] := array['azure', 'microsoft'];   -- TUNABLE: words so common they prove nothing
  n          int;
  need       int;
  or_query   tsquery;
  lim        int := least(greatest(coalesce(match_count, 4), 1), 8);   -- contract: up to 8 rows
begin
  -- 1) meaningful words: lowercase alphanumerics, 2+ chars, not English stop words
  select array_agg(distinct w) into all_words
  from regexp_split_to_table(lower(coalesce(query_text, '')), '[^a-z0-9]+') as w
  where length(w) >= 2 and to_tsvector('english', w) <> ''::tsvector;

  if all_words is null then return; end if;

  -- 2) drop noise words, unless that would leave nothing
  select coalesce(array_agg(w), all_words) into words
  from unnest(all_words) w where w <> all(noise);
  if words is null or array_length(words, 1) is null then words := all_words; end if;

  n    := array_length(words, 1);
  need := greatest(1, ceil(n / 2.0)::int);            -- must match at least half (TUNABLE)
  or_query := to_tsquery('english', array_to_string(words, ' | '));

  return query
  with corpus as (
    select 'note'::text as source_type, nt.id as source_id, nt.objective_id,
           ''::text as title, nt.body as content, nt.source_url
    from notes nt
    where nt.status = 'verified'
    union all
    select 'question'::text, q.id, q.objective_id, q.stem, q.explanation, q.source_url
    from questions q
    where q.status = 'verified' and q.explanation is not null
  ),
  scored as (
    select c.*,
           to_tsvector('english', c.title || ' ' || c.content) as doc,
           (select count(*) from unnest(words) w
             where to_tsvector('english', c.title || ' ' || c.content) @@ plainto_tsquery('english', w))::int as hits
    from corpus c
  )
  select s.source_type, s.source_id, s.objective_id, o.text as objective_text,
         s.title, s.content, s.source_url, s.hits,
         ((s.hits::real / n) + ts_rank(s.doc, or_query) / 10)::real as score
  from scored s
  left join objectives o on o.id = s.objective_id
  where s.hits >= need                                 -- "nothing rather than a weak match"
  order by s.hits desc, score desc, (s.source_type = 'note') desc
  limit lim;
end;
$$;
