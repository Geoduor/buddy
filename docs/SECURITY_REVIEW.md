# Security review of Buddy (22 to 23 Oct 2026)

Method: read every source file, the three database migrations and the CI workflow as an attacker would; scanned the whole git history for keys; ran `npm audit`; tested the fixes in a real browser with hostile content and on a real Postgres 16 copy of our schema. We cannot see the live Supabase or Vercel settings from the repo, so those items are listed under "You must do".

## What is already good
- **No secrets in git, including old commits.** CI also blocks keys and `.env` files.
- **`npm audit`: 0 known vulnerabilities** (frontend and importer).
- **Row Level Security is on for all 7 tables.** Learners can only read verified content and their own attempts. The AI caps and usage tables are not readable from the browser.
- **The score cannot be faked.** `is_correct` is computed in the database, not sent by the browser.
- **The AI caps cannot be chosen by the caller** (`reserve_ai_call` takes no parameters and locks while counting).
- **Search keeps Row Level Security** (`security invoker`), so drafts can never be returned.
- **Study Buddy is grounded:** retrieval first, `<` and `>` stripped from questions and notes, answers rejected unless they cite a real note, answers rendered as plain text.
- **No page code writes HTML.** React shows text as text. Links open with `rel="noreferrer"`.

## Findings and fixes
| # | Severity | Problem in simple English | Status |
|---|---|---|---|
| 1 | Medium | Source links from the database were drawn as links without checking them. A bad row such as `javascript:...` or a link to another site could become a clickable link. | **Fixed.** `frontend/src/lib/safeUrl.js` only allows `https://learn.microsoft.com/...`. 18 cases tested. Also a database check, in the migration below, refuses to store anything else. |
| 2 | Medium | No browser security headers: no Content Security Policy, no clickjacking protection, no sniffing protection. | **Fixed.** `frontend/vercel.json` adds CSP (scripts only from our own site), no framing, nosniff, referrer and permissions policies, HSTS. Browser test: 17 of 17 checks passed, including an injected inline script being blocked. |
| 3 | Medium | One learner could write unlimited answer rows. Because anonymous sign-in makes accounts easy, a script could fill the free database. | **Fixed in code, needs you to run it.** `supabase/migrations/202610221500_security_hardening.sql` limits 500 saved answers per learner per hour. Tested: the 501st is refused, other learners are unaffected. |
| 4 | Low | The public health page returned database error text. | **Fixed.** It now returns a generic message and logs the detail on the server. |
| 5 | Low | CI had no explicit token permissions. | **Fixed.** `permissions: contents: read`. |
| 6 | Info | You asked for `textContent` where needed. | **Done.** No code writes HTML, so nothing needed converting. Lint now fails the build on `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `document.write`, `eval` and `new Function`. Tested: all four rule types fire. |

## Open items (not fixed in code)
| # | Severity | What | What to do |
|---|---|---|---|
| A | Medium | Anyone can create anonymous accounts, so the 20-answers-a-day limit per learner can be dodged. The global cap of 200 stops any cost, but a script could use up the day's 200 so real learners see "Buddy is very busy". | **You must do:** in Supabase open Authentication, Rate Limits, and check the limit for anonymous sign-ins per hour per IP. Keep it low. If abuse happens, turn on CAPTCHA for sign-ins. |
| B | Low | A clever question can try to steer the AI (prompt injection). Damage is limited: the AI holds no secrets or tools, sees only verified notes, and answers without a valid citation are discarded. | Accepted. The evaluation includes trick questions. |
| C | Low | Google Fonts are loaded from Google, so visitors' IP addresses reach Google. | Self-host the fonts after the hackathon. |
| D | Low | The Supabase session token is kept in the browser's local storage (library default). Anonymous accounts hold no personal data, and the new CSP makes script injection much harder. | Accepted. |
| E | Low | CI actions are pinned by version tag, not commit hash. | Pin by hash after the hackathon. |
| F | Info | `style-src` allows `unsafe-inline` because React uses inline styles. Scripts do not. | Accepted. |

## You must do after merging
1. Run `supabase/migrations/202610221500_security_hardening.sql` in the Supabase SQL editor, then `scripts/db_health_check.sql`. Row 16 should say OK.
2. After Vercel redeploys, open the site on a phone and a laptop: home, quiz, readiness and Ask Buddy must all work, and the fonts must load. Then check the headers: `curl -I https://buddy-six-khaki.vercel.app` should show `content-security-policy`.
3. If the site breaks, the likeliest cause is the CSP line in `frontend/vercel.json`. Remove only that line and redeploy, and tell Geofry which feature broke.
4. Do item A in the Supabase dashboard.
5. Never paste a real key in chat or a pull request. If one is ever exposed, rotate it in the provider's dashboard at once.
