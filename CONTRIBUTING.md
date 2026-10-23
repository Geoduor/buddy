# Contributing to Buddy

Thank you for helping. This is a small hackathon team project, and these rules keep the content trustworthy.

## Before you start
1. Read [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) and [`REPO_STRUCTURE.md`](REPO_STRUCTURE.md). Only edit files in your own area.
2. `git pull origin main`, then create a branch: `feature/<your-name>-<what>` (or `fix/...`, `docs/...`).

## The three rules
- **Real data only.** No invented users, quotes, statistics or exam facts.
- **Our own words.** Never copy real exam questions, braindumps, paid practice tests or long passages of Microsoft Learn.
- **No secrets.** Never commit `.env`, API keys or Supabase keys.

## Adding questions or notes
1. Copy the template in `content/questions/_template.csv` or `content/notes/_template.csv` (check the folder for the current template files).
2. Write one row per question or note. Every row needs an objective id from `content/objectives.json` and a Microsoft Learn URL that you actually read.
3. Unsure about a fact? Put `NEEDS CHECK: why` in the `notes` column. The row stays a draft until it is resolved.
4. Validate: `node scripts/validate_content.mjs`
5. Open a pull request. Geofry imports the file as `draft`.
6. A **different** person checks each row against its Learn page (`docs/VERIFICATION_CHECKLIST.md`) and Geofry marks it `verified`. The database refuses `verified` without a source URL, an explanation, and a reviewer who is not the author.

## Changing code
```bash
node frontend/server/study-buddy.test.mjs
node frontend/src/lib/safeUrl.test.mjs
node scripts/validate_content.mjs
cd frontend && npm ci && npm run lint && npm run build
```
All of these must pass; GitHub runs them on every pull request. Do not write HTML into the page from data (no `innerHTML`); ESLint blocks it. Changes under `frontend/api/`, `frontend/server/`, `supabase/`, `prompts/` and `.github/` are reviewed by Geofry only (`.github/CODEOWNERS`).

## Pull requests
- Fill in the pull request template.
- One topic per PR. Say what you checked and what you could not check.
- `main` is protected: a PR, the `checks` job, and code-owner review are required.

## Reporting a wrong fact
If you find a wrong or outdated question, note or explanation, open an issue with the "Content error" template. Include the objective id and the Microsoft Learn page that shows the right answer. For security problems, follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.

## License
By contributing you agree that your contribution is released under the MIT License in [`LICENSE`](LICENSE).
