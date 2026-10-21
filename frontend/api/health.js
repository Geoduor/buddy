// Buddy deployment health check (owner: Geofry).
// Proves that Vercel can read its environment variables and reach Supabase through Row Level Security.
// It never returns any key. Sheryl: please keep this /api folder when you move the real app into /frontend.

async function countRows(base, key, table) {
  const res = await fetch(`${base}/rest/v1/${table}?select=id`, {
    headers: { apikey: key, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`${table}: HTTP ${res.status} ${detail}`);
  }
  // Content-Range looks like "0-0/57" (or "*/0" when empty)
  const total = (res.headers.get('content-range') || '').split('/')[1];
  return total === undefined ? null : Number(total);
}

export default async function handler(req, res) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const env = { SUPABASE_URL: Boolean(base), SUPABASE_PUBLISHABLE_KEY: Boolean(key) };

  res.setHeader('Cache-Control', 'no-store');

  if (!base || !key) {
    return res.status(500).json({ ok: false, env, error: 'Missing environment variables in Vercel settings' });
  }

  try {
    // Counts use the public key, so Row Level Security applies: questions and notes are the VERIFIED ones
    // a learner can see. If these say 0 while you have verified rows, this site is connected to a different
    // Supabase project than the one you verified in (compare `project` below with your dashboard).
    const [domains, objectives, verifiedQuestions, verifiedNotes] = await Promise.all([
      countRows(base, key, 'domains'),
      countRows(base, key, 'objectives'),
      countRows(base, key, 'questions'),
      countRows(base, key, 'notes'),
    ]);
    const ok = domains === 3 && objectives === 57;
    let project = null;
    try { project = new URL(base).hostname.split('.')[0]; } catch { /* leave null */ }
    return res.status(ok ? 200 : 500).json({
      ok,
      env,
      project,
      domains,
      objectives,
      expected: { domains: 3, objectives: 57 },
      verified_questions_visible: verifiedQuestions,
      verified_notes_visible: verifiedNotes,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, env, error: String(err.message || err) });
  }
}
