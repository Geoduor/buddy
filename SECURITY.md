# Security policy

Buddy is a student hackathon project, not a commercial service. We still take security seriously because learners trust what the app shows them.

## Reporting a vulnerability
Please do **not** open a public issue with exploit details.
1. Use GitHub's private "Report a vulnerability" option on the repository's **Security** tab, if it is enabled.
2. If it is not, contact the team lead through his GitHub profile, https://github.com/Geoduor, and ask for a private way to send details.

Include what you found, the steps to reproduce it, and the page or endpoint involved. We will acknowledge a report as soon as we can and fix serious problems first. We cannot offer rewards.

## What is in scope
- The live site https://buddy-six-khaki.vercel.app and the code in this repository.
- Problems with the database rules (Row Level Security, constraints, functions), the Study Buddy endpoint, and the browser app.

Out of scope: denial-of-service testing against the free-tier services, social engineering, and third-party services (Vercel, Supabase, Groq, Google).

## What we already do
A full review is in [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md). In short:
- Row Level Security on every table; learners can read only `verified` content and only their own attempts.
- The browser holds only public keys. Secret keys live in Vercel environment variables or on the team lead's laptop and are never committed (CI scans for real-looking keys).
- `is_correct` is computed by the database; the browser cannot set it.
- Attempt rate limit (500 per hour per learner) and daily AI caps (20 per learner, 200 in total).
- The Study Buddy treats learner text as data, refuses when notes do not cover a question, and rejects answers without a valid citation.
- No HTML is written into the page from data (ESLint rule), source links are limited to `https://learn.microsoft.com/`, and the site sends a Content Security Policy and other security headers (`frontend/vercel.json`).

## Supported versions
Only the current `main` branch and the live deployment are supported.
