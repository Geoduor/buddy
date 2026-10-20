-- Buddy: TEMPORARY test note so the smoke test can prove the whole AI chain
-- before any real content has been verified.
-- It is a labelled test note, NOT Azure content. Run block 1, run the smoke test, then run block 2 IMMEDIATELY.
-- Never leave it in the database: it would be visible to real learners.
-- Run each block separately in the Supabase SQL editor.

-- 1. ADD the test note
insert into public.notes (objective_id, body, source_url, author, status, verified_by, verified_at)
values (
  'D1.1.1',
  'SMOKE TEST NOTE (temporary): The Buddy smoke test phrase is "blue matatu". If someone asks for the Buddy smoke test phrase, the answer is blue matatu.',
  'https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900',
  'smoke-test',
  'verified',
  'geofry',
  now()
);

-- 2. REMOVE it (run this as soon as the smoke test is done)
delete from public.notes where author = 'smoke-test';

-- 3. CHECK nothing is left behind (expect 0)
select count(*) as leftover_test_notes from public.notes where author = 'smoke-test';
