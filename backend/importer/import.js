#!/usr/bin/env node
/**
 * Buddy CSV importer  (owner: MARK)  backend/importer/import.js
 *
 * Imports question CSVs and notes CSVs as status='draft'. Never sets 'verified'
 * (verification is Geofry's checklist + the database rules).
 *
 * Usage (from backend/importer):
 *   npm install
 *   node import.js --dry-run                         # validate everything, write nothing
 *   node import.js                                   # all of content/questions + content/notes
 *   node import.js ../../content/questions/jess_D1.1.csv
 *
 * Env (repo-root .env on YOUR laptop only; never commit, never on Vercel):
 *   SUPABASE_URL, SUPABASE_SECRET_KEY   (sb_secret_...)
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

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const forcedType = (argv.find(a => a.startsWith('--type=')) || '').split('=')[1]
let files = argv.filter(a => !a.startsWith('--'))

const listCsv = dir => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => f.endsWith('.csv') && !f.startsWith('_')).map(f => path.join(dir, f))
  : []
if (!files.length) files = [...listCsv(path.join(ROOT, 'content/questions')), ...listCsv(path.join(ROOT, 'content/notes'))]
files = files.filter(f => !path.basename(f).startsWith('_')) // never import templates

// ---------- helpers ----------
const normHeader = h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '')
const normText = s => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const wordCount = s => (s.trim().match(/\S+/g) || []).length

// Accepted header spellings (normalised: lowercase, letters/digits only).
const Q_SPEC = {
  objective_id: ['objectiveid'],
  stem: ['questiontext', 'question', 'stem'],
  A: ['optiona', 'a', 'answera', 'choicea'],
  B: ['optionb', 'b', 'answerb', 'choiceb'],
  C: ['optionc', 'c', 'answerc', 'choicec'],
  D: ['optiond', 'd', 'answerd', 'choiced'],
  correct: ['correct', 'correctanswer', 'correctoption'],
  explanation: ['explanation', 'whycorrect'],
  whyA: ['whyawrong', 'whywronga'],
  whyB: ['whybwrong', 'whywrongb'],
  whyC: ['whycwrong', 'whywrongc'],
  whyD: ['whydwrong', 'whywrongd'],
  source_url: ['sourceurl', 'source'],
  author: ['author'],
  notes: ['notes'],
}
const Q_REQUIRED = ['objective_id', 'stem', 'A', 'B', 'C', 'D', 'correct', 'source_url']
const N_SPEC = {
  objective_id: ['objectiveid'], body: ['body'], source_url: ['sourceurl', 'source'],
  author: ['author'], notes: ['notes'],
}
const N_REQUIRED = ['objective_id', 'body', 'source_url']

function mapColumns(header, spec) {
  const norm = header.map(normHeader)
  const map = {}
  for (const [field, aliases] of Object.entries(spec)) {
    const i = norm.findIndex(h => aliases.includes(h))
    if (i >= 0) map[field] = i
  }
  return map
}

function loadObjectiveIds() {
  const p = path.join(ROOT, 'content/objectives.json')
  const ids = new Set()
  const walk = n => {
    if (Array.isArray(n)) n.forEach(walk)
    else if (n && typeof n === 'object') {
      if (typeof n.id === 'string' && /^D\d+\.\d+\.\d+$/.test(n.id)) ids.add(n.id)
      Object.values(n).forEach(walk)
    }
  }
  walk(JSON.parse(fs.readFileSync(p, 'utf8')))
  if (!ids.size) throw new Error('No objective ids like D1.1.2 found in content/objectives.json - check its structure.')
  return ids
}

async function fetchAll(db, table, column) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(column).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data.map(r => r[column]))
    if (data.length < 1000) break
  }
  return out
}

// ---------- main ----------
const log = { err: (f, r, m) => console.log(`  ERROR  ${path.basename(f)} row ${r}: ${m}`),
              warn: (f, r, m) => console.log(`  warn   ${path.basename(f)} row ${r}: ${m}`),
              skip: (f, r, m) => console.log(`  skip   ${path.basename(f)} row ${r}: ${m}`) }

async function main() {
  if (!files.length) { console.log('No CSV files found.'); return 0 }
  const objectiveIds = loadObjectiveIds()

  let db = null
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
  if (url && key) {
    if (key.startsWith('sb_publishable_')) console.log('warn: that is the PUBLISHABLE key; inserts will be blocked by Row Level Security.')
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  } else if (!DRY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in the repo-root .env. (Use --dry-run to validate only.)')
    return 2
  } else console.log('warn: no Supabase credentials - duplicate check against the database is skipped.\n')

  const existing = { questions: new Set(), notes: new Set() }
  if (db) {
    (await fetchAll(db, 'questions', 'stem')).forEach(s => existing.questions.add(normText(s)))
    ;(await fetchAll(db, 'notes', 'body')).forEach(s => existing.notes.add(normText(s)))
  }
  const seen = { questions: new Set(), notes: new Set() }
  const totals = { ok: 0, errors: 0, skipped: 0, inserted: 0, failed: 0 }
  const toInsert = { questions: [], notes: [] }

  for (const file of files) {
    console.log(`\n${path.relative(ROOT, file)}`)
    let rows
    try {
      rows = parse(fs.readFileSync(file, 'utf8'), { bom: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    } catch (e) { console.log(`  ERROR  cannot read CSV: ${e.message}`); totals.errors++; continue }
    if (rows.length < 2) { console.log('  (no data rows)'); continue }

    const header = rows[0]
    const type = forcedType
      || (/[\\/]notes[\\/]/.test(file) ? 'notes' : /[\\/]questions[\\/]/.test(file) ? 'questions'
      : header.map(normHeader).includes('body') ? 'notes' : 'questions')
    const spec = type === 'notes' ? N_SPEC : Q_SPEC
    const required = type === 'notes' ? N_REQUIRED : Q_REQUIRED
    const col = mapColumns(header, spec)
    const missing = required.filter(f => !(f in col))
    if (missing.length) {
      console.log(`  ERROR  missing/unrecognised columns: ${missing.join(', ')}\n         headers found: ${header.join(' | ')}`)
      totals.errors++; continue
    }

    // filename convention: <author>_<group>.csv
    const m = path.basename(file).match(/^([A-Za-z]+)_(D\d+\.\d+)\.csv$/)
    if (!m) log.warn(file, '-', 'filename should look like <author>_<group-id>.csv (e.g. jess_D1.1.csv)')

    rows.slice(1).forEach((r, idx) => {
      const rowNo = idx + 2
      const get = f => (f in col ? (r[col[f]] ?? '').toString().trim() : '')
      const errs = []

      if (r.some(c => /EXAMPLE-DELETE-ME/i.test(c))) { log.err(file, rowNo, 'leftover EXAMPLE-DELETE-ME row - delete it'); totals.errors++; return }

      const objective_id = get('objective_id')
      if (!objectiveIds.has(objective_id)) errs.push(`objective_id "${objective_id}" is not in objectives.json (use the full id like D1.1.2)`)
      else if (m && objective_id.split('.').slice(0, 2).join('.') !== m[2]) errs.push(`objective_id ${objective_id} does not belong to group ${m[2]} named in the filename`)

      const source_url = get('source_url')
      try {
        const u = new URL(source_url)
        if (u.protocol !== 'https:') errs.push('source_url must be https')
        else if (u.hostname !== 'learn.microsoft.com') log.warn(file, rowNo, `source_url is not learn.microsoft.com (${u.hostname}) - is that intended?`)
      } catch { errs.push('source_url is missing or not a valid URL (no URL = cannot be verified)') }

      const author = get('author') || (m ? m[1].toLowerCase() : '')
      if (m && get('author') && get('author').toLowerCase() !== m[1].toLowerCase()) log.warn(file, rowNo, `author "${get('author')}" differs from filename author "${m[1]}"`)
      if (!author) errs.push('author missing (and not derivable from the filename)')

      let record, key
      if (type === 'notes') {
        const body = get('body')
        if (!body) errs.push('body is empty')
        const wc = wordCount(body)
        if (body && (wc < 60 || wc > 150)) log.warn(file, rowNo, `body is ${wc} words (guideline: 60-150)`)
        key = normText(body)
        record = { objective_id, body, source_url, author, status: 'draft', notes: get('notes') || null }
      } else {
        const stem = get('stem')
        const options = ['A', 'B', 'C', 'D'].map(get)
        if (!stem) errs.push('question text is empty')
        if (options.some(o => !o)) errs.push('all four options (A-D) must be filled')
        else if (new Set(options.map(normText)).size < 4) errs.push('options must be four different answers')
        const c = get('correct').toUpperCase()
        if (!/^[ABCD]$/.test(c)) errs.push(`correct must be exactly A, B, C or D (got "${get('correct')}")`)
        const correct_index = 'ABCD'.indexOf(c)
        const explanation = get('explanation')
        if (!explanation) log.warn(file, rowNo, 'explanation is empty (needed before it can be verified)')
        let why_wrong = ['A', 'B', 'C', 'D'].map((l, i) => (i === correct_index ? null : get('why' + l) || null))
        if (correct_index >= 0 && get('why' + c)) log.warn(file, rowNo, `why_${c.toLowerCase()}_wrong is filled but ${c} is the correct option - ignored`)
        if (why_wrong.some((w, i) => i !== correct_index && !w)) log.warn(file, rowNo, 'some wrong options have no "why wrong" text')
        if (why_wrong.every(w => !w)) why_wrong = null
        key = normText(stem)
        record = { objective_id, stem, options, correct_index, explanation: explanation || null, why_wrong, source_url, author, status: 'draft', notes: get('notes') || null }
      }

      if (errs.length) { errs.forEach(e => log.err(file, rowNo, e)); totals.errors++; return }
      if (existing[type].has(key)) { log.skip(file, rowNo, 'already in the database (duplicate text)'); totals.skipped++; return }
      if (seen[type].has(key)) { log.err(file, rowNo, 'duplicate text already appears earlier in this import'); totals.errors++; return }
      seen[type].add(key)
      toInsert[type].push({ record, file, rowNo })
      totals.ok++
    })
  }

  console.log(`\nValidation: ${totals.ok} valid, ${totals.errors} errors, ${totals.skipped} already imported.`)
  if (DRY) { console.log('Dry run - nothing written.'); return totals.errors ? 1 : 0 }

  for (const type of ['questions', 'notes']) {
    const items = toInsert[type]
    for (let i = 0; i < items.length; i += 50) {
      const chunk = items.slice(i, i + 50)
      const { error } = await db.from(type).insert(chunk.map(c => c.record))
      if (!error) { totals.inserted += chunk.length; continue }
      for (const c of chunk) { // find the row the database refused
        const { error: e } = await db.from(type).insert(c.record)
        if (e) { log.err(c.file, c.rowNo, `database refused: ${e.message}`); totals.failed++ } else totals.inserted++
      }
    }
  }
  console.log(`Inserted ${totals.inserted} draft rows. Database refused ${totals.failed}.`)
  return totals.errors || totals.failed ? 1 : 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e.message); process.exit(2) })
