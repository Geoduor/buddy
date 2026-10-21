# Candidates (NOT migrations: never run automatically)
Files here are proposals waiting for evidence. Nothing in this folder is run by the migration order.

- `search_knowledge_v2.sql` (Mark): retrieval tuning. Before it is promoted to `supabase/migrations/` with a new timestamp:
  1. run `node backend/tests/run_tests.js retrieval` on real verified content with the current function and save the results;
  2. run the preflight queries in the file header (types must match);
  3. apply v2, run the same test, and compare. Promote only if it is no worse on the outside-notes questions (still returns nothing for them).
  Note: it changes the text-search config from `simple` to `english`, so stemmed words will match differently.
