# Submission checklist

Target submission: **Fri 23 Oct 2026, 15:00 EAT**. Hard deadline: **18:00 EAT**. Tick items only when they are really done; add the real link or number next to each one.

## Must have (the submission is incomplete without these)
- [ ] Public GitHub repository, README readable, no secrets (`git ls-files | grep .env` returns nothing)
- [ ] Live demo works on a phone: https://buddy-six-khaki.vercel.app
- [ ] Demo video linked in the README (file: `docs/demo/buddy-demo.mp4`; add the public share link here: `____`)
- [ ] Pitch deck linked in the README (link: `____`)
- [ ] "Unofficial, not affiliated with or endorsed by Microsoft" visible in the app footer and README
- [ ] `main` is green: every check in `.github/workflows/ci.yml` passes
- [ ] Database health check (`scripts/db_health_check.sql`): every row OK or an explained INFO/CHECK
- [ ] Hackathon submission form filled in with the real links (the brief shows the form link as a placeholder; get the real one)

## Quality evidence (judges can see these)
- [ ] Retrieval test run saved in `backend/tests/results/`
- [ ] Full Study Buddy test run once (`node run_tests.js full --preview=<url> --told-geofry`, at most 20 questions); results, including failures, in the table in `prompts/STUDY_BUDDY_EVAL.md`
- [ ] README "Known limits" line for evaluation results updated with the real outcome
- [ ] At least 3 outside-the-notes questions and 1 or 2 trick questions in `content/test-questions/test_questions.csv`, all from real people
- [ ] Real screenshots in `docs/screenshots/`

## Content
- [ ] 6 or more verified questions in each of the 11 groups; 1 or more verified note in each group
- [ ] No draft rows left that you intend to ship (health check row 10)
- [ ] No row verified by its own author (health check row 13)

## Security and deployment
- [ ] Supabase migrations applied through `202610221500_security_hardening.sql` (health check row 16)
- [ ] Production site loads with no console errors after the latest deploy (the Content Security Policy is the usual cause if something breaks)
- [ ] Supabase Auth rate limits reviewed (anonymous sign-ins)
- [ ] AI keys are set only in Vercel; both providers answered in a live test

## Presentation
- [ ] Pitch slide 1 uses real teammate quotes with permission (or the quote boxes are removed)
- [ ] Demo includes at least one real refusal (a question outside the notes) and one answer with a source
- [ ] Rehearsed once with `docs/pitch/DEMO_SCRIPT.md`; pitch length checked against the hackathon brief
