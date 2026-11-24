import { describe, expect, it } from 'vitest';
import type { Word } from '../types.ts';
import {
  LW_WORDS_CACHE_VERSION, lwAdoptOwnStamps, lwCachedWords, lwEmptyWordsCache, lwFindCachedWord, lwMergeWords,
  lwNormWordsCache, lwPutCachedWord, lwRemoveCachedWord, lwStampMs, lwWithGroupWords, lwWithoutGroups,
  lwWordSyncPlan, lwWordsCountOk, type SharedWordsCache,
} from '../wordsync.ts';

const w = (id: string, groupId: string, extra: Partial<Word> = {}): Word =>
  ({ id, groupId, word: id, userId: 'admin', shared: true, ...extra }) as Word;

function cacheOf(groups: Record<string, [number | null, Word[]]>): SharedWordsCache {
  let c = lwEmptyWordsCache();
  Object.entries(groups).forEach(([gid, [stamp, words]]) => { c = lwWithGroupWords(c, gid, stamp, words); });
  return c;
}

describe('stamps', () => {
  it('reads Firestore timestamps, plain objects and ms', () => {
    expect(lwStampMs({ toMillis: () => 1234 })).toBe(1234);
    expect(lwStampMs({ seconds: 2, nanoseconds: 5_000_000 })).toBe(2005);
    expect(lwStampMs(99)).toBe(99);
    expect(lwStampMs(null)).toBeNull();
    expect(lwStampMs(undefined)).toBeNull();
  });
});

describe('lwNormWordsCache', () => {
  it('keeps a valid cache and replaces anything else', () => {
    const c = cacheOf({ g1: [1, [w('a', 'g1')]] });
    expect(lwNormWordsCache(c)).toEqual(c);
    expect(lwNormWordsCache(null)).toEqual(lwEmptyWordsCache());
    expect(lwNormWordsCache({ v: LW_WORDS_CACHE_VERSION + 1, groups: {} })).toEqual(lwEmptyWordsCache());
    expect(lwNormWordsCache({ v: LW_WORDS_CACHE_VERSION, groups: {} }).countOffset).toBe(0);
  });
});

describe('lwWordSyncPlan', () => {
  const cache = cacheOf({ same: [10, []], changed: [10, []], nostamp: [10, []], gone: [10, []] });

  it('reads new and changed groups, keeps unchanged ones, forgets removed ones', () => {
    const plan = lwWordSyncPlan([
      { id: 'same', stamp: 10 }, { id: 'changed', stamp: 20 }, { id: 'new', stamp: 5 }, { id: 'nostamp', stamp: null },
    ], cache);
    expect(plan.fetch).toEqual(['changed', 'new']);
    expect(plan.drop).toEqual(['gone']);
  });

  it('a group without a stamp is read once, then kept', () => {
    expect(lwWordSyncPlan([{ id: 'x', stamp: null }], lwEmptyWordsCache()).fetch).toEqual(['x']);
    expect(lwWordSyncPlan([{ id: 'x', stamp: null }], cacheOf({ x: [null, []] })).fetch).toEqual([]);
  });

  it('`all` re-reads every group', () => {
    expect(lwWordSyncPlan([{ id: 'same', stamp: 10 }, { id: 'nostamp', stamp: null }], cache, true).fetch)
      .toEqual(['same', 'nostamp']);
  });
});

describe('lwAdoptOwnStamps', () => {
  it('takes over the new stamp of a cached group this device just stamped, reads the rest', () => {
    const cache = cacheOf({ mine: [1, [w('a', 'mine')]], other: [1, []] });
    const r = lwAdoptOwnStamps(['mine', 'other', 'fresh'], cache, { mine: 9, other: 9, fresh: 9 },
      (id) => id === 'mine' || id === 'fresh');
    expect(r.fetch).toEqual(['other', 'fresh']); // 'fresh' isn't cached, so it is read
    expect(r.cache.groups.mine).toEqual({ stamp: 9, words: [w('a', 'mine')] });
    expect(r.cache.groups.other.stamp).toBe(1);
  });

  it('changes nothing when no group qualifies', () => {
    const cache = cacheOf({ g: [1, []] });
    const r = lwAdoptOwnStamps(['g'], cache, { g: 2 }, () => false);
    expect(r).toEqual({ fetch: ['g'], cache });
  });
});

describe('cache edits', () => {
  const base = cacheOf({ g1: [1, [w('a', 'g1'), w('b', 'g1')]], g2: [2, [w('c', 'g2')]] });

  it('lists, finds and drops', () => {
    expect(lwCachedWords(base).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(lwFindCachedWord(base, 'c')?.groupId).toBe('g2');
    expect(lwFindCachedWord(base, 'z')).toBeNull();
    expect(lwCachedWords(lwWithoutGroups(base, ['g1'])).map((x) => x.id)).toEqual(['c']);
  });

  it('a re-read replaces the group, so deleted words go', () => {
    const c = lwWithGroupWords(base, 'g1', 3, [w('a', 'g1')]);
    expect(lwCachedWords(c).map((x) => x.id)).toEqual(['a', 'c']);
    expect(c.groups.g1.stamp).toBe(3);
  });

  it('a local edit moves the word and keeps the stamps', () => {
    const moved = lwPutCachedWord(base, w('a', 'g2', { word: 'A' }));
    expect(moved.groups.g1.words.map((x) => x.id)).toEqual(['b']);
    expect(moved.groups.g2.words.map((x) => x.word)).toEqual(['c', 'A']);
    expect(moved.groups.g1.stamp).toBe(1);
    expect(moved.groups.g2.stamp).toBe(2);
  });

  it('a local word in an uncached group, or a private one, leaves only the removal', () => {
    expect(lwCachedWords(lwPutCachedWord(base, w('a', 'g9'))).map((x) => x.id)).toEqual(['b', 'c']);
    expect(lwCachedWords(lwPutCachedWord(base, w('a', 'g1', { shared: false }))).map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('removes a word; removing an unknown one changes nothing', () => {
    expect(lwCachedWords(lwRemoveCachedWord(base, 'b')).map((x) => x.id)).toEqual(['a', 'c']);
    expect(lwRemoveCachedWord(base, 'zz')).toBe(base);
  });
});

describe('count check and merge', () => {
  it('compares the server count with the cache, allowing the accepted offset', () => {
    const c = cacheOf({ g1: [1, [w('a', 'g1'), w('b', 'g1')]] });
    expect(lwWordsCountOk(2, c)).toBe(true);
    expect(lwWordsCountOk(3, c)).toBe(false);
    expect(lwWordsCountOk(3, { ...c, countOffset: 1 })).toBe(true);
  });

  it('an admin sees own + all shared; a user skips shared copies of their own words', () => {
    const own = [w('o', 'g1', { userId: 'u', shared: false })];
    const shared = [w('s', 'g1'), w('mine', 'g1', { userId: 'u' })];
    expect(lwMergeWords(own, shared, 'u', true).map((x) => x.id)).toEqual(['o', 's', 'mine']);
    expect(lwMergeWords(own, shared, 'u', false).map((x) => x.id)).toEqual(['o', 's']);
  });
});
