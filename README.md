# Buddy: AZ-900 Exam Prep Tool

> *Unofficial - not affiliated with or endorsed by Microsoft.* Buddy is a student project for the Vibe Coding Hackathon (#1MillionDevs). It does not use Microsoft logos.

Live demo: https://buddy-six-khaki.vercel.app (TO CONFIRM this is the final link)

## The problem

TO WRITE: use real answers from each teammate about their own AZ-900 experience (what helped, what confused them, what they wished they had). Do not invent quotes.

## Who it is for

TO WRITE: beginners preparing for the AZ-900 (Microsoft Azure Fundamentals) exam, especially learners in Africa. Confirm the wording with the team.

## What Buddy does

| Feature | What it is | Status |
|---|---|---|
| Smart Quiz | Original questions, each tied to one official exam objective, with instant feedback on why the right answer is right and why each wrong answer is wrong | TO CONFIRM (works today / planned) |
| Readiness Tracker | Accuracy per exam domain, weighted by the official domain weights. It is an estimate and not an official prediction of your exam score | TO CONFIRM |
| AI Study Buddy | Explains Azure concepts in simple terms and answers only from our verified notes, saying so when it does not know | TO CONFIRM |

## How we keep the content accurate

- Every question is mapped to an objective in the official AZ-900 skills outline on Microsoft Learn.
- Every question and note links to the Microsoft Learn page it was checked against.
- Content is written in our own words. We do not copy real exam or braindump questions.
- Nobody verifies their own content. A second teammate checks each item before it is shown to learners.

## Tech stack

- Frontend: React (Vite), deployed on Vercel
- Database and auth: Supabase (Postgres), anonymous sign-in
- Study Buddy: a Vercel serverless function calling Groq, with Google Gemini as a backup (TO CONFIRM)

## How to run it

TO CONFIRM with Geofry: install and start commands, and the environment variable names. Real keys are never committed. See .env.example for the names only.

## Screenshots

TO ADD on Friday: real screenshots from docs/screenshots/.

## Team

- Geofry: team lead, database, hosting, Study Buddy and AI integration
- Sheryl: frontend
- Mark: content importer, readiness calculation, retrieval tuning, tests
- Jess: quiz questions and notes
- Yego: documentation, pitch and quiz content

## What works and what is planned

TO WRITE on Friday: an honest list. Only list features that are built and working.

## Disclaimer

This is an unofficial study aid. It is not an official Microsoft product, and the readiness estimate does not predict your real exam score. Always check learn.microsoft.com for the latest AZ-900 skills outline.
