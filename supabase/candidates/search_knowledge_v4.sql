-- search_knowledge v4 CANDIDATE (= v3 plus a list of conversational filler words that no longer count).
-- Why: long, chatty questions ("differentiating between terms as a beginner, such as ...") were failing the
-- half-of-the-words rule because the filler counted as words that no passage could match.
-- Older header follows (v3):
-- search_knowledge v3 CANDIDATE (Geofry took over retrieval tuning from Mark; written with Claude).
-- Same name, arguments and output columns as the live function, so "create or replace" is safe.
-- NOT a migration. Read supabase/candidates/README.md and RETRIEVAL_FINDINGS.md first.
--
-- What changed from the live v1 (202610210100_study_buddy_support.sql):
--   1. "Noise" words (azur, microsoft, servic, tool) no longer count as evidence. In v1 the word
--      "Azure" matched almost every passage, so an out-of-scope question like "What is Azure OpenAI?"
--      returned four unrelated notes.
--   2. A short synonym table maps everyday learner words to the words our notes use
--      (bigger -> scale, cheapest -> cost, ...). Each question word is a SLOT; a slot is matched when the
--      word or any of its synonyms is in the passage. A passage still has to match at least half the slots.
--   3. Kept from v1: security INVOKER with an empty search_path (Row Level Security applies, so drafts can
--      never be returned) and the "return nothing rather than a weak match" rule.
-- Mark's v2 is NOT used as the base because it is SECURITY DEFINER with search_path = public, which
-- bypasses Row Level Security and is a known risky pattern. See RETRIEVAL_FINDINGS.md.

create or replace function public.search_knowledge(query_text text, match_count integer default 4)
returns table (
  source_type    text,
  source_id      uuid,
  objective_id   text,
  objective_text text,
  title          text,
  content        text,
  source_url     text,
  hits           integer,
  score          real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lexemes text[];
  v_slots   text[] := '{}';   -- each slot is a tsquery fragment such as 'scale' | 'vertic'
  v_noise   text[] := array['azur', 'microsoft', 'servic', 'tool',
                         -- v4: conversational filler that says nothing about the topic (stemmed forms)
                         'differenti', 'differ', 'differenc', 'term', 'beginn', 'step', 'help',
                         'explain', 'tell', 'mean', 'know', 'understand'];   -- TUNABLE
  -- TUNABLE: everyday word (as stemmed by the english config) -> words our notes use instead
  v_syn     jsonb := '{
    "bigger":  ["scale", "scalabl"],
    "larger":  ["scale", "scalabl"],
    "grow":    ["scale", "scalabl"],
    "growth":  ["scale", "scalabl"],
    "cheap":   ["cost", "spend"],
    "cheaper": ["cost", "spend"],
    "cheapest":["cost", "spend"],
    "expens":  ["cost", "spend"],
    "save":    ["cost", "spend"],
    "broken":  ["outag", "health"],
    "delet":   ["lock"],
    "old":     ["archiv"]
  }'::jsonb;
  l         text;
  alt       text;
  v_n       integer;
  v_min     integer;
  v_all     tsquery;
begin
  select coalesce(array_agg(x), '{}')
    into v_lexemes
    from unnest(tsvector_to_array(to_tsvector('english', left(coalesce(query_text, ''), 500)))) as x
   where x ~ '^[[:alnum:]_-]+$' and x <> all (v_noise);

  v_n := coalesce(array_length(v_lexemes, 1), 0);
  if v_n = 0 then return; end if;

  foreach l in array v_lexemes loop
    alt := '''' || l || '''';
    if v_syn ? l then
      alt := alt || ' | ' || (select string_agg('''' || s || '''', ' | ') from jsonb_array_elements_text(v_syn -> l) as s);
    end if;
    v_slots := v_slots || alt;
  end loop;

  v_min := greatest(1, ceil(v_n * 0.5)::integer);
  v_all := to_tsquery('simple', array_to_string(v_slots, ' | '));

  return query
  with cand as (
    select 'note'::text as source_type, n.id as source_id, n.objective_id, ''::text as title,
           n.body as content, n.source_url, n.fts as f
      from public.notes n
     where n.status = 'verified'
    union all
    select 'question'::text, q.id, q.objective_id, q.stem, q.explanation, q.source_url, q.fts
      from public.questions q
     where q.status = 'verified'
  ),
  scored as (
    select c.*,
           (select count(*) from unnest(v_slots) as sl
             where c.f @@ to_tsquery('simple', sl))::integer as hits,
           ts_rank_cd(c.f, v_all) as score
      from cand c
     where c.f @@ v_all
  )
  select s.source_type, s.source_id, s.objective_id, o.text, s.title, s.content, s.source_url, s.hits, s.score
    from scored s
    join public.objectives o on o.id = s.objective_id
   where s.hits >= v_min
   order by s.hits desc, s.score desc, s.source_type
   limit least(greatest(coalesce(match_count, 4), 1), 8);
end;
$$;

revoke all on function public.search_knowledge(text, integer) from public, anon;
grant execute on function public.search_knowledge(text, integer) to authenticated;
