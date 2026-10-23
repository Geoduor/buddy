# AGENTS.md: instructions for AI coding assistants (Claude, Codex, Copilot, Cursor and others)

Read this first, then [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md), [`REPO_STRUCTURE.md`](REPO_STRUCTURE.md) and [`PRD.md`](PRD.md). Humans may read it too; it is the short version of how to work safely in this repo.

## What this project is
Buddy: an **unofficial** AZ-900 (Microsoft Azure Fundamentals) study tool. Smart Quiz, Readiness Tracker, and an AI Study Buddy that answers only from verified notes (RAG). Team lead: Geofry Oduor (`@Geoduor`). Live site: https://buddy-six-khaki.vercel.app

## Rules that override everything else
1. **No fake data.** Never invent users, scores, quotes, statistics, test results, askers or exam facts. Use real data from the repo or the team. A placeholder is allowed only if it is visibly labelled as one.
2. **No hallucinated Azure facts.** Do not state an Azure fact from memory as certain. Check it against the Microsoft Learn page that goes in `source_url`, or mark it `NEEDS CHECK` in the `notes` column and leave the row as a draft. If you are unsure about anything, stop and ask the team lead to research it.
3. **No exam dumps.** Never copy real exam questions, braindump or paid practice-test content. Write original questions in our own words and link the Learn page. Do not paste large passages of Learn text.
4. **No Microsoft logos.** Keep the "Unofficial, not affiliated with or endorsed by Microsoft" label in the footer and README.
5. **Never commit secrets.** No `.env`, API keys or Supabase secret keys. `.env.example` holds fake names only. CI fails if a real-looking key is committed.
6. **Stay in your lane.** Only edit files in your area (see `REPO_STRUCTURE.md` and `.github/CODEOWNERS`). `content/objectives.json` is locked: never edit it.
7. **Never mark content `verified` yourself.** Verification is a human step by someone who is not the author (`docs/VERIFICATION_CHECKLIST.md`). The importer only creates drafts.

## Stack
- Frontend: React 19 + Vite 8, HashRouter, routes `/`, `/quiz`, `/dashboard`, `/study-buddy`. Folder `frontend/`.
- Serverless API on Vercel (project root `frontend/`): `frontend/api/study-buddy.js`, `frontend/api/health.js`; helpers in `frontend/server/`.
- Database and auth: Supabase Postgres with Row Level Security and anonymous sign-in. Migrations in `supabase/migrations/` (run in filename order).
- AI: Groq `openai/gpt-oss-120b` first, Google Gemini `gemini-3.5-flash-lite` as backup (free tiers; keys only in Vercel environment variables).
- Content: CSV files in `content/questions/` and `content/notes/`.

## Commands (run from the repo root unless noted)
```bash
node frontend/server/study-buddy.test.mjs        # 23 offline endpoint tests, no network or keys
node frontend/src/lib/safeUrl.test.mjs           # safe-link tests
node scripts/validate_content.mjs                # format check for content CSVs
cd frontend && npm ci && npm run lint && npm run build
cd backend/importer && npm ci && node import.js --dry-run     # needs repo-root .env
cd backend/tests && npm ci && npm run retrieval                # needs repo-root .env
```
CI (`.github/workflows/ci.yml`) runs the first four plus a no-secrets check on every pull request. Make them pass before you open a PR.

## Code rules
- **Never write HTML into the page from data.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` or `dangerouslySetInnerHTML`. Render text through React or `textContent`; ESLint (and so CI) fails otherwise.
- Draw a source link only through `learnUrl()` in `frontend/src/lib/safeUrl.js` (HTTPS `learn.microsoft.com` only).
- The browser sends only `question_id` and `selected_index` for an attempt. `is_correct` is computed by the database.
- Anything that needs a secret runs server-side only. `VITE_` variables are public by design; never put a secret in one.
- Keep database functions `security invoker` with `set search_path = ''` unless there is a written reason. A `security definer` function needs Geofry's review.
- Do not weaken Row Level Security, the CSP in `frontend/vercel.json`, or the verification constraints to make something work. Ask first.
- Study Buddy rules: retrieval first; no AI call when nothing is found; answer only from retrieved passages; reject answers with no valid citation. Do not loosen these. The reasoning is in `prompts/study_buddy.md`; if you change the prompt in `frontend/server/studyBuddyPrompt.js`, update that page.
- Search tuning lives in `supabase/candidates/`. Files there are **not migrations** and never run automatically. Promote one only with evidence (see `supabase/candidates/README.md`), and never tune against the evaluation questions without saying so.

## Content rules
- Each row maps to one objective id from `content/objectives.json`, has a real Microsoft Learn URL you actually read, an explanation, and (for questions) a reason each wrong option is wrong.
- Notes are 60 to 150 words, one topic each, in our own words.
- Start every row as `draft`. Put doubts in `notes` as `NEEDS CHECK: ...`.
- Use the names in `objectives.json` (for example Microsoft Entra ID, not Azure AD).
- Files are named `<author>_<group>.csv`. The importer skips files starting with `_` (templates) and skips duplicates by normalised text, so a fix to an already-imported row needs a database update, not a re-import.

## Git workflow
- Branch: `feature/<name>-<what>` or a clear topic name such as `fix/...`, `docs/...`. Pull `main` first.
- Open a pull request into `main`; `main` is protected (PR, the `checks` job, code-owner review). Geofry merges.
- Small commits with clear messages. Do not force-push shared branches.
- When Claude makes a commit or PR in this repo, end commit messages with the `Co-Authored-By` line given by the session, and PR bodies with the generated-with line.

## When you are unsure
Say so. Ask Geofry to run a deep research pass rather than guessing. For content, write `NEEDS CHECK`. For code, state the assumption in the PR description. A refusal or a question is always cheaper than a wrong fact in the app.
