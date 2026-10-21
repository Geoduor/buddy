# API CONTRACTS - how the pieces talk to each other

> For Sheryl (frontend), Mark (backend data), and every AI assistant on the team.
> If your code and this file disagree, tell Geofry before changing either one.
> Anything marked **(Mark)** or **(Geofry)** is being built by that person; code against the shape below and use clearly labelled "sample" data until it is live.

Supabase values come from the team's private message: URL and publishable key. In a Vite app they are read as `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`.

## 1. Sign in (no account needed)
Learners use anonymous sign-in. Their attempts are saved under a real (anonymous) user id.

```js
// once, when the app loads
const { data: { session } } = await supabase.auth.getSession()
if (!session) await supabase.auth.signInAnonymously()
```

## 2. Read questions (only `verified` questions are ever returned; the database enforces it)
```js
const { data, error } = await supabase
  .from('questions')
  .select('id, objective_id, stem, options, correct_index, explanation, why_wrong, source_url')
  .like('objective_id', 'D1.1.%')          // one group; use 'D1.%' for a whole domain
```
- `options` is an array of exactly 4 strings. `correct_index` is 0 to 3.
- `why_wrong` is an array of 4 (null for the correct option). It may be null.
- Group and domain names come from `content/objectives.json` (or the `domains` / `objectives` tables).

## 3. Save an answer
```js
await supabase.from('attempts').insert({ question_id, selected_index })   // 0 to 3
```
Send only these two fields. `user_id` is filled in automatically. `is_correct` is **computed by the database**, so never send it. Show feedback from `correct_index` on the screen; the saved record is for the readiness score.

## 4. Readiness score **(Geofry; migration `202610210200_readiness.sql`)**
```js
const { data } = await supabase.rpc('get_readiness')
```
Returns one row per domain plus an overall row:

| column | meaning |
|---|---|
| `domain_id` | `D1`, `D2`, `D3`, or `OVERALL` |
| `domain_title` | name from the official outline (`Overall` for the overall row) |
| `weight` | official weight midpoint: D1 27.5, D2 37.5, D3 32.5 (overall row: 100) |
| `attempted` | number of DIFFERENT questions this learner answered (only the latest attempt at each question counts) |
| `correct` | of those, how many were right on the latest attempt |
| `accuracy` | 0 to 1, or `null` when `attempted` is below the minimum (5 by default). The `OVERALL` accuracy is `null` until **all three** domains reach the minimum, and is weighted by the midpoints above, normalised to 100%. |

Rule for the screen: when `accuracy` is `null`, show "Not enough data yet". Always label the score **"estimate - not an official prediction of your exam score"** (Microsoft's pass mark of 700 is a scaled score, not a percentage).

## 5. Study Buddy (Geofry)
`POST /api/study-buddy`

```js
const { data: { session } } = await supabase.auth.getSession()
const res = await fetch('/api/study-buddy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ question: 'What is serverless?' }),   // 3 to 500 characters
})
const data = await res.json()
```

**Success (HTTP 200)**
```json
{
  "ok": true,
  "outside_notes": false,
  "answer": "Serverless means you run code without managing servers [1].",
  "sources": [
    { "n": 1, "objective_id": "D1.1.7", "objective_text": "Describe serverless",
      "source_type": "note", "title": "", "source_url": "https://learn.microsoft.com/..." }
  ],
  "provider": "groq",
  "cached": false
}
```
- Show `answer` and a **sources list under every answer**. The `[1]` markers match `sources[].n`. Each `source_url` should be a clickable link.
- When `outside_notes` is `true`, the answer is a polite "not covered in Buddy's notes" message and `sources` holds the Microsoft Learn study guide link (its `n` is `null`). Style it differently, as a gentle notice rather than an error.

**Errors** (HTTP status, then `{ "ok": false, "error": "<code>", "message": "<text safe to show>" }`)

| status | `error` | what to do on screen |
|---|---|---|
| 400 | `bad_question` | Show `message` under the input. |
| 401 | `not_signed_in`, `invalid_session` | Call `signInAnonymously()` again, then retry once. |
| 429 | `daily_limit_user`, `daily_limit_global` | Show `message`; disable the box. |
| 502 | `search_unavailable`, `quota_check_failed` | Show "Try again shortly". |
| 503 | `ai_unavailable`, `ai_not_configured` | Show `message`. |
| 405 / 500 | other | Show a generic error. |

**Local testing note:** the plain Vite dev server does not run `/api` functions. Test the Study Buddy screen on a Vercel preview link, or build it against a mocked response copied from the success example above and label it "sample".

## 6. Search function **(Geofry wrote the reference version; Mark owns tuning from now on)**
`search_knowledge(query_text text, match_count int default 4)` is called by the Study Buddy endpoint, not by the frontend.

Returns up to 8 rows: `source_type` ('note' or 'question'), `source_id`, `objective_id`, `objective_text`, `title`, `content`, `source_url`, `hits`, `score`. It reads only verified content and returns **no rows** when nothing matches well. A passage must match at least half of the question's meaningful words. If you change the matching rules, keep that "return nothing rather than guess" behaviour and re-run the test questions.

## 7. Content import format **(Mark's importer)**
- **Questions CSV** (`content/questions/<author>_<group>.csv`, header from `_template.csv`): `objective_id` is the **ID from `objectives.json`**, for example `D1.1.2`. `correct` is `A`, `B`, `C` or `D` and maps to `correct_index` 0 to 3. Options map to the `options` array in order. The `why_*_wrong` columns map to the `why_wrong` array (leave the correct option's column empty). The `question text` goes in `stem`. Everything imports as `draft`.
- **Notes CSV** (`content/notes/<author>_<group>.csv`, header from `content/notes/_template.csv`): `objective_id`, `body`, `source_url`, `author`, `status`, `notes`. Imports as `draft`.
- The importer must refuse a row whose `objective_id` is not in `objectives.json`, which has no source URL, which has an unreadable `correct` value, or whose question text already exists.

## 8. Quality rule: nothing goes live without a second reviewer
`verified` requires a source URL, an explanation, and a `verified_by` name that is **not** the author. The database refuses anything else. See `docs/VERIFICATION_CHECKLIST.md`.
