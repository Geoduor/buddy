// AI provider calls with automatic fallback. Owner: Geofry. Keys are read from environment variables ONLY.
//   AI_PROVIDER = groq | gemini   (which to try first; the other is the backup)
//   GROQ_API_KEY, GEMINI_API_KEY, GROQ_MODEL, GEMINI_MODEL

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const MAX_OUTPUT_TOKENS = 700;

class ProviderError extends Error {
  constructor(provider, status, detail) {
    super(`${provider} failed (${status})`);
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

function providerOrder(env) {
  const keyFor = { groq: env.GROQ_API_KEY, gemini: env.GEMINI_API_KEY };
  const first = String(env.AI_PROVIDER || 'groq').toLowerCase();
  const all = ['groq', 'gemini'];
  const ordered = [first, ...all.filter((p) => p !== first)].filter((p) => p in keyFor);
  return ordered.filter((p) => Boolean(keyFor[p]));
}

async function callGroq({ system, user, env, fetchImpl, signal }) {
  const model = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
  };
  // These two options exist only for the gpt-oss models. Keep hidden reasoning short and out of the reply.
  if (model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = 'low';
    body.include_reasoning = false;
  }
  const res = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new ProviderError('groq', res.status, (await res.text()).slice(0, 200));
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError('groq', 'empty', 'no text in response');
  return { text, tokens: data?.usage?.total_tokens ?? null, model };
}

async function callGemini({ system, user, env, fetchImpl, signal }) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  // No temperature: Google's docs say newer Gemini models ignore it.
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }
  );
  if (!res.ok) throw new ProviderError('gemini', res.status, (await res.text()).slice(0, 200));
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p?.text).filter(Boolean).join('') : '';
  if (!text) throw new ProviderError('gemini', 'empty', 'no text in response');
  return { text, tokens: data?.usageMetadata?.totalTokenCount ?? null, model };
}

const CALLERS = { groq: callGroq, gemini: callGemini };

// Try the primary provider, then the backup. Returns { text, provider, model, tokens, attempts }.
async function generate({ system, user, env, fetchImpl = fetch, timeoutMs = 20000 }) {
  const order = providerOrder(env);
  const attempts = [];
  for (const provider of order) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const out = await CALLERS[provider]({ system, user, env, fetchImpl, signal: ctrl.signal });
      return { ...out, provider, attempts };
    } catch (err) {
      const status = err instanceof ProviderError ? err.status : err?.name === 'AbortError' ? 'timeout' : 'network';
      attempts.push({ provider, status });
      // Log the provider and status ONLY - never the key, the question or the response body.
      console.error(`[study-buddy] provider=${provider} failed status=${status}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error('all providers failed');
  error.attempts = attempts;
  throw error;
}

export { providerOrder, generate, ProviderError, DEFAULT_GROQ_MODEL, DEFAULT_GEMINI_MODEL };
