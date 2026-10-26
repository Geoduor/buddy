# Buddy: AZ-900 Exam Prep Buddy

**Unofficial study tool for the Microsoft Azure Fundamentals (AZ-900) exam.**
Built for the *Vibe Coding Hackathon: AZ-900 Exam Prep Edition* (#1MillionDevs), 20 to 23 October 2026.

> **Unofficial - not affiliated with or endorsed by Microsoft.** All questions and notes are our own, written in our own words and linked to the public AZ-900 skills outline on Microsoft Learn. No real exam questions, "braindump" content or paid practice-test material is used.

- **Live demo:** https://buddy-six-khaki.vercel.app
- **Demo video:** [docs/demo/buddy-demo.mp4](docs/demo/buddy-demo.mp4) (58 seconds, screen recording of the live site on a phone)
- **Pitch deck:** https://docs.google.com/presentation/d/1wburzq7PgKsgl-HTh-rkuZWi01nHBbj1/edit?usp=sharing&ouid=108525956342255882573&rtpof=true&sd=true

## The problem
Learners preparing for AZ-900 often study from scattered notes and practice questions of unknown quality, with no clear picture of which exam areas they are weak in. Buddy puts three things in one place: practice questions that explain themselves, a view of how ready you are per exam area, and a study helper that never answers from outside its checked notes.

## What Buddy does
1. **Smart Quiz.** Original questions, each tied to one official exam objective. After every answer you see why the right answer is right and why each wrong answer is wrong, with a link to the Microsoft Learn page it was checked against.
2. **Readiness Tracker.** Your accuracy per exam domain, from your own answers.
   - Only your latest attempt at each question counts, so retrying one easy question cannot inflate the score.
   - A domain needs at least 5 different questions answered before it shows a score.
   - The overall figure weights the three domains by the midpoint of Microsoft's published ranges (27.5% / 37.5% / 32.5%) and appears only once all three have enough data.
   - It is an **estimate, not an official prediction**: Microsoft's pass mark (700) is a scaled score, not a percentage.
3. **AI Study Buddy.** Ask a question in plain English and get a short, beginner-friendly answer with numbered sources. It answers **only** from our verified notes. If the notes do not cover the question, it says so and points to Microsoft Learn instead of guessing.

## How the Study Buddy stays honest (RAG)
1. **Search first.** `search_knowledge` runs a Postgres full-text search over verified notes and verified question explanations. If nothing matches well, **no AI call is made**: the learner gets a polite refusal and a Microsoft Learn link.
2. **Grounded prompt.** The AI sees only the retrieved passages (numbered) and the question, and must answer from them.
3. **Citation check in code.** An answer with no valid citation is rejected and replaced by a refusal. Invented citation numbers are removed.
4. **Caps and cache.** Per-learner and global daily limits protect the free AI quotas, and repeat questions are served from a cache.

The exact prompt and the reasoning behind each rule are in [`prompts/study_buddy.md`](prompts/study_buddy.md). The test plan is in [`prompts/STUDY_BUDDY_EVAL.md`](prompts/STUDY_BUDDY_EVAL.md).

## Content quality rule
Every question and note starts as `draft`. It becomes `verified` only after a second person checks it against the Microsoft Learn page in its `source_url`. The database itself refuses `verified` without a source URL, an explanation, and a reviewer who is not the author. See [`docs/VERIFICATION_CHECKLIST.md`](docs/VERIFICATION_CHECKLIST.md).

## Architecture
| Part | Technology |
|---|---|
| Frontend + serverless API | Vercel (project root `frontend/`); Study Buddy is `frontend/api/study-buddy.js` |
| Database + auth | Supabase: Postgres, Row Level Security, anonymous sign-in (no account needed) |
| AI | Groq `openai/gpt-oss-120b` first, Google Gemini `gemini-3.5-flash-lite` as automatic backup, both on free tiers. Both providers were tested live on 21 Oct 2026. |
| Content pipeline | CSV files in `content/`, checked by `scripts/validate_content.mjs`, imported as drafts |

API shapes are documented in [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md).

## Repository layout
| Folder | Contents |
|---|---|
| `frontend/` | The web app. `frontend/api/` and `frontend/server/` hold the serverless functions |
| `backend/` | Content importer |
| `content/` | Question and note CSV files, and `objectives.json` (the official exam outline with our IDs) |
| `supabase/` | Database migrations and the objectives seed |
| `prompts/` | Study Buddy prompt notes and evaluation plan |
| `scripts/` | Smoke test, content validator, verification SQL |
| `backend/tests/` | Study Buddy test harness (reads `content/test-questions/test_questions.csv`). Run: `cd backend/tests && npm install && npm run retrieval` |
| `docs/` | Architecture, API contracts, verification checklist, security review, submission checklist, demo video, screenshots, pitch outline and demo script |
| `supabase/candidates/` | Retrieval-tuning proposals (not migrations; never run automatically) |

Full ownership rules: [`REPO_STRUCTURE.md`](REPO_STRUCTURE.md).

## Project documents
| Document | What it is |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements: problem, users, goals, non-goals, requirements with acceptance checks, risks |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the pieces fit together and how a Study Buddy answer is produced |
| [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) | The team's rules and anti-hallucination protocol |
| [`AGENTS.md`](AGENTS.md) | Instructions for AI coding assistants working in this repo |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to add content or code and open a pull request |
| [`SECURITY.md`](SECURITY.md) and [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) | How to report a problem, and what we already protect |
| [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) | What must be true before we submit |

## Run it yourself
1. **Supabase.** Create a project. In the SQL editor run the files in `supabase/migrations/` in filename order, then `supabase/seed/objectives_seed.sql`. Turn on **Anonymous sign-ins** in Authentication settings.
2. **Vercel.** Import this repo with **Root Directory = `frontend`**. Add the environment variables below, then redeploy (changes apply only to new deployments).
3. **Frontend (React + Vite).** `cd frontend`, then `npm install`. Create `frontend/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then `npm run dev`. The local dev server does not run the `/api` functions, so the Study Buddy needs the deployed site or a Vercel preview. `npm run build` makes the production build.
4. **Check it works:** `node scripts/smoke-test.mjs <your-site-url>` (needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in a local `.env`).

### Environment variables
Names only. Never commit real values. Copy `.env.example` to `.env`.

| Name | Used by | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | serverless functions, scripts | public by design; safe because Row Level Security is on |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser code | same values; the `VITE_` prefix exposes them to the browser |
| `SUPABASE_SECRET_KEY` | content importer, local only | secret; never on Vercel or in browser code |
| `AI_PROVIDER` | Study Buddy | `groq` or `gemini` |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Study Buddy | secret; set in Vercel only |
| `GROQ_MODEL`, `GEMINI_MODEL` | Study Buddy | optional overrides |

## Tests and checks
- `node frontend/server/study-buddy.test.mjs`: 23 offline tests of the Study Buddy endpoint (no network, no keys needed).
- `node scripts/validate_content.mjs`: format check for the content CSVs.
- `node frontend/src/lib/safeUrl.test.mjs` and `npm run lint` (in `frontend/`): the safe-link tests and the rule that forbids writing HTML into the page. Security review: `docs/SECURITY_REVIEW.md`.
- `scripts/db_health_check.sql`: read-only check of the live Supabase database (security settings, caps, content counts). Paste it into the SQL editor; every row should say OK.
- GitHub runs both on every pull request, plus a check that no `.env` file or real-looking key is committed.
- `main` is protected: changes go in through pull requests.

## Known limits
- Search is keyword-based, not embeddings, so a question worded very differently from our notes may be refused. A refusal is the safe failure.
- Answer quality with real learners is measured in `prompts/STUDY_BUDDY_EVAL.md`. Results: _PLACEHOLDER until the evaluation is run._
- Free AI tiers have small quotas, so daily caps apply.
- Swahili and other languages are a stretch goal, shipped only if a fluent speaker has tested them.
- Readiness is an estimate, not an official score.
- There are no accounts: progress is saved in the browser through anonymous sign-in, so clearing site data or switching device starts from zero.

## Team
| Name | Role |
|---|---|
| Geofry Oduor | Team lead; database, hosting, AI integration, readiness |
| Sheryl | Frontend |
| Mark | Content importer |
| Jess | Question and note author, demo video |
| Yego | Documentation, quiz content and pitch deck |

## Credits and sources
Exam structure and domain weights come from the official Microsoft Learn study guide for Exam AZ-900: https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900. Microsoft and Azure are trademarks of Microsoft Corporation, used here only to describe the exam.

## License

MIT. See [LICENSE](LICENSE). The AZ-900 exam structure and objective text belong to Microsoft and are used here only to describe the exam; Microsoft and Azure are trademarks of Microsoft Corporation.

## Disclaimer

This is an unofficial study aid. It is not an official Microsoft product, and the readiness estimate does not predict your real exam score. Always check learn.microsoft.com for the latest AZ-900 skills outline.
