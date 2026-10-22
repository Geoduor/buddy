# Retrieval tuning findings (took over from Mark)

**What this is:** a comparison of the live search function (v1), Mark's candidate (v2) and a new candidate (v3), run on a throwaway local Postgres 16 with our real migrations and ALL 150 rows of repo content loaded as verified.
**What this is NOT:** the human evaluation. The 20 questions in `dev_probes.tsv` were written by Claude as developer probes, and the synonym table in v3 was shaped after seeing which probes failed. Treat the result as a smoke test. The real evidence comes from teammates' questions (`docs/EVAL_QUESTION_COLLECTION.md`) run with `backend/tests/run_tests.js`.

## Findings
1. **v1 lets the word "Azure" count as evidence.** Almost every passage contains it, so `What is Azure OpenAI?` returned 4 unrelated notes. Both v2 and v3 return nothing for it.
2. **v1 misses reworded questions.** `How can I make my VMs bigger or add more of them when traffic grows?` and `Cheapest way to store old files I rarely open` returned nothing useful in v1 and v2, because learners and notes use different words. v3 adds a small synonym table (12 entries, easy to extend) and finds D1.2.1 and D2.3.2.
3. **v1 can bury the right passage.** For `Which tool tells me if Azure itself is having an outage?` v1 returned four unrelated rows (all matching "Azure"), and D3.4.2 was not among them. v3 returns D3.4.2.
4. **v2 is a security downgrade.** It is `security definer` with `search_path = public`, so it bypasses Row Level Security (it relies on its own `status = 'verified'` filter) and uses an unsafe search path. v3 keeps v1's `security invoker` and empty `search_path`. Checked locally: after setting a note back to draft, v3 no longer returns it, and the `anon` role is refused.
5. **Direct questions did not regress.** The 7 direct probes return the same top result in v1 and v3.
6. **Not fixable in SQL:** `What is the capital of France?` still returns the CapEx note, because "capital" matches "capital expenditure". Retrieval cannot tell the two meanings apart. The prompt's NOT_IN_NOTES rule and the citation check must handle it. Check this case in the full run.

## Results (rows returned; hits in brackets). Expected objective in the last column
| Probe | v1 live | v2 Mark | v3 |
|---|---|---|---|
| bigger / add more VMs | 0 rows | 0 rows | D1.2.1 first |
| outage tool | 4 unrelated | 0 rows | D3.4.2 first |
| cheapest way to store old files | D2.3.1 only | D2.3.1 only | D2.3.2 first |
| What is Azure OpenAI? (outside) | 4 unrelated | 0 rows | 0 rows |
| What is Azure Cosmos DB? (outside) | 0 rows | 0 rows | 0 rows |
| What is AWS S3? (outside) | 0 rows | 0 rows | 0 rows |
| capital of France (outside) | D1.1.6 | D1.1.6 | D1.1.6 (see 6) |

## Recommendation
Do not promote anything yet. Steps:
1. Collect the real teammate questions and fill `content/test-questions/test_questions.csv`.
2. Run `node backend/tests/run_tests.js retrieval` with v1 (live) and save the results.
3. Apply `search_knowledge_v3.sql` in the Supabase SQL editor (same name and signature, so it replaces the live one; the old definition is in `202610210100_study_buddy_support.sql` if you need to roll back), run the test again, and compare.
4. Promote v3 (copy it into `supabase/migrations/` with a new timestamp) only if it is no worse on every outside-notes question.
5. Extend the synonym table only for words real learners used, not for words we imagine.
