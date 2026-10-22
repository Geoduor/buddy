# Pitch outline (6 slides) mapped to the pitch criteria

Owner: Yego, with Geofry. Build the deck in the hackathon's Canva template `[LINK]`. Pitch criteria: Problem Understanding 20%, Solution and Product 25%, Target Users 15%, Impact and Scalability 20%, Clarity/Design/Delivery 20%.
Rule: no invented statistics, users or quotes. Where a slide needs evidence, use only what the team can show. Items in `[BRACKETS]` are for the team to fill in.

| # | Slide | Criterion | What goes on it | Evidence we really have |
|---|---|---|---|---|
| 1 | The problem | Problem Understanding (20%) | One sentence on why AZ-900 prep is hard for beginners. Two or three short REAL quotes from teammates: what helped, what confused them. | `[quotes from the five of you, with permission]` |
| 2 | Who it is for | Target Users (15%) | Beginners preparing for AZ-900, especially learners in Africa who study on phones. Confirm this wording with the team. | The app works on phone widths. `[any real learner you spoke to]` |
| 3 | What Buddy does | Solution and Product (25%) | Three features: Smart Quiz (explains why each answer is right or wrong), Readiness Tracker (accuracy per exam domain, weighted by the official ranges), Ask Buddy (answers only from checked notes, with sources). Include 2 or 3 real screenshots. | The live site. Screenshots go in `docs/screenshots/`. |
| 4 | Why you can trust it | Solution (25%) and Learning Value | Every item maps to an official objective, links to Microsoft Learn, is written in our words, and is checked by a second teammate. Buddy refuses rather than guesses. | The verification workflow, the database rule, the refusal behaviour. `[verified counts from /api/health]` |
| 5 | How it works and what we tested | Technical creativity | Retrieval first, then a grounded prompt, then a citation check in code. Show the evaluation table with real results, including failures. | `prompts/STUDY_BUDDY_EVAL.md` results `[after Mark runs it]` |
| 6 | Impact and next steps | Impact and Scalability (20%) | Honest limits: unofficial, progress is saved per browser, keyword search can miss reworded questions. Scale idea: other Microsoft fundamentals exams only need a new objectives file and new verified content. Free-tier hosting keeps cost near zero. | The repo structure and the content workflow. Do not claim user numbers. |

## Delivery tips (Clarity/Design/Delivery, 20%)
- One idea per slide, large text, at most 20 words of body text.
- Open with the real teammate quote, close with the live demo link `[LINK]`.
- Say the limits yourselves before a judge finds them. It reads as honest.
- Keep to the time limit `[CONFIRM from the hackathon brief]` and rehearse once with the demo script in `DEMO_SCRIPT.md`.

## Questions each teammate should answer for slide 1 (their own words)
1. When you started preparing for AZ-900 (or a similar exam), what helped most?
2. What confused you or wasted your time?
3. What do you wish a study tool did?
