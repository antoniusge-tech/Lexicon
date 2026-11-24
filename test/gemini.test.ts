import { describe, expect, it } from 'vitest';
import {
  LW_GEMINI_OVERLOAD_RETRY_MS, LW_GEMINI_URL, lwGeminiCall, lwGeminiHttpError, lwGeminiParse, lwGeminiRetryDelay,
} from '../gemini.ts';

const ok = (json: unknown) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(json) }] } }] });
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const keyError = { error: { message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } };
const rate = (delay: string) => ({ error: { message: 'Quota exceeded', details: [{ retryDelay: delay }] } });

/* a fake fetch that answers with the given responses in turn and records the calls */
function fakeFetch(...answers: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift();
    if (!a) throw new Error('no more answers');
    if (a instanceof Error) throw a;
    return a;
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const call = (f: ReturnType<typeof fakeFetch>, extra = {}) => {
  const waits: number[] = [];
  const p = lwGeminiCall({
    key: 'k123', system: 'sys', user: 'hi', schema: { type: 'OBJECT' },
    fetchFn: f.fn, sleep: async (ms) => { waits.push(ms); }, ...extra,
  });
  return { p, waits };
};

describe('lwGeminiCall', () => {
  it('sends the key in a header, not the URL, and returns the parsed JSON', async () => {
    const f = fakeFetch(response(200, ok({ tr: 'дом' })));
    const { p } = call(f, { config: { thinkingConfig: { thinkingBudget: 0 } } });
    expect(await p).toEqual({ tr: 'дом' });
    expect(f.calls[0].url).toBe(LW_GEMINI_URL);
    expect(f.calls[0].url).not.toContain('k123');
    expect((f.calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('k123');
    const body = JSON.parse(f.calls[0].init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.contents[0].parts[0].text).toBe('hi');
    expect(body.generationConfig).toEqual({
      thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' },
    });
  });

  it('without a key it fails before any request', async () => {
    const f = fakeFetch();
    await expect(call(f, { key: '' }).p).rejects.toMatchObject({ code: 'no-key' });
    expect(f.calls).toHaveLength(0);
  });

  it('retries once when the model is overloaded', async () => {
    const f = fakeFetch(response(503, {}), response(200, ok([1])));
    const { p, waits } = call(f);
    expect(await p).toEqual([1]);
    expect(waits).toEqual([LW_GEMINI_OVERLOAD_RETRY_MS]);
  });

  it('gives up after the second failure', async () => {
    const f = fakeFetch(response(503, {}), response(500, {}));
    await expect(call(f).p).rejects.toMatchObject({ code: 'overload' });
    expect(f.calls).toHaveLength(2);
  });

  it('waits out a short rate limit, but not a spent daily quota', async () => {
    const short = fakeFetch(response(429, rate('7s')), response(200, ok({})));
    const a = call(short);
    expect(await a.p).toEqual({});
    expect(a.waits).toEqual([7000]);

    const long = fakeFetch(response(429, rate('3600s')));
    await expect(call(long).p).rejects.toMatchObject({ code: 'quota' });
    expect(long.calls).toHaveLength(1);
  });

  it('a bad key is not retried', async () => {
    const f = fakeFetch(response(400, keyError));
    await expect(call(f).p).rejects.toMatchObject({ code: 'bad-key' });
    expect(f.calls).toHaveLength(1);
  });

  it('no network, and a hung request aborted by the timeout', async () => {
    await expect(call(fakeFetch(new TypeError('Failed to fetch'))).p)
      .rejects.toMatchObject({ code: 'network', message: 'Cannot reach Gemini.' });

    const hang = ((_url: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
    })) as unknown as typeof fetch;
    await expect(lwGeminiCall({ key: 'k', system: '', user: '', schema: {}, fetchFn: hang, timeoutMs: 10 }))
      .rejects.toMatchObject({ code: 'network', message: expect.stringContaining('too long') });
  });
});

describe('errors and parsing', () => {
  it('maps HTTP failures to UI codes', () => {
    expect(lwGeminiHttpError(400, keyError).code).toBe('bad-key');
    expect(lwGeminiHttpError(403, null).code).toBe('bad-key');
    // a malformed request is not the user's key
    const bad = lwGeminiHttpError(400, { error: { message: 'Invalid JSON payload' } });
    expect(bad.code).toBe('network');
    expect(bad.message).toContain('Invalid JSON payload');
    expect(lwGeminiHttpError(429, null).code).toBe('quota');
    expect(lwGeminiHttpError(500, null).code).toBe('overload');
    expect(lwGeminiHttpError(404, null).code).toBe('network');
  });

  it('retry delays', () => {
    expect(lwGeminiRetryDelay(503, null)).toBe(LW_GEMINI_OVERLOAD_RETRY_MS);
    expect(lwGeminiRetryDelay(429, rate('0.5s'))).toBe(500);
    expect(lwGeminiRetryDelay(429, rate('21s'))).toBeNull();
    expect(lwGeminiRetryDelay(429, null)).toBeNull();
    expect(lwGeminiRetryDelay(400, keyError)).toBeNull();
  });

  it('refusals, empty answers and broken JSON are refusals', () => {
    expect(() => lwGeminiParse({ candidates: [{ finishReason: 'SAFETY' }] })).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => lwGeminiParse({})).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => lwGeminiParse({ candidates: [{ content: { parts: [{ text: '' }] } }] })).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => lwGeminiParse({ candidates: [{ content: { parts: [{ text: '{oops' }] } }] })).toThrow(expect.objectContaining({ code: 'refusal' }));
  });
});
