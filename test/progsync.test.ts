import { describe, expect, it } from 'vitest';
import {
  LW_PROGRESS_CACHE_VERSION, lwEmptyProgressCache, lwNormProgressCache, lwProgressByWord,
  lwProgressCountOk, lwPutLocalProgress, lwPutProgressDocs, lwRemoveProgressDocs,
} from '../progsync.ts';

const doc = (wordId: string, updatedAt?: unknown, extra = {}) =>
  ({ id: 'u_' + wordId, wordId, userId: 'u', due: 1, reps: 1, lapses: 0, updatedAt, ...extra });

describe('lwNormProgressCache', () => {
  it('keeps a valid cache; anything else means "fill from scratch"', () => {
    const c = lwPutProgressDocs(lwEmptyProgressCache(), [doc('a', 5)]);
    expect(lwNormProgressCache(c)).toEqual(c);
    expect(lwNormProgressCache(null)).toBeNull();
    expect(lwNormProgressCache({ v: LW_PROGRESS_CACHE_VERSION + 1, docs: {}, since: 0 })).toBeNull();
    expect(lwNormProgressCache({ v: LW_PROGRESS_CACHE_VERSION, docs: {} })?.since).toBe(0);
  });
});

describe('lwPutProgressDocs', () => {
  it('stores docs with ms stamps and moves `since` to the latest', () => {
    const c = lwPutProgressDocs(lwEmptyProgressCache(), [
      doc('a', { toMillis: () => 100 }), doc('b', { seconds: 3, nanoseconds: 0 }), doc('old'),
    ]);
    expect(c.since).toBe(3000);
    expect(c.docs.u_a.updatedAt).toBe(100);
    expect(c.docs.u_old.updatedAt).toBeNull();
    expect(Object.keys(c.docs)).toEqual(['u_a', 'u_b', 'u_old']);
  });

  it('a newer copy replaces the old one; `since` never goes back', () => {
    let c = lwPutProgressDocs(lwEmptyProgressCache(), [doc('a', 500, { reps: 1 })]);
    c = lwPutProgressDocs(c, [doc('a', 900, { reps: 2 }), doc('b', 200)]);
    expect(c.docs.u_a.reps).toBe(2);
    expect(c.since).toBe(900);
    expect(lwPutProgressDocs(c, [])).toBe(c);
  });
});

describe('local writes and deletes', () => {
  const base = lwPutProgressDocs(lwEmptyProgressCache(), [doc('a', 500), doc('b', 600)]);

  it('a local answer shows at once and keeps `since` and the old stamp', () => {
    const c = lwPutLocalProgress(base, 'u_a', { ...doc('a'), reps: 7 } as never);
    expect(c.docs.u_a.reps).toBe(7);
    expect(c.docs.u_a.updatedAt).toBe(500);
    expect(c.since).toBe(600);
    expect(lwPutLocalProgress(base, 'u_new', doc('new') as never).docs.u_new.updatedAt).toBeNull();
  });

  it('removes docs; unknown ids change nothing', () => {
    expect(Object.keys(lwRemoveProgressDocs(base, ['u_a']).docs)).toEqual(['u_b']);
    expect(lwRemoveProgressDocs(base, ['zz'])).toBe(base);
  });
});

describe('views', () => {
  it('by word id, and the count check', () => {
    const c = lwPutProgressDocs(lwEmptyProgressCache(), [doc('a', 1), doc('a~forms', 2)]);
    expect(Object.keys(lwProgressByWord(c))).toEqual(['a', 'a~forms']);
    expect(lwProgressCountOk(2, c)).toBe(true);
    expect(lwProgressCountOk(3, c)).toBe(false);
  });
});
