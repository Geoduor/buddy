# REPO STRUCTURE - Buddy (AZ-900 study tool)

> Give this file to your Claude together with `PROJECT_BRIEF.md` and your ROLE file.
> Rule for every human and every AI on the team: **only create or edit files inside the folders you own.** If you need something changed elsewhere, ask the owner (or Geofry).

## The tree

```
buddy/
├── README.md                  <- Yego
├── .gitignore                 <- Geofry
├── .env.example               <- Geofry (fake values only)
├── .github/                   <- Geofry (PR template, workflows)
│
├── frontend/                  <- SHERYL: the whole web app UI
│   └── (your existing project goes here; keep your current stack)
│
├── backend/
│   ├── study-buddy/           <- GEOFRY: AI endpoint, AI provider integration
│   ├── importer/              <- MARK: CSV -> Supabase question importer
│   └── tests/                 <- MARK: Study Buddy test harness + results
│
├── supabase/
│   ├── migrations/            <- schema + SQL functions (see naming rule below)
│   └── seed/                  <- GEOFRY: seeds objectives from content/objectives.json
│
├── content/
│   ├── objectives.json        <- LOCKED: official AZ-900 outline. Only Geofry changes it.
│   ├── questions/             <- JESS + YEGO: question CSVs, one file per person per group
│   ├── notes/                 <- JESS + YEGO: own-words study notes (Study Buddy's knowledge)
│   └── test-questions/        <- MARK: real questions from teammates for testing
│
├── prompts/                   <- GEOFRY: Study Buddy prompts, with notes on why
│
├── docs/
│   ├── screenshots/           <- SHERYL adds, YEGO uses
│   └── pitch/                 <- YEGO: deck outline, demo script
│
└── scripts/                   <- GEOFRY: setup/deploy helpers
```

## Who owns what

| Folder / file | Owner | Others may |
|---|---|---|
| `frontend/` | Sheryl | read only |
| `backend/study-buddy/`, `prompts/` | Geofry | read only |
| `backend/importer/`, `backend/tests/`, `content/test-questions/` | Mark | read only |
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
Use the format in `content/questions/_template.csv`. Status stays `draft` until reviewed.

**Notes files** - one per objective group:
`content/notes/<group-id>_<short-topic>.md` (example: `D1.3_service-types.md`)
Write in your own words, never paste Microsoft Learn text, and end each note with a `Source:` line holding the exact Learn URL you read.

**SQL migrations** - timestamp first so two people never pick the same number:
`supabase/migrations/YYYYMMDDHHMM_short_description.sql`
Example: `202610211030_readiness_view.sql`. Never edit a migration that is already merged; add a new one.

**Branches**: `feature/<your-name>-<what>` (example: `feature/mark-importer`). Open a Pull Request into `main`. Geofry merges.

## Environment variables (names only; real values are never committed)

| Name | Who uses it | Notes |
|---|---|---|
| `SUPABASE_URL` | frontend, backend | public |
| `SUPABASE_PUBLISHABLE_KEY` | frontend, backend | public by design (starts `sb_publishable_`); safe only because Row Level Security is on. Older projects call this the "anon" key. |
| `SUPABASE_SECRET_KEY` | backend only (importer) | **secret - never in frontend code** (starts `sb_secret_`); bypasses Row Level Security. Older projects call this the "service_role" key. |
| `AI_PROVIDER`, `AI_MODEL` | `backend/study-buddy` | Geofry only |
| `AI_API_KEY` | `backend/study-buddy` | **secret - Geofry only** |

The frontend needs its framework's public prefix on the variable names (for example `VITE_` or `NEXT_PUBLIC_`). Sheryl's Claude should check which one her stack uses.

## Rules for AI assistants reading this file
1. Put every new file in the correct folder from the tree above. If you are unsure where something goes, ask the human; do not invent new top-level folders.
2. Never touch a folder owned by someone else. Suggest the change to your human instead.
3. Never write real keys, passwords or credentials into any file. Use the variable names above.
4. Never commit directly to `main`. Use a `feature/<name>-<what>` branch and a Pull Request.
5. Follow the anti-hallucination protocol in `PROJECT_BRIEF.md`: no invented Azure facts, no fake data.
6. If this structure and a human's request conflict, tell the human and suggest asking Geofry.

## Quick answers: "where do I push...?"
- A new screen or component -> `frontend/`
- A batch of quiz questions -> `content/questions/<you>_<group>.csv`
- A study note -> `content/notes/`
- The README or a pitch draft -> `README.md` / `docs/pitch/`
- A screenshot -> `docs/screenshots/`
- An importer fix -> `backend/importer/`
- A SQL function -> `supabase/migrations/<timestamp>_<name>.sql`
