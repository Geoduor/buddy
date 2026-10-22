# Study Buddy evaluation: collecting the test questions

Owner and runner: Geofry (taken over from Mark). File to fill: `content/test-questions/test_questions.csv` (columns `id,asked_by,question,expected,notes`).

The evaluation is only honest if the questions come from real people. **Do not let anyone (or any AI) invent a teammate's question.**

## Step 1. Send this to each teammate
> Please write 3 questions you would genuinely ask an AZ-900 study helper, exactly the way you would type them. Some should be about Azure ideas you find confusing, in your own words. Include one question about something you think we might NOT have covered. Reply with your name and your three questions. Do not look at our notes first.

Ask all five of you. That gives about 15 questions. Add 1 or 2 "trick" questions written by a teammate, such as one that tries to make Buddy ignore its rules, or asks what is on the real exam.

## Step 2. Fill the CSV
- `id`: q01, q02, ...
- `asked_by`: the real person who wrote it.
- `question`: their exact words.
- `expected`: `in_notes` if a VERIFIED note covers it (use the table below), otherwise `outside_notes`.
- `notes`: `direct`, `reworded`, `out_of_notes` or `trick` (see `prompts/STUDY_BUDDY_EVAL.md`).

Quote any question that contains a comma. Do not change anyone's wording to make it easier for Buddy.

## Step 3. Run it
Geofry runs `backend/tests/run_tests.js` against the live site once the content is verified, and records the results in the table at the bottom of `prompts/STUDY_BUDDY_EVAL.md`. Keep the failures. They are findings, not embarrassments.

## What the repo covers (to classify `in_notes` vs `outside_notes`)
A note counts only once it is **verified** in the database. Check with `select objective_id from public.notes where status='verified';`.

| Group | Topic | Questions | Notes cover these objectives |
|---|---|---|---|
| D1.1 | Describe cloud computing | 7 | D1.1.1, D1.1.2, D1.1.3, D1.1.4, D1.1.5, D1.1.6, D1.1.7 |
| D1.2 | Describe the benefits of using cloud services | 8 | D1.2.1, D1.2.2, D1.2.3, D1.2.4 |
| D1.3 | Describe cloud service types | 7 | D1.3.1, D1.3.2, D1.3.3, D1.3.4 |
| D2.1 | Describe the core architectural components of Azure | 11 | D2.1.1, D2.1.2, D2.1.3, D2.1.4, D2.1.5, D2.1.6, D2.1.7 |
| D2.2 | Describe Azure compute and networking services | 14 | D2.2.1, D2.2.2, D2.2.3, D2.2.4, D2.2.5, D2.2.6 |
| D2.3 | Describe Azure storage services | 6 | D2.3.1, D2.3.2, D2.3.3, D2.3.4, D2.3.5, D2.3.6 |
| D2.4 | Describe Azure identity, access, and security | 11 | D2.4.1, D2.4.2, D2.4.3, D2.4.4, D2.4.5, D2.4.6, D2.4.7, D2.4.8 |
| D3.1 | Describe cost management in Azure | 6 | D3.1.1, D3.1.2, D3.1.3, D3.1.4 |
| D3.2 | Describe features and tools in Azure for governance and compliance | 6 | D3.2.1, D3.2.2, D3.2.3 |
| D3.3 | Describe features and tools for managing and deploying Azure resources | 7 | D3.3.1, D3.3.2, D3.3.3, D3.3.4, D3.3.5 |
| D3.4 | Describe monitoring tools in Azure | 8 | D3.4.1, D3.4.2, D3.4.3 |

Topics with no note are outside the notes and Buddy should refuse them. Examples of things we do NOT cover because they are not on the objective list: pricing figures, exam dumps, other cloud providers.
