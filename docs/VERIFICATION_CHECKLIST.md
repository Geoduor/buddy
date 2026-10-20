# VERIFICATION CHECKLIST - how a question or note becomes `verified`

Learning Value is 25% of our score, and it is judged on accuracy. A wrong fact in Buddy is worse than a missing question.
Only `verified` content is shown to learners and used by Study Buddy.

## Who verifies what
- **The author never verifies their own work.** The database refuses it (`verified_by` must differ from `author`).
- Suggested pairs: **Jess's content is checked by Yego, and Yego's by Jess.** Geofry does a final spot check on a sample and runs the SQL to publish.
- Whoever verifies writes their own name in `verified_by`.

## The checklist (every item must be YES)
1. **Open the `source_url`.** It is a real Microsoft Learn page, not a blog or a video.
2. **The page matches the objective.** The objective in `objectives.json` (see `objective_id`) is covered by that page.
3. **The correct answer is correct according to that page.** Read it again; do not rely on memory.
4. **Exactly one option is correct.** The other three are clearly wrong once you know the concept. No "all of the above".
5. **Every "why wrong" is true.** Each one-sentence reason is accurate, not just plausible.
6. **The explanation is accurate and in our own words.** No sentences copied from Microsoft Learn.
7. **It is not a real exam question or a "braindump" question.** If you recognise it from a practice-test site, reject it.
8. **Names are current.** For example Microsoft Entra ID, not Azure Active Directory, unless the objective itself uses the old name.
9. **Simple, clear English.** A beginner can understand it. Any local scenario (a shop in Kisumu, a SACCO) does not change the Azure facts.
10. **For notes:** under about 150 words, one topic, and ends up usable by Study Buddy as a standalone passage.

If any item is NO, **do not verify.** Leave it as `draft` and put the reason in `notes`, for example `NEEDS CHECK: option C is also correct per the Learn page`. Tell the author.

## The workflow in practice
1. The author pushes a CSV on a branch and opens a Pull Request. Mark's importer loads it into Supabase as `draft`.
2. The reviewer reads the rows in the Pull Request (or the CSV), opens each `source_url`, and applies the checklist above.
3. The reviewer tells Geofry in the PR comments: "Jess's D1.1 file: rows 1 to 6 pass" or "row 4 fails because ...".
4. Geofry sends failing rows back (SQL block 3), then publishes the passing rows with the reviewer's name (SQL block 2d for a whole file, or 2 for single rows).
5. Authors fix failing rows in a new PR; the cycle repeats for those rows only.

## How to publish (Geofry or whoever runs the SQL)
Open the SQL editor and use `scripts/verify_content.sql`. It has copy-and-paste blocks to:
1. list everything waiting for review,
2. verify one item, a list of items, or a whole approved file with the reviewer's name,
3. send an item back with a reason,
4. count what is live, per group.

## Targets (from the project brief)
Minimum 6 verified questions per objective group, 66 in total for 11 groups. Stretch: 10 per group. Plus at least 1 verified note per group so Study Buddy has material.
**Content freeze: Thursday 22:00**, together with the feature freeze.
