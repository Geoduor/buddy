# Product Requirements Document: Buddy

Status: v1, written 23 Oct 2026 for the Vibe Coding Hackathon: AZ-900 Exam Prep Edition (#1MillionDevs).
Owner: Geofry Oduor (team lead). Source of truth for scope. If this file and the code disagree, tell Geofry.
Related: [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) (team rules), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how it is built), [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) (shapes).

## 1. Summary
Buddy is an **unofficial** study tool for the Microsoft AZ-900 (Azure Fundamentals) exam. It combines practice questions that explain themselves, a per-area readiness estimate, and an AI study helper that answers only from notes the team has checked against Microsoft Learn.

## 2. Problem
Beginners preparing for AZ-900 often study from scattered notes and practice questions of unknown quality, and have no clear picture of which exam areas they are weak in. A wrong fact in a study tool is worse than no tool, because the learner trusts it.

We have not run a user study. The problem statement comes from the team's own experience preparing for this exam. Real teammate quotes belong on pitch slide 1 (`docs/pitch/PITCH_OUTLINE.md`); none are invented here.

## 3. Target users
- **Primary:** beginners preparing for AZ-900, especially learners in Africa who study on phones.
- **Not targeted:** learners preparing for other Microsoft exams; people looking for exam dumps.
- Wording of the audience is to be confirmed by the team before the pitch.

## 4. Goals
1. **Accurate, objective-mapped content.** Every item maps to one official AZ-900 objective, links to Microsoft Learn, is written in our own words, and is checked by a second person before learners see it.
2. **Fast feedback.** A learner answers a question and immediately sees why the right option is right and why each wrong option is wrong.
3. **A clear readiness view** per exam domain, weighted like the real exam, honestly labelled as an estimate.
4. **An AI helper that refuses rather than guesses.**
5. **Works on a phone, with no sign-up.**

## 5. Non-goals
- No real exam questions, "braindump" or paid practice-test content.
- No prediction of the real exam score. Microsoft's pass mark (700) is a scaled score, not a percentage.
- No accounts, email sign-in, payments or leaderboards.
- No Microsoft logos; the product is labelled "Unofficial, not affiliated with or endorsed by Microsoft".
- Other Microsoft exams and languages other than English are out of scope for this version (Swahili is a stretch goal only if a fluent speaker has tested it).

## 6. Requirements

### 6.1 Smart Quiz
| ID | Requirement | Acceptance check |
|---|---|---|
| Q1 | Show only `verified` questions. | The database refuses to return drafts to learners (Row Level Security); `scripts/db_health_check.sql` checks it. |
| Q2 | Learner can practise by topic (objective group) or mixed. | Quiz page lists the 3 domains and their groups from `content/objectives.json`. |
| Q3 | After each answer show the correct option, why it is right, why each wrong option is wrong, and a Microsoft Learn link. | Question rows with a source link and explanation only; links are limited to `https://learn.microsoft.com/` (database constraint plus `frontend/src/lib/safeUrl.js`). |
| Q4 | Save each attempt; `is_correct` is computed by the database, not the browser. | Trigger on `attempts`; browser sends only `question_id` and `selected_index`. |

### 6.2 Readiness Tracker
| ID | Requirement | Acceptance check |
|---|---|---|
| R1 | Show accuracy per domain from the learner's own attempts. | `get_readiness()` returns one row per domain plus an overall row. |
| R2 | Count only the latest attempt at each question. | Same function; retrying one easy question cannot inflate the score. |
| R3 | Show a domain score only after at least 5 different questions are answered in it. | `readiness_min_attempts` setting; below it the app says "Not enough data yet". |
| R4 | Overall score weights domains by the midpoint of Microsoft's published ranges (27.5 / 37.5 / 32.5) and appears only when all three domains have enough data. | Same function. |
| R5 | Label the score "estimate, not an official prediction". | Visible on the Readiness page. |

### 6.3 AI Study Buddy
| ID | Requirement | Acceptance check |
|---|---|---|
| S1 | Retrieve from verified notes and verified question explanations first. If nothing matches well, make **no AI call** and refuse politely with a Learn link. | `search_knowledge()`; offline tests in `frontend/server/study-buddy.test.mjs`. |
| S2 | The AI sees only the retrieved passages and the question; it must answer only from them, in simple English, in about 120 words or fewer. | `frontend/server/studyBuddyPrompt.js`, explained in `prompts/study_buddy.md`. |
| S3 | Reject any answer with no valid citation; remove invented citation numbers. | Citation check in code; offline tests. |
| S4 | Daily caps protect the free AI quotas: 20 answers per learner and 200 in total per rolling 24 hours (changeable in `app_settings`). | `reserve_ai_call()`; health check rows 6 and 15. |
| S5 | Fall back from Groq to Gemini automatically. | Provider tests in the offline suite. |
| S6 | Treat the learner's text as data, never as instructions. | Prompt-injection test in the offline suite. |

### 6.4 Content pipeline
| ID | Requirement | Acceptance check |
|---|---|---|
| C1 | Content is written as CSV, validated, imported as `draft`, and only becomes `verified` after a second person checks it against the Learn page. | `scripts/validate_content.mjs`, `backend/importer/import.js`, `docs/VERIFICATION_CHECKLIST.md`. |
| C2 | The database refuses `verified` without a source URL, an explanation, and a reviewer different from the author. | Constraints in `202610200900_initial_schema.sql`; health check rows 12 and 13. |
| C3 | Minimum: 6 verified questions per objective group (11 groups) and at least 1 verified note per group. | Health check rows 8 and 9. |

## 7. Quality bars
- **Honesty over coverage:** a refusal is the safe failure.
- **Security:** Row Level Security on all tables, no secrets in the browser or the repo, strict page-security headers, no HTML written into the page from data. See `docs/SECURITY_REVIEW.md`.
- **Cost:** free tiers only; caps keep the demo inside the quotas.
- **Accessibility and phones:** layout works at phone width.

## 8. How we will judge success
We make no claims about user numbers. These are the measures we can show:
1. Content counts from the database health check (snapshot on 23 Oct 2026: 98 verified questions, 58 verified notes, all 11 groups covered).
2. The retrieval and full-answer tests in `backend/tests/` run on real teammates' questions, with failures kept in the results (`prompts/STUDY_BUDDY_EVAL.md`).
3. The 23 offline endpoint tests and the CI checks pass on every pull request.

## 9. Known limits and risks
| Risk | Mitigation or honest statement |
|---|---|
| Keyword search misses questions worded very differently from our notes | A refusal is shown instead of a guess; retrieval improvements are tracked in `supabase/candidates/RETRIEVAL_FINDINGS.md`. |
| Free AI quotas are small | Per-learner and global caps, a short-lived answer cache, no AI call when retrieval finds nothing. |
| A wrong fact in content | Second-person verification, Learn link on every row, "NEEDS CHECK" notes keep rows as drafts. |
| Anonymous sign-in can be abused | Attempt rate limit (500 per hour), AI caps, Supabase sign-in rate limit. |
| Progress is tied to one browser | Stated in the README; clearing site data resets progress. |
| Answer quality with real learners is not yet fully measured | Results go in the evaluation table when the full test has run. |

## 10. Out of scope for now (possible next steps)
- Embedding-based search.
- Other Microsoft fundamentals exams: needs a new objectives file and new verified content, no code change to the pipeline.
- Optional accounts so progress follows the learner across devices.
