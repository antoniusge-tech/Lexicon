/* gemini.ts — one structured-output call to Gemini (pure: no React, no
   Firestore, no localStorage; data.js passes the user's key and builds prompts).

   Every AI helper in data.js goes through lwGeminiCall: the key travels in the
   x-goog-api-key header (not in the URL, where it would end up in logs and
   history), a call that hangs is aborted after a timeout, and an overloaded
   model (500/503) or a short rate limit (429 with a retry delay of a few
   seconds) gets one more try. Failures are Errors with a `.code` the UI maps to
   a message (views/shared.jsx): 'no-key' | 'bad-key' | 'quota' | 'overload' |
   'refusal' | 'network'. */

/** an alias for the current flash model (free tier, fast) */
export const LW_GEMINI_MODEL = 'gemini-flash-latest';
export const LW_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/'
  + LW_GEMINI_MODEL + ':generateContent';
/** a call taking longer than this is aborted (long reading texts pass more) */
export const LW_GEMINI_TIMEOUT_MS = 90 * 1000;
/** wait before the one retry after a 500/503 */
export const LW_GEMINI_OVERLOAD_RETRY_MS = 2000;
/** a 429 is retried only if Gemini asks to wait at most this long (a per-minute
    limit); a longer wait means the daily quota is gone */
export const LW_GEMINI_MAX_RETRY_WAIT_MS = 20 * 1000;

export type LwAiCode = 'no-key' | 'bad-key' | 'quota' | 'overload' | 'refusal' | 'network' | 'empty';
export type LwAiError = Error & { code: LwAiCode };

export function lwAiError(code: LwAiCode, message: string): LwAiError {
  return Object.assign(new Error(message), { code });
}

type GeminiErrorBody = {
  error?: { message?: string; status?: string; details?: { reason?: string; retryDelay?: string }[] };
} | null | undefined;

const lwGeminiDetails = (body: GeminiErrorBody) => {
  const d = body && body.error && body.error.details;
  return Array.isArray(d) ? d.filter(Boolean) : [];
};

/** the failed response as an error the UI can name */
export function lwGeminiHttpError(status: number, body: GeminiErrorBody): LwAiError {
  const msg = (body && body.error && body.error.message) || '';
  const badKey = lwGeminiDetails(body).some((d) => d.reason === 'API_KEY_INVALID') || /api key/i.test(msg);
  // 400 is also a malformed request (a schema the model rejects); only a key
  // problem is the user's to fix
  if (status === 403 || (status === 400 && badKey)) return lwAiError('bad-key', 'Invalid Gemini key.');
  if (status === 429) return lwAiError('quota', 'Daily Gemini limit reached. Try again later.');
  if (status === 500 || status === 503) return lwAiError('overload', 'Gemini is overloaded. Try again in a minute.');
  return lwAiError('network', 'AI service error (' + status + ')' + (msg ? ': ' + msg : '.'));
}

/** how long to wait before retrying this failure, or null for no retry */
export function lwGeminiRetryDelay(status: number, body: GeminiErrorBody): number | null {
  if (status === 500 || status === 503) return LW_GEMINI_OVERLOAD_RETRY_MS;
  if (status !== 429) return null;
  const d = lwGeminiDetails(body).find((x) => typeof x.retryDelay === 'string');
  const sec = d ? parseFloat(d.retryDelay as string) : NaN; // "7s", "0.5s"
  if (!Number.isFinite(sec) || sec < 0) return null;
  const ms = Math.ceil(sec * 1000);
  return ms <= LW_GEMINI_MAX_RETRY_WAIT_MS ? ms : null;
}

type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
} | null | undefined;

/** the JSON the model returned, parsed; a refusal, an empty answer or broken
    JSON is a 'refusal' */
export function lwGeminiParse(data: GeminiResponse): unknown {
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    throw lwAiError('refusal', 'The model refused the request.');
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) throw lwAiError('refusal', 'Empty AI response.');
  try { return JSON.parse(text); }
  catch { throw lwAiError('refusal', 'AI returned an invalid response.'); }
}

export interface GeminiCall {
  key: string;
  system: string;
  user: string;
  /** responseSchema (Gemini's OpenAPI subset) */
  schema: unknown;
  /** more generationConfig, e.g. { thinkingConfig: { thinkingBudget: 0 } } */
  config?: Record<string, unknown>;
  timeoutMs?: number;
  /** for tests */
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** One structured-output call: system prompt + user text → the parsed JSON. */
export async function lwGeminiCall({
  key, system, user, schema, config, timeoutMs = LW_GEMINI_TIMEOUT_MS,
  fetchFn = (...a) => fetch(...a), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}: GeminiCall): Promise<unknown> {
  if (!key) throw lwAiError('no-key', 'No Gemini key set.');
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { ...(config || {}), responseMimeType: 'application/json', responseSchema: schema },
  });
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    let body: unknown;
    try {
      res = await fetchFn(LW_GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: payload,
        signal: ctrl.signal,
      });
      body = await res.json().catch(() => null);
    } catch {
      throw ctrl.signal.aborted
        ? lwAiError('network', 'Gemini took too long to answer. Try again.')
        : lwAiError('network', 'Cannot reach Gemini.');
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return lwGeminiParse(body as GeminiResponse);
    const wait = attempt === 0 ? lwGeminiRetryDelay(res.status, body as GeminiErrorBody) : null;
    if (wait == null) throw lwGeminiHttpError(res.status, body as GeminiErrorBody);
    await sleep(wait);
  }
}
