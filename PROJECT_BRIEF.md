# PROJECT BRIEF - Buddy: AZ-900 Exam Prep Tool (Vibe Coding Hackathon, #1MillionDevs)

> Give this file to your Claude at the start of every session, together with your ROLE file and `objectives.json`.
> Team lead: Geofry. If this brief and your Claude disagree, the brief wins. If the brief is silent, ask Geofry.

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
  - **Geofry owns everything that touches the AI provider:** the Study Buddy endpoint, the AI API integration, API keys, and the prompts in `/prompts`.
  - **Mark owns** (a) the CSV-to-Supabase question importer with validation, (b) the **retrieval function** (Postgres full-text search over `notes` and verified `questions.explanation`) that Geofry's endpoint calls, (c) the **readiness calculation** (SQL view or function), and (d) the Study Buddy **test harness** (a list of real test questions and a script that runs them and records results).
  - Anything that needs a secret API key runs server-side only.
- **Hosting:** Vercel or equivalent, deployed by Geofry from the `main` branch.
- **AI provider:** TBD by Geofry (depends on available credits). Code must read the key from an environment variable, so swapping provider is easy. Nobody except Geofry holds the production key; Mark uses a separate limited dev key only if Geofry issues one.

### Data model (draft)
- `objectives(id, domain_id, group_id, text, weight_min, weight_max)` - seeded from `objectives.json`
- `questions(id, objective_id, stem, options jsonb, correct_index, explanation, why_wrong jsonb, source_url, author, status)` - `status` is `draft` or `verified`; **the app only shows `verified`**
- `attempts(id, user_id, question_id, selected_index, is_correct, created_at)`
- `notes(id, objective_id, body, source_url)` - our own-words study notes, the retrieval corpus for Study Buddy

### Readiness score (draft)
Per domain: accuracy = correct / attempted. Overall = weighted average using the midpoint of each official weight range (27.5 / 37.5 / 32.5), normalised to sum to 100. Show "not enough data" until a minimum number of attempts per domain. **Label it "estimate - not an official prediction of your exam score"**, because Microsoft's passing score (700) is a scaled score, not a plain percentage.

### Study Buddy RAG rules
1. Retrieve from `notes` (and verified `questions.explanation`) first - start with Postgres full-text search; only add embeddings if there is time.
2. Answer ONLY from retrieved text. Cite the objective and `source_url`.
3. If nothing relevant is retrieved, reply that it is outside our notes and point to the Microsoft Learn page. Never guess.
4. Simple English, short, one real African-context analogy where it helps. Swahili/other languages are a **stretch goal** - only ship it if tested by a fluent speaker.

## 7. Git rules
- Main repo is owned by Geofry. Work on a branch named `feature/<your-name>-<what>`. Open a Pull Request into `main`; Geofry merges.
- Commit small and often (at least every hour of work). Write a clear message.
- **Never commit secrets** (`.env`, API keys, Supabase service key). Use `.env.example` with fake names only.
- Pull from `main` before you start each session.

## 8. Open decisions (Geofry to settle)
1. AI provider and credits/budget.
2. Auth style (email login vs anonymous sign-in) - decide Wednesday morning.
3. ~~Final product name~~ - decided: **Buddy**.
4. Real submission link, Canva template link and Microsoft Learn link - the hackathon brief shows these as placeholders.
5. Question count target: 6 verified questions per objective group (66 total) is the minimum; 10 per group is the stretch.
