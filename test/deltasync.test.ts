import { describe, expect, it } from 'vitest';
import {
  LW_DELTA_CACHE_VERSION, LW_DELTA_FULL_EVERY_MS, lwDeltaCountOk, lwDeltaFullDue, lwDeltaList,
  lwBumpLocalDoc, lwEmptyDeltaCache, lwNormDeltaCache, lwProgressByWord, lwPutDeltaDocs, lwPutLocalDoc,
  lwRemoveDeltaDocs,
} from '../deltasync.ts';

const doc = (wordId: string, updatedAt?: unknown, extra = {}) =>
  ({ id: 'u_' + wordId, wordId, userId: 'u', due: 1, reps: 1, lapses: 0, updatedAt, ...extra });

describe('lwNormDeltaCache', () => {
  it('keeps a valid cache; anything else means "fill from scratch"', () => {
    const c = lwPutDeltaDocs(lwEmptyDeltaCache(7), [doc('a', 5)]);
    expect(lwNormDeltaCache(c)).toEqual(c);
    expect(lwNormDeltaCache(null)).toBeNull();
    expect(lwNormDeltaCache({ v: LW_DELTA_CACHE_VERSION + 1, docs: {}, since: 0, fullAt: 0 })).toBeNull();
  });

  it('a cache from before fullAt existed reads as never fully read', () => {
    const old = lwNormDeltaCache({ v: LW_DELTA_CACHE_VERSION, docs: {}, since: 9 });
    expect(old).toEqual({ v: LW_DELTA_CACHE_VERSION, docs: {}, since: 9, fullAt: 0 });
  });
});

describe('weekly full read', () => {
  it('is due when never done or a week old', () => {
    const now = 100 * LW_DELTA_FULL_EVERY_MS;
    expect(lwDeltaFullDue(lwEmptyDeltaCache(0), now)).toBe(true);
    expect(lwDeltaFullDue(lwEmptyDeltaCache(now - 1000), now)).toBe(false);
    expect(lwDeltaFullDue(lwEmptyDeltaCache(now - LW_DELTA_FULL_EVERY_MS - 1), now)).toBe(true);
  });
});

describe('lwPutDeltaDocs', () => {
  it('stores docs with ms stamps and moves `since` to the latest', () => {
    const c = lwPutDeltaDocs(lwEmptyDeltaCache(), [
      doc('a', { toMillis: () => 100 }), doc('b', { seconds: 3, nanoseconds: 0 }), doc('old'),
    ]);
    expect(c.since).toBe(3000);
    expect(c.docs.u_a.updatedAt).toBe(100);
    expect(c.docs.u_old.updatedAt).toBeNull();
    expect(Object.keys(c.docs)).toEqual(['u_a', 'u_b', 'u_old']);
  });

  it('a plain-number updatedAt (a device clock) is kept but never moves `since`', () => {
    const c = lwPutDeltaDocs(lwEmptyDeltaCache(), [doc('a', { toMillis: () => 100 }), doc('b', 99999)]);
    expect(c.docs.u_b.updatedAt).toBe(99999);
    expect(c.since).toBe(100);
  });

  it('a newer copy replaces the old one; `since` never goes back', () => {
    const ts = (ms: number) => ({ toMillis: () => ms });
    let c = lwPutDeltaDocs(lwEmptyDeltaCache(), [doc('a', ts(500), { reps: 1 })]);
    c = lwPutDeltaDocs(c, [doc('a', ts(900), { reps: 2 }), doc('b', ts(200))]);
    expect(c.docs.u_a.reps).toBe(2);
    expect(c.since).toBe(900);
    expect(lwPutDeltaDocs(c, [])).toBe(c);
  });
});

describe('local writes and deletes', () => {
  const base = lwPutDeltaDocs(lwEmptyDeltaCache(), [doc('a', { toMillis: () => 500 }), doc('b', { toMillis: () => 600 })]);

  it('a local write shows at once and keeps `since` and the old stamp', () => {
    const c = lwPutLocalDoc(base, 'u_a', { ...doc('a'), reps: 7 });
    expect(c.docs.u_a.reps).toBe(7);
    expect(c.docs.u_a.updatedAt).toBe(500);
    expect(c.since).toBe(600);
    expect(lwPutLocalDoc(base, 'u_new', doc('new')).docs.u_new.updatedAt).toBeNull();
  });

  it('a counter write adds to the cached fields and keeps the stamp', () => {
    const day = lwPutDeltaDocs(lwEmptyDeltaCache(), [{ id: 'u_d', date: 'd', answers: 4, xp: 40, updatedAt: { toMillis: () => 700 } }]);
    const c = lwBumpLocalDoc(day, 'u_d', { goalMet: true }, { answers: 1, xp: 10, ms: 500 });
    expect(c.docs.u_d).toMatchObject({ date: 'd', answers: 5, xp: 50, ms: 500, goalMet: true, updatedAt: 700 });
    expect(c.since).toBe(700);
    expect(day.docs.u_d.answers).toBe(4); // the old cache is not changed
  });

  it('a counter write on a day not cached yet starts from zero', () => {
    const c = lwBumpLocalDoc(lwEmptyDeltaCache(), 'u_new', { date: 'n' }, { answers: 1, correct: 0 });
    expect(c.docs.u_new).toEqual({ id: 'u_new', date: 'n', answers: 1, correct: 0, updatedAt: null });
  });

  it('removes docs; unknown ids change nothing', () => {
    expect(Object.keys(lwRemoveDeltaDocs(base, ['u_a']).docs)).toEqual(['u_b']);
    expect(lwRemoveDeltaDocs(base, ['zz'])).toBe(base);
  });
});

describe('views', () => {
  it('list, progress by word id, and the count check', () => {
    const c = lwPutDeltaDocs(lwEmptyDeltaCache(), [doc('a', 1), doc('a~forms', 2)]);
    expect(lwDeltaList(c).map((d) => d.id)).toEqual(['u_a', 'u_a~forms']);
    expect(Object.keys(lwProgressByWord(c))).toEqual(['a', 'a~forms']);
    expect(lwDeltaCountOk(2, c)).toBe(true);
    expect(lwDeltaCountOk(3, c)).toBe(false);
  });
});
