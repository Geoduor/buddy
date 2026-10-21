#!/usr/bin/env node
/**
 * Buddy test harness (owner: MARK)  backend/tests/run_tests.js
 *
 * Input: content/test-questions/test_questions.csv  (REAL teammate questions only)
 *   columns: id,asked_by,question,expected,notes
 *   expected = in_notes | outside_notes   (include at least 3 outside_notes)
 *
 * 1) Retrieval only (no AI, no quota). Run this first and show Geofry the output:
 *      node run_tests.js retrieval
 *    Uses SUPABASE_SECRET_KEY if set (your laptop), else the publishable key + anonymous sign-in.
 *
 * 2) Full Study Buddy run (uses free AI quota: tell Geofry first!):
 *      node run_tests.js full --preview=https://<geofry-preview>.vercel.app --told-geofry
 *    Hard cap 20 questions (each learner is limited to 20/day). Sleeps between calls
 *    because Groq free tier is ~8K tokens/minute.
 *
 * Results are written to backend/tests/results/ (CSV + JSON) for Geofry.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env') })

const [mode, ...rest] = process.argv.slice(2)
const opt = k => (rest.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=')
const has = k => rest.includes(`--${k}`)
const MAX = Number(opt('max') || 20)
const SLEEP_MS = Number(opt('sleep') || 6000)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const url = process.env.SUPABASE_URL
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!['retrieval', 'full'].includes(mode)) { console.error('Usage: node run_tests.js retrieval | full --preview=URL --told-geofry'); process.exit(2) }
if (!url) { console.error('SUPABASE_URL missing in repo-root .env'); process.exit(2) }

const file = path.join(ROOT, 'content/test-questions/test_questions.csv')
const rows = parse(fs.readFileSync(file, 'utf8'), { columns: true, bom: true, skip_empty_lines: true, trim: true })
if (!rows.length) { console.error('test_questions.csv has no rows yet. Add REAL teammate questions.'); process.exit(2) }
const bad = rows.filter(r => !r.question || !['in_notes', 'outside_notes'].includes(r.expected))
if (bad.length) { console.error('Rows with empty question or expected not in_notes/outside_notes:', bad.map(r => r.id).join(', ')); process.exit(2) }
const outside = rows.filter(r => r.expected === 'outside_notes').length
console.log(`${rows.length} questions loaded (${outside} outside notes).${outside < 3 ? ' WARNING: brief asks for at least 3 outside-notes questions.' : ''}`)

const newClient = key => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
async function anonSession() {
  if (!publishable) throw new Error('SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) missing')
  const c = newClient(publishable)
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw new Error('anonymous sign-in failed: ' + error.message)
  return { client: c, token: data.session.access_token }
}

const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
function save(name, results) {
  const dir = path.join(__dirname, 'results'); fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const base = path.join(dir, `${name}_${stamp}`)
  fs.writeFileSync(base + '.json', JSON.stringify(results, null, 2))
  const cols = Object.keys(results[0])
  fs.writeFileSync(base + '.csv', [cols.join(','), ...results.map(r => cols.map(c => csvCell(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(','))].join('\n'))
  console.log(`\nSaved ${path.relative(ROOT, base)}.csv / .json`)
}

// ---------------- retrieval only ----------------
async function runRetrieval() {
  const db = process.env.SUPABASE_SECRET_KEY ? newClient(process.env.SUPABASE_SECRET_KEY) : (await anonSession()).client
  const results = []
  for (const r of rows) {
    const { data, error } = await db.rpc('search_knowledge', { query_text: r.question, match_count: 4 })
    const got = error ? [] : data
    const pass = !error && (r.expected === 'in_notes' ? got.length > 0 : got.length === 0)
    results.push({
      id: r.id, asked_by: r.asked_by, question: r.question, expected: r.expected,
      rows_returned: got.length, pass: error ? 'ERROR' : pass ? 'PASS' : 'CHECK',
      objectives: got.map(g => g.objective_id).join(' '), types: got.map(g => g.source_type).join(' '),
      hits: got.map(g => g.hits).join(' '), scores: got.map(g => Number(g.score).toFixed(2)).join(' '),
      top_content: got[0]?.content?.slice(0, 120) ?? '', error: error?.message ?? '', human_judgement_relevant: '',
    })
    console.log(`${results.at(-1).pass.padEnd(5)} ${r.id}  [${r.expected}] -> ${got.length} rows ${results.at(-1).objectives}`)
  }
  const checks = results.filter(r => r.pass !== 'PASS').length
  console.log(`\n${results.length - checks}/${results.length} as expected. "CHECK" rows need a human look: a PASS can still be a wrong source.`)
  save('retrieval', results)
}

// ---------------- full Study Buddy run ----------------
async function runFull() {
  const preview = opt('preview').replace(/\/$/, '')
  if (!preview) { console.error('--preview=<Geofry preview URL> required'); process.exit(2) }
  if (!has('told-geofry')) { console.error('This spends free AI quota. Tell Geofry, then add --told-geofry.'); process.exit(2) }
  if (rows.length > MAX) { console.error(`${rows.length} questions > cap ${MAX}. Trim the CSV (or pass --max=N after agreeing with Geofry).`); process.exit(2) }

  let { token } = await anonSession()
  const results = []
  for (const r of rows) {
    let res, data
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(`${preview}/api/study-buddy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: r.question }),
      })
      data = await res.json().catch(() => ({ ok: false, error: 'non_json_response', message: `HTTP ${res.status} (preview protected? check Vercel deployment protection)` }))
      if (res.status === 401 && attempt === 0) { ({ token } = await anonSession()); continue } // contract: re-sign-in once
      break
    }
    const answer = data.answer || ''
    const sources = data.sources || []
    const ns = new Set(sources.map(s => s.n).filter(n => n != null))
    const markers = [...answer.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]))
    const outsideNotes = !!data.outside_notes
    const refusalCorrect = (r.expected === 'outside_notes') === outsideNotes
    const markersValid = markers.every(n => ns.has(n))
    const citedOk = outsideNotes ? true : (markers.length > 0 && markersValid && sources.every(s => !!s.source_url))
    results.push({
      id: r.id, asked_by: r.asked_by, question: r.question, expected: r.expected,
      http: res.status, ok: data.ok === true, error: data.error ?? '', outside_notes: outsideNotes,
      refusal_correct: data.ok ? refusalCorrect : '', auto_citation_check: data.ok ? citedOk : '',
      provider: data.provider ?? '', cached: data.cached ?? '',
      sources: sources.map(s => `${s.n ?? '-'}:${s.objective_id ?? ''}`).join(' '),
      answer, cited_correctly_human: '', answer_accurate_human: '', comments: '',
    })
    console.log(`${r.id}  HTTP ${res.status}  ${data.ok ? (outsideNotes ? 'outside_notes' : 'answered') : data.error}  refusal_ok=${data.ok ? refusalCorrect : '-'}  cite_ok=${data.ok ? citedOk : '-'}`)
    if (res.status === 429) { console.log('Daily limit hit - stopping. Tell Geofry.'); break }
    await sleep(SLEEP_MS)
  }
  save('full', results)
  console.log('Fill the *_human columns by checking each answer against its source; the auto checks only test structure.')
}

;(mode === 'retrieval' ? runRetrieval() : runFull()).catch(e => { console.error(e.message); process.exit(1) })
