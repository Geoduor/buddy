// Buddy smoke test (owner: Geofry). Checks the LIVE deployment end to end with at most 2 AI calls.
//
//   node scripts/smoke-test.mjs https://buddy-six-khaki.vercel.app
//   node scripts/smoke-test.mjs https://buddy-six-khaki.vercel.app --ask "What is the Buddy smoke test phrase?"
//
// Reads SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from the environment or from a .env file in the
// current folder. It signs in as a throwaway anonymous user. It NEVER prints keys or tokens.
// Node 18 or newer.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) || '').replace(/\/+$/, '');
const askIdx = args.indexOf('--ask');
const question = askIdx >= 0 && args[askIdx + 1] ? args[askIdx + 1] : 'What is the Buddy smoke test phrase?';

if (!base) {
  console.error('Usage: node scripts/smoke-test.mjs <https://your-site> [--ask "question"]');
  process.exit(2);
}

// Tiny .env reader so you do not need any extra tools
try {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  /* no .env file: fine if the variables are already set */
}
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const info = (msg) => console.log(`        ${msg}`);

async function request(url, init = {}) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60000) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e.message || e) };
  }
}

function notJsonHint(r) {
  if (r.status === 0) return `could not reach the site (${r.text})`;
  if (r.json === null) {
    return /<html|<!doctype/i.test(r.text)
      ? `got a web page (HTTP ${r.status}) instead of JSON. If this is a preview link, Vercel's deployment protection may be blocking it: test the production URL instead.`
      : `unexpected non-JSON response (HTTP ${r.status})`;
  }
  return '';
}

console.log(`\nBuddy smoke test against ${base}\n`);

// 1. Health: Vercel can read its variables and reach Supabase through the security rules
console.log('1. Health check');
{
  const r = await request(`${base}/api/health`);
  if (r.json?.ok === true) {
    pass(`site reaches Supabase project "${r.json.project}" (${r.json.domains} domains, ${r.json.objectives} objectives)`);
    info(`learners can see ${r.json.verified_questions_visible ?? '?'} verified question(s) and ${r.json.verified_notes_visible ?? '?'} verified note(s)`);
  }
  else fail(notJsonHint(r) || `health check failed: ${JSON.stringify(r.json).slice(0, 300)}`);
}

// 2. Study Buddy refuses callers who are not signed in
console.log('2. Study Buddy rejects a request with no sign-in');
{
  const r = await request(`${base}/api/study-buddy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (r.status === 401) pass('returned 401 as expected');
  else if (r.status === 404) fail('/api/study-buddy was not found: is frontend/api/study-buddy.js deployed? (HTTP 404)');
  else fail(notJsonHint(r) || `expected 401, got HTTP ${r.status}`);
}

// 3. Sign in as a throwaway anonymous learner
console.log('3. Anonymous sign-in');
let token = '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
  fail('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not set (put them in .env in this folder)');
} else {
  const r = await request(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
  if (r.json?.access_token) {
    token = r.json.access_token;
    pass(`signed in as anonymous user ${String(r.json.user?.id || '').slice(0, 8)}...`);
  } else {
    const why = r.json?.msg || r.json?.message || r.json?.error_description || `HTTP ${r.status}`;
    fail(`sign-in failed: ${why}. Is "Allow anonymous sign-ins" on and saved? Is the anonymous rate limit raised?`);
  }
}

async function ask(q) {
  return request(`${base}/api/study-buddy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: q }),
  });
}

if (token) {
  // 4. A question our notes cannot answer: must be refused WITHOUT using any AI quota
  console.log('4. Out-of-notes question is refused politely (no AI call)');
  {
    const r = await ask('Which restaurant in Nairobi has the best pizza?');
    if (r.status === 200 && r.json?.outside_notes === true && r.json?.provider === null) {
      pass('refused with a Microsoft Learn link, no AI used');
    } else if (r.status === 200 && r.json?.outside_notes === false) {
      fail('an unrelated question got an answer: retrieval may be matching too loosely. Tell Geofry.');
    } else {
      fail(notJsonHint(r) || `unexpected result: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    }
  }

  // 5. A question our notes CAN answer: the whole chain (search, caps, AI, citation check)
  console.log(`5. Real Study Buddy answer: "${question}"`);
  {
    const r = await ask(question);
    if (r.status === 200 && r.json?.outside_notes === false) {
      pass(`answered by ${r.json.provider} with ${r.json.sources.length} source(s)`);
      info(`answer : ${String(r.json.answer).replace(/\s+/g, ' ').slice(0, 400)}`);
      for (const s of r.json.sources) info(`source : [${s.n}] ${s.objective_id} ${s.source_url}`);
    } else if (r.status === 200 && r.json?.outside_notes === true) {
      fail('no answer: either no VERIFIED content matches yet (run scripts/smoke_test_content.sql first), or the AI reply had no valid citation.');
    } else if (r.status === 503) {
      fail(`AI unavailable: ${r.json?.error}. Check GROQ_API_KEY / GEMINI_API_KEY in Vercel and redeploy.`);
    } else if (r.status === 429) {
      fail(`daily cap reached: ${r.json?.error}`);
    } else {
      fail(notJsonHint(r) || `unexpected result: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    }

    // 6. Same question again: normally answered from the saved-answer cache
    console.log('6. Repeat question (should be served from cache)');
    const r2 = await ask(question);
    if (r2.status === 200 && r2.json?.cached === true) pass('served from cache, no second AI call');
    else if (r2.status === 200) info('not cached this time (the request landed on a fresh server instance): not an error');
    else fail(`repeat request failed: HTTP ${r2.status}`);
  }
}

console.log(failures ? `\n${failures} check(s) FAILED. Copy the lines above to Claude.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
