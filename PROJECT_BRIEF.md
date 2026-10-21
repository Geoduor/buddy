# PROJECT BRIEF - Buddy: AZ-900 Exam Prep Tool (Vibe Coding Hackathon, #1MillionDevs)

> Give this file to your Claude at the start of every session, together with your ROLE file and `objectives.json`.
> Team lead: Geofry. If this brief and your Claude disagree, the brief wins. If the brief is silent, ask Geofry. Also read `REPO_STRUCTURE.md` (where files go) and `docs/API_CONTRACTS.md` (how the pieces talk to each other).

## 1. What we are building
**Buddy** is an **unofficial** AZ-900 (Microsoft Azure Fundamentals) study tool, made up of:

1. **Smart Quiz** - original questions, each tied to one official exam objective, with instant feedback: why the right answer is right and why each wrong answer is wrong.
2. **Readiness Tracker** - accuracy per exam domain, weighted by the official domain weights, so a learner can see how ready they are.
3. **AI Study Buddy** - explains Azure concepts in simple terms with real African-context examples. It answers ONLY from our verified notes (RAG) and says so when it does not know.

Hackathon theme: "Building Smarter Exam Prep Tools from Our Own Learning Journey."

## 2. Hard rules (non-negotiable - these are in the hackathon brief)
- Do NOT copy real exam questions, "braindump" questions, or paid practice-test content. We write our OWN questions.
- Do NOT use Microsoft logos. Label the product **"Unofficial - not affiliated with or endorsed by Microsoft"** in the UI footer and in the README.
- Base all content on the public AZ-900 skills outline on Microsoft Learn (`objectives.json`).
- Do not paste large chunks of Microsoft Learn text into our database. Write explanations in our own words and link to the Learn page. (We have not verified Microsoft Learn's reuse terms, so we stay on the safe side.)

## 3. Anti-hallucination protocol (every teammate AND every Claude follows this)
1. **Source of truth for the exam structure is `objectives.json`.** Do not invent objectives, domains, weights, service names or exam facts.
2. **Every question and every explanation must be checked against a real Microsoft Learn page**, and that page's URL goes in `source_url`. No URL = status stays `draft`.
3. **If you are not sure, say so.** Write "NEEDS CHECK" in the notes column. A wrong fact in the app costs us the biggest scoring category.
4. **No fake data anywhere.** No invented users, scores, testimonials or statistics. The demo must show real attempts made by real teammates. Placeholder text is allowed only if it is visibly labelled as a placeholder.
5. **Azure changes names often** (for example Azure AD is now Microsoft Entra ID). Use the names that appear in `objectives.json`.
6. **Claude assistants:** you must not state Azure facts from memory as certain. Retrieve from the supplied files, or tell the user to verify on learn.microsoft.com, or ask the team lead to research.

## 4. Judging criteria -> where our effort goes
| Criterion | Weight | What it means for us |
|---|---|---|
| Learning Value | 25% | Accurate content, mapped to objectives. **Most important.** |
| Prompt Engineering | 20% | Study Buddy prompt is grounded, purposeful, tested. Keep the prompts in the repo under `/prompts`. |
| User Experience & Vibes | 15% | Clean, simple, one or two "wow" moments (instant explanation, readiness gauge). |
| Rapid Prototyping & Execution | 15% | Ship something working end to end, early. |
| Technical Creativity | 15% | RAG grounding with citations; weighted readiness score. |
| Presentation & Documentation | 10% | Public GitHub repo, readable README, working demo. |

Pitch criteria (separate): Problem Understanding 20%, Solution & Product 25%, Target Users 15%, Impact & Scalability 20%, Clarity/Design/Delivery 20%.

## 5. Timeline (East Africa Time)
- **Tue 20 Oct:** repo access for everyone, Supabase schema live, frontend skeleton, first questions drafted.
- **Wed 21 Oct:** quiz works end to end (question -> answer -> explanation -> saved attempt). 
- **Thu 22 Oct:** readiness tracker + Study Buddy working. **Feature freeze 22:00.** Only bug fixes after that.
- **Fri 23 Oct:** README and demo video/script done by 12:00. Target submission **15:00**. Hard deadline **18:00**.

## 6. Proposed architecture (team lead may change - ask before deviating)
- **Frontend:** keep the stack Sheryl is already using (this plan assumes React). Talks to Supabase directly for reading questions and saving attempts.
- **Database + auth:** Supabase (Postgres). Row Level Security ON. Owned by Geofry.
- **Backend (small on purpose), split between Geofry and Mark:**
  - **Geofry owns everything that touches the AI provider:** the Study Buddy endpoint (`frontend/api/study-buddy.js`), the provider integration, the API keys, and the prompt (`prompts/study_buddy.md`). **Geofry also owns the readiness function** `get_readiness()` (`supabase/migrations/202610210200_readiness.sql`).
  - **Mark owns** (a) the CSV-to-Supabase importer for questions AND notes, with validation, (b) **tuning the retrieval function** `search_knowledge` (Geofry wrote the reference version in `supabase/migrations/202610210100_study_buddy_support.sql`), and (c) the Study Buddy **test harness** with real teammate questions.
  - Anything that needs a secret API key runs server-side only.
- **Hosting:** Vercel, deployed by Geofry from the `main` branch with the project root set to `frontend/`. The Study Buddy endpoint is a Vercel serverless function in `frontend/api/`, so there is no separate backend server.
- **AI provider (decided):** Groq `openai/gpt-oss-120b` first, Google Gemini `gemini-3.5-flash-lite` as the automatic backup, both on free tiers held only by Geofry (as environment variables). The free quotas are small (Groq: 8K tokens per minute and 200K per day), so Study Buddy has per-learner and global daily caps, a saved-answer cache, and makes **no AI call** when retrieval finds nothing.

### Data model (draft)
- `objectives(id, domain_id, group_id, text, weight_min, weight_max)` - seeded from `objectives.json`
- `questions(id, objective_id, stem, options jsonb, correct_index, explanation, why_wrong jsonb, source_url, author, status, notes, verified_by, verified_at)` - `status` is `draft` or `verified`; **the app only shows `verified`**. The database refuses `verified` without a source URL, an explanation, and a `verified_by` that differs from `author`.
- `attempts(id, user_id, question_id, selected_index, is_correct, created_at)`
- `notes(id, objective_id, body, source_url, author, status, notes, verified_by, verified_at)` - our own-words study notes, the retrieval corpus for Study Buddy (same verification rules as questions)
- `ai_usage(id, user_id, created_at)` and `app_settings(key, value)` - the daily AI caps (20 per learner, 200 in total by default); not readable from the browser

### Readiness score (draft)
Computed by `get_readiness()` from the learner's own attempts. Only the **latest attempt at each question** counts (so retrying one easy question cannot inflate the score). A domain shows an accuracy only after at least 5 different questions are answered in it (setting `readiness_min_attempts`). Overall = weighted average of the three domain accuracies using the midpoint of each official weight range (27.5 / 37.5 / 32.5), normalised to 100, and it stays empty until all three domains have enough data. **Label it "estimate - not an official prediction of your exam score"**, because Microsoft's passing score (700) is a scaled score, not a plain percentage.

### Study Buddy RAG rules
1. Retrieve with `search_knowledge()` from verified `notes` and verified `questions.explanation` (Postgres full-text search; a passage must match at least half of the question's meaningful words). Embeddings only if there is time.
2. Answer ONLY from retrieved text. Cite the objective and `source_url`.
3. If nothing relevant is retrieved, reply that it is outside our notes and point to the Microsoft Learn page. Never guess.
4. Simple English, short, one real African-context analogy where it helps. Swahili/other languages are a **stretch goal** - only ship it if tested by a fluent speaker.

## 7. Git rules
- Main repo is owned by Geofry. Work on a branch named `feature/<your-name>-<what>`. Open a Pull Request into `main`; Geofry merges.
- Commit small and often (at least every hour of work). Write a clear message.
- **Never commit secrets** (`.env`, API keys, Supabase service key). Use `.env.example` with fake names only.
- Pull from `main` before you start each session.

## 8. Open decisions (Geofry to settle)
1. ~~AI provider~~ - decided: Groq first, Gemini backup, free tiers (see section 6). Real-world answer quality is still untested until Mark's test run.
2. ~~Auth style~~ - decided: anonymous sign-in (email sign-in is limited to 2 emails per hour on Supabase's built-in sender).
3. ~~Final product name~~ - decided: **Buddy**.
4. Real submission link, Canva template link and Microsoft Learn link - the hackathon brief shows these as placeholders.
5. Question count target: 6 verified questions per objective group (66 total) is the minimum; 10 per group is the stretch. Plus at least 1 verified note per group. **Content freeze Thursday 22:00.**
