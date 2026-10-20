// POST /api/study-buddy   (owner: Geofry)
// Written as an ES module on purpose: works whether or not the project's package.json says "type": "module".
// Headers: Authorization: Bearer <the learner's Supabase access_token>
// Body:    { "question": "What is the shared responsibility model?" }
//
// Flow: validate -> search verified notes (Supabase, as the learner) -> nothing found? say so, NO AI call
//       -> cached answer? return it -> reserve a slot under the daily caps -> ask the AI (Groq, then Gemini)
//       -> accept the answer only if it cites the notes -> return answer + sources.

import * as core from '../server/studyBuddyCore.js';
import * as providers from '../server/providers.js';

class SupabaseError extends Error {
  constructor(status, detail) {
    super(`supabase ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function rpc({ base, key, token, fn, args, fetchImpl }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new SupabaseError(res.status, (await res.text()).slice(0, 200));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function createHandler({ fetchImpl = fetch, env = process.env, cache = core.createCache() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, error, message) => res.status(status).json({ ok: false, error, message });

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return fail(405, 'method_not_allowed', 'Use POST.');
    }

    const base = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) return fail(500, 'server_not_configured', 'The server is not configured yet.');

    const auth = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || ''));
    if (!auth) return fail(401, 'not_signed_in', 'Please sign in first.');
    const token = auth[1].trim();

    let body;
    try {
      body = req.body; // Vercel's helper throws when the JSON is malformed
    } catch {
      return fail(400, 'bad_question', 'The request body is not valid JSON.');
    }
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }
    const v = core.validateQuestion(body);
    if (!v.ok) return fail(400, 'bad_question', v.message);

    const sb = { base, key, token, fetchImpl };

    // 1. Retrieval, as the learner. RLS guarantees only VERIFIED content can come back.
    let passages;
    try {
      const rows = await rpc({ ...sb, fn: 'search_knowledge', args: { query_text: v.question, match_count: 4 } });
      passages = core.preparePassages(rows);
    } catch (err) {
      if (err instanceof SupabaseError && (err.status === 401 || err.status === 403)) {
        return fail(401, 'invalid_session', 'Your session has expired. Please refresh the page.');
      }
      console.error(`[study-buddy] search failed status=${err.status || err.name}`);
      return fail(502, 'search_unavailable', 'Buddy could not search its notes right now. Try again shortly.');
    }

    // 2. Nothing relevant: say so. No AI call, no quota used.
    if (passages.length === 0) {
      return res.status(200).json({
        ok: true,
        outside_notes: true,
        answer: core.MESSAGES.outsideNotes,
        sources: core.learnSources(),
        provider: null,
        cached: false,
      });
    }

    // 3. Repeat question with the same notes? Serve the saved answer.
    const cacheKey = core.cacheKey(v.question, passages);
    const saved = cache.get(cacheKey);
    if (saved) return res.status(200).json({ ...saved, cached: true });

    // 4. Is there an AI provider configured at all? (checked before spending quota)
    if (providers.providerOrder(env).length === 0) {
      return fail(503, 'ai_not_configured', 'Buddy’s AI is not switched on yet.');
    }

    // 5. Reserve a slot under the daily caps (per learner and global).
    try {
      const slot = await rpc({ ...sb, fn: 'reserve_ai_call', args: {} });
      if (slot === 'user_cap') return fail(429, 'daily_limit_user', 'You have used your Buddy questions for today. Come back tomorrow!');
      if (slot === 'global_cap') return fail(429, 'daily_limit_global', 'Buddy is very busy today. Please try again later.');
      if (slot === 'unauthenticated') return fail(401, 'invalid_session', 'Your session has expired. Please refresh the page.');
      if (slot !== 'ok') return fail(502, 'quota_check_failed', 'Please try again shortly.');
    } catch (err) {
      if (err instanceof SupabaseError && (err.status === 401 || err.status === 403)) {
        return fail(401, 'invalid_session', 'Your session has expired. Please refresh the page.');
      }
      console.error(`[study-buddy] reserve failed status=${err.status || err.name}`);
      return fail(502, 'quota_check_failed', 'Please try again shortly.');
    }

    // 6. Ask the AI.
    let out;
    try {
      const { system, user } = core.buildPrompt(v.question, passages);
      out = await providers.generate({ system, user, env, fetchImpl });
    } catch {
      return fail(503, 'ai_unavailable', 'Buddy’s AI is busy right now. Please try again in a minute.');
    }

    // 7. Accept the answer only if it is grounded (cites the notes).
    const parsed = core.parseAnswer(out.text, passages);
    if (parsed.kind !== 'ok') {
      return res.status(200).json({
        ok: true,
        outside_notes: true,
        answer: parsed.kind === 'ungrounded' ? core.MESSAGES.ungrounded : core.MESSAGES.outsideNotes,
        sources: core.learnSources(),
        provider: out.provider,
        cached: false,
      });
    }

    const payload = {
      ok: true,
      outside_notes: false,
      answer: parsed.answer,
      sources: core.formatSources(passages, parsed.used),
      provider: out.provider,
    };
    cache.set(cacheKey, payload);
    return res.status(200).json({ ...payload, cached: false });
  };
}

export default createHandler();
