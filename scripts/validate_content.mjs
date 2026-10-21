// Buddy content validator (owner: Geofry). Zero dependencies, Node 18+.
//   node scripts/validate_content.mjs            checks content/questions/*.csv and content/notes/*.csv
//   node scripts/validate_content.mjs path.csv   checks specific files
// Exit code 1 if any ERROR. Warnings never fail. Run by GitHub on every pull request.
// It only checks FORMAT. It cannot check that a fact is true: that is the human second-reviewer's job.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outlinePath = ['content/objectives.json', 'objectives.json'].map((p) => join(root, p)).find((p) => existsSync(p));
if (!outlinePath) { console.error('objectives.json not found (expected content/objectives.json)'); process.exit(1); }
const outline = JSON.parse(readFileSync(outlinePath, 'utf8'));
const objectiveIds = new Set();
const groupIds = new Set();
for (const d of outline.domains) for (const g of d.groups) { groupIds.add(g.id); for (const o of g.objectives) objectiveIds.add(o.id); }

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.filter((r) => r.some((x) => x.trim() !== '')), unterminated: q };
}

const QUESTION_HEADER = 'objective_id,objective_text,stem,option_a,option_b,option_c,option_d,correct,why_correct,why_a_wrong,why_b_wrong,why_c_wrong,why_d_wrong,source_url,author,status,notes'.split(',');
const NOTE_HEADER = 'objective_id,body,source_url,author,status,notes'.split(',');
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const realUrl = (u) => /^https:\/\/learn\.microsoft\.com\/\S+$/i.test(u) && !/paste|example/i.test(u);

export function validateFile(file, text, seen = new Set()) {
  const errors = [], warnings = [];
  const kind = file.replace(/\\/g, '/').includes('/notes/') ? 'notes' : 'questions';
  const name = basename(file, '.csv');
  const m = /^([a-z0-9-]+)_(D\d(?:\.\d+)?|all)$/i.exec(name);
  if (!m) warnings.push(`file name should be <author>_<group>.csv, e.g. jess_D1.1.csv (got "${basename(file)}")`);
  else if (m[2] !== 'all' && m[2].includes('.') && !groupIds.has(m[2])) errors.push(`file name group "${m[2]}" is not in objectives.json`);

  const { rows, unterminated } = parseCsv(text);
  if (unterminated) errors.push('a quote (") is never closed: the file is damaged or a cell has an unescaped quote');
  if (!rows.length) { errors.push('file is empty'); return { errors, warnings, count: 0 }; }
  const header = rows[0].map((h) => h.trim());
  const want = kind === 'questions' ? QUESTION_HEADER : NOTE_HEADER;
  if (header.join() !== want.join()) {
    errors.push(`header does not match the template. Expected: ${want.join(',')}`);
    return { errors, warnings, count: 0 };
  }
  let count = 0;
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const r = Object.fromEntries(want.map((h, i) => [h, (cells[i] ?? '').trim()]));
    const e = (msg) => errors.push(`row ${line}: ${msg}`);
    const w = (msg) => warnings.push(`row ${line}: ${msg}`);
    if (cells.length !== want.length) e(`has ${cells.length} columns, expected ${want.length} (a comma inside a cell must be wrapped in quotes)`);
    if (/^EXAMPLE/i.test(r.objective_id)) return e('this is the template example row: delete it');
    count++;
    if (!objectiveIds.has(r.objective_id)) e(`objective_id "${r.objective_id}" is not in objectives.json (use IDs like D1.1.2)`);
    else if (m && m[2].includes('.') && !r.objective_id.startsWith(m[2] + '.')) w(`objective ${r.objective_id} is outside the group in the file name (${m[2]})`);
    if (!r.source_url) e('source_url is empty: no URL means it cannot be verified');
    else if (!realUrl(r.source_url)) e('source_url must be a real https://learn.microsoft.com/... page you read');
    if (!r.author) e('author is empty');
    else if (m && r.author.toLowerCase() !== m[1].toLowerCase()) w(`author "${r.author}" differs from the file name "${m[1]}"`);
    if (r.status && r.status.toLowerCase() !== 'draft') e('status must be "draft" (only the second reviewer verifies, in the database)');
    if (/needs check/i.test(r.notes)) w('marked NEEDS CHECK: resolve before review');
    if (kind === 'questions') {
      if (r.stem.length < 15) e('stem is missing or too short');
      const opts = ['a', 'b', 'c', 'd'].map((x) => r['option_' + x]);
      if (opts.some((o) => !o)) e('all four options (option_a to option_d) must be filled in');
      else if (new Set(opts.map(norm)).size < 4) e('two options are identical');
      if (!/^[A-D]$/.test(r.correct)) e(`correct must be a single capital letter A, B, C or D (got "${r.correct}")`);
      if (!r.why_correct) e('why_correct (the explanation) is empty');
      if (/^(replace|write)/i.test(r.why_correct) || /replace with/i.test(Object.values(r).join(' '))) e('template placeholder text is still in the row');
      if (/^[A-D]$/.test(r.correct)) {
        const ci = 'ABCD'.indexOf(r.correct);
        ['a', 'b', 'c', 'd'].forEach((x, i) => {
          const wr = r['why_' + x + '_wrong'];
          if (i === ci && wr) w(`why_${x}_wrong is filled but ${x.toUpperCase()} is the correct answer: leave it empty`);
          if (i !== ci && !wr) w(`why_${x}_wrong is empty: learners get a worse explanation`);
        });
      }
      if (/\b(all|none) of the above\b/i.test(opts.join(' '))) w('avoid "all/none of the above" options');
      const key = norm(r.stem);
      if (seen.has('q:' + key)) e('the same question text appears twice'); seen.add('q:' + key);
    } else {
      const words = r.body.split(/\s+/).filter(Boolean).length;
      if (words < 40) e(`body is only ${words} words: write 60 to 150 words`);
      else if (words < 60 || words > 150) w(`body is ${words} words: aim for 60 to 150`);
      if (/^(example|write)/i.test(r.body)) e('template placeholder text is still in the row');
      const key = norm(r.body);
      if (seen.has('n:' + key)) e('the same note appears twice'); seen.add('n:' + key);
    }
  });
  if (count === 0 && !errors.length) warnings.push('no data rows');
  return { errors, warnings, count };
}

function listCsv(dir) {
  const p = join(root, dir);
  return existsSync(p) ? readdirSync(p).filter((f) => f.endsWith('.csv') && !f.startsWith('_') && !/template/i.test(f)).map((f) => join(p, f)) : [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : [...listCsv('content/questions'), ...listCsv('content/notes')];
  let bad = 0, total = 0; const seen = new Set();
  if (!files.length) console.log('No content CSV files yet: nothing to check.');
  for (const f of files) {
    const res = validateFile(f, readFileSync(f, 'utf8'), seen);
    total += res.count; bad += res.errors.length;
    console.log(`\n${res.errors.length ? 'FAIL' : 'ok  '}  ${f}  (${res.count} rows)`);
    res.errors.forEach((x) => console.log(`   ERROR   ${x}`));
    res.warnings.forEach((x) => console.log(`   warning ${x}`));
  }
  console.log(bad ? `\n${bad} error(s). Fix them and push again.\n` : `\nAll good: ${total} rows checked.\n`);
  process.exit(bad ? 1 : 0);
}
