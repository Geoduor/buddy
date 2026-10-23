# REPO STRUCTURE - Buddy (AZ-900 study tool)

> Give this file to your Claude together with `PROJECT_BRIEF.md` and your ROLE file.
> Rule for every human and every AI on the team: **only create or edit files inside the folders you own.** If you need something changed elsewhere, ask the owner (or Geofry).

## The tree

```
buddy/
├── README.md                  <- Yego
├── PROJECT_BRIEF.md           <- Geofry (the team's source of truth)
├── REPO_STRUCTURE.md          <- Geofry (this file)
├── PRD.md                     <- Geofry (product requirements)
├── AGENTS.md, CLAUDE.md       <- Geofry (rules for AI assistants)
├── CONTRIBUTING.md, SECURITY.md, LICENSE   <- Geofry
├── .gitignore                 <- Geofry
├── .env.example               <- Geofry (fake values only)
├── .github/                   <- Geofry (PR and issue templates, CODEOWNERS, workflows)
│
├── frontend/                  <- the deployed site (Vercel root directory)
│   ├── (Sheryl's Vite + React app: src/, index.html, package.json ...)   <- SHERYL
│   ├── api/                   <- GEOFRY ONLY: serverless functions (health.js, study-buddy.js)
│   └── server/                <- GEOFRY ONLY: server-side helpers for api/ (prompt, providers, tests)
│
├── backend/
│   ├── importer/              <- CSV -> Supabase importer (questions and notes); Mark built it, Geofry now owns it
│   ├── tests/                 <- Study Buddy test harness + recorded results; Mark built it, Geofry now owns it
│   └── study-buddy/           <- (unused: Study Buddy lives in frontend/api/ so Vercel can deploy it)
│
├── supabase/
│   ├── migrations/            <- schema + SQL functions (see naming rule below)
│   ├── candidates/            <- GEOFRY: retrieval-tuning proposals, NOT migrations
│   └── seed/                  <- GEOFRY: seeds objectives from content/objectives.json
│
├── content/
│   ├── objectives.json        <- LOCKED: official AZ-900 outline. Only Geofry changes it.
│   ├── questions/             <- JESS + YEGO: question CSVs, one file per person per group
│   ├── notes/                 <- JESS + YEGO: own-words study notes as CSVs (Study Buddy's knowledge)
│   └── test-questions/        <- MARK: real questions from teammates for testing
│
├── prompts/                   <- GEOFRY: Study Buddy prompt explained (study_buddy.md)
│
├── docs/
│   ├── ARCHITECTURE.md        <- GEOFRY: how it is built
│   ├── API_CONTRACTS.md       <- GEOFRY: how frontend, database and Study Buddy talk
│   ├── SECURITY_REVIEW.md, SUBMISSION_CHECKLIST.md, EVAL_QUESTION_COLLECTION.md   <- GEOFRY
│   ├── VERIFICATION_CHECKLIST.md <- GEOFRY: how content becomes `verified`
│   ├── demo/                  <- the demo video
│   ├── screenshots/           <- stills from the demo, real screenshots
│   └── pitch/                 <- deck outline, demo script (Yego owns the deck)
│
└── scripts/                   <- GEOFRY: setup helpers, verify_content.sql
```

## Who owns what

| Folder / file | Owner | Others may |
|---|---|---|
| `frontend/` (everything except the two folders below) | Sheryl | read only |
| `frontend/api/`, `frontend/server/` | Geofry | read only. **Sheryl: never delete or overwrite these when you move your app in.** |
| `prompts/`, `docs/API_CONTRACTS.md`, `docs/VERIFICATION_CHECKLIST.md` | Geofry | read only |
| `backend/importer/`, `backend/tests/`, `content/test-questions/` | Geofry (Mark built them; his remaining duties moved to Geofry) | read only |
| `supabase/migrations/` | Geofry (schema), Mark (his SQL functions) | add only your own new file |
| `supabase/seed/`, `scripts/`, `.github/`, root config | Geofry | read only |
| `content/questions/`, `content/notes/` | Jess, Yego | add only your own files |
| `content/objectives.json` | Geofry | read only, never edit |
| `README.md`, `docs/pitch/` | Yego | read only |
| `docs/screenshots/` | Sheryl and Yego | add files |

## Naming rules (these prevent merge conflicts)

**Question files** - one file per author per group, never share a file:
`content/questions/<author>_<group-id>.csv`
Examples: `jess_D1.1.csv`, `jess_D2.2.csv`, `yego_D3.1.csv`
Use the header in `content/questions/_template.csv`. In `objective_id` put the **ID from `objectives.json`** (for example `D1.1.2`, never a group like `D1.1`). Status stays `draft`.

**Notes files** - also CSV, one file per author per group, so one importer handles both:
`content/notes/<author>_<group-id>.csv` (example: `jess_D1.3.csv`)
Use the header in `content/notes/_template.csv`. Write in your own words, 60 to 150 words, one topic per row, never paste Microsoft Learn text, and put the exact Learn URL you read in `source_url`.

**SQL migrations** - timestamp first so two people never pick the same number:
`supabase/migrations/YYYYMMDDHHMM_short_description.sql`
Example: `202610211030_readiness_view.sql`. Never edit a migration that is already merged; add a new one.

**Branches**: `feature/<your-name>-<what>` (example: `feature/mark-importer`). Open a Pull Request into `main`. Geofry merges.

## Environment variables (names only; real values are never committed)

| Name | Who uses it | Notes |
|---|---|---|
| `SUPABASE_URL` | frontend `api/`, backend scripts | public |
| `SUPABASE_PUBLISHABLE_KEY` | frontend `api/`, backend scripts | public by design (starts `sb_publishable_`); safe only because Row Level Security is on. Older projects call this the "anon" key. |
| `SUPABASE_SECRET_KEY` | **Mark's importer only, on his laptop** | **secret - never in frontend code, never on Vercel** (starts `sb_secret_`); bypasses Row Level Security. Older projects call this the "service_role" key. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Sheryl's browser code | same values as above; the `VITE_` prefix makes them visible to the browser. Only these two, never any key that is not public. |
| `AI_PROVIDER` | `frontend/api/study-buddy.js` | `groq` (first choice) or `gemini` |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | `frontend/api/study-buddy.js` | **secret - Geofry only**, set in Vercel and in his local `.env` |
| `GROQ_MODEL`, `GEMINI_MODEL` | `frontend/api/study-buddy.js` | optional; defaults are set in code |

## Rules for AI assistants reading this file
1. Put every new file in the correct folder from the tree above. If you are unsure where something goes, ask the human; do not invent new top-level folders.
2. Never touch a folder owned by someone else. Suggest the change to your human instead.
3. Never write real keys, passwords or credentials into any file. Use the variable names above.
4. Never commit directly to `main`. Use a `feature/<name>-<what>` branch and a Pull Request.
5. Follow the anti-hallucination protocol in `PROJECT_BRIEF.md`: no invented Azure facts, no fake data.
6. Read `docs/API_CONTRACTS.md` before writing code that calls the database or Study Buddy.
7. If this structure and a human's request conflict, tell the human and suggest asking Geofry.

## Quick answers: "where do I push...?"
- A new screen or component -> `frontend/` (not `frontend/api/` or `frontend/server/`)
- A batch of quiz questions -> `content/questions/<you>_<group>.csv`
- A study note -> `content/notes/<you>_<group>.csv`
- The README or a pitch draft -> `README.md` / `docs/pitch/`
- A screenshot -> `docs/screenshots/`
- An importer fix -> `backend/importer/`
- A SQL function -> `supabase/migrations/<timestamp>_<name>.sql`
