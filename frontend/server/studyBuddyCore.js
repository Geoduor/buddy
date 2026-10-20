// Pure logic for Study Buddy (no network). Owner: Geofry.
import crypto from 'node:crypto';
import { SYSTEM_PROMPT } from './studyBuddyPrompt.js';

const LEARN_STUDY_GUIDE =
  'https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900';
const MIN_QUESTION_CHARS = 3;
const MAX_QUESTION_CHARS = 500;
const MAX_PASSAGE_CHARS = 1200;
const MAX_ANSWER_CHARS = 1500;

const MESSAGES = {
  outsideNotes:
    "That isn't covered in Buddy's verified notes yet, so I won't guess. Please check the official Microsoft Learn AZ-900 study guide.",
  ungrounded:
    "I couldn't build a reliable answer from Buddy's notes for that, so I won't guess. Please check the official Microsoft Learn AZ-900 study guide.",
};

// Stop learners (or notes) from breaking out of the <question>/<notes> tags.
function clean(text) {
  return String(text ?? '').replace(/[<>]/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function validateQuestion(body) {
  const q = body && typeof body === 'object' ? body.question : undefined;
  if (typeof q !== 'string') return { ok: false, message: 'Send a JSON body like {"question": "..."}' };
  const question = clean(q);
  if (question.length < MIN_QUESTION_CHARS) return { ok: false, message: 'The question is too short.' };
  if (question.length > MAX_QUESTION_CHARS)
    return { ok: false, message: `The question is too long (max ${MAX_QUESTION_CHARS} characters).` };
  return { ok: true, question };
}

function preparePassages(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 4).map((r) => ({
    source_type: r.source_type,
    source_id: r.source_id,
    objective_id: r.objective_id,
    objective_text: r.objective_text,
    title: r.title || '',
    content: clean(r.content).slice(0, MAX_PASSAGE_CHARS),
    source_url: r.source_url,
  }));
}

function buildPrompt(question, passages) {
  const notes = passages
    .map((p, i) => `[${i + 1}] (Objective ${p.objective_id}: ${clean(p.objective_text)})\n${p.title ? clean(p.title) + '\n' : ''}${p.content}`)
    .join('\n\n');
  const user = `<notes>\n${notes}\n</notes>\n\n<question>\n${question}\n</question>`;
  return { system: SYSTEM_PROMPT, user };
}

// Turn the model's text into a safe result. Anything without a valid citation is NOT shown as an answer.
function parseAnswer(rawText, passages) {
  const text = String(rawText ?? '').trim();
  if (!text || /NOT_IN_NOTES/i.test(text)) return { kind: 'not_in_notes' };

  const used = new Set();
  const answer = text
    .replace(/\[(\d+)\]/g, (m, d) => {
      const n = Number(d);
      if (n >= 1 && n <= passages.length) {
        used.add(n);
        return m;
      }
      return ''; // drop citation numbers that do not exist
    })
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, MAX_ANSWER_CHARS);

  if (used.size === 0) return { kind: 'ungrounded' };
  return { kind: 'ok', answer, used: [...used].sort((a, b) => a - b) };
}

function formatSources(passages, used) {
  return used.map((n) => {
    const p = passages[n - 1];
    return {
      n,
      objective_id: p.objective_id,
      objective_text: p.objective_text,
      source_type: p.source_type,
      title: p.title,
      source_url: p.source_url,
    };
  });
}

function learnSources() {
  return [{ n: null, title: 'AZ-900 study guide (Microsoft Learn)', source_url: LEARN_STUDY_GUIDE }];
}

function cacheKey(question, passages) {
  const norm = question.toLowerCase().replace(/\s+/g, ' ').trim();
  const ids = passages.map((p) => String(p.source_id)).sort().join(',');
  return crypto.createHash('sha256').update(`${norm}|${ids}`).digest('hex');
}

// Small in-memory cache. It lives only as long as the serverless instance, which is fine:
// it is a convenience (fewer AI calls, steadier demo), never a source of truth.
function createCache({ ttlMs = 6 * 60 * 60 * 1000, max = 200 } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { at: Date.now(), value });
    },
    get size() {
      return map.size;
    },
  };
}

export {
  LEARN_STUDY_GUIDE,
  MESSAGES,
  validateQuestion,
  preparePassages,
  buildPrompt,
  parseAnswer,
  formatSources,
  learnSources,
  cacheKey,
  createCache,
};
