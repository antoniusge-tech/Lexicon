/* wordsync.ts — the device cache of shared words, kept fresh by group stamps
   (pure, no Firestore, no React; firebase.js does the reading and writing).

   Shared words are the same for every user and change only when an admin edits
   them, but a fresh Firestore listener bills every one of them on each page
   load. So the device keeps them in IndexedDB grouped by their group, and each
   group carries `updatedAt`, bumped whenever one of its shared words is added,
   changed or deleted. On load the app reads only the groups (it watches them
   anyway) and re-reads the words of the groups whose stamp differs from the
   cached one. A re-read replaces the group's words, so deleted words go too. */

import type { Word } from './types.ts';

/** a group's updatedAt in ms; null when the group has none (older docs) or the
    stamp is a server timestamp still pending on this device */
export type Stamp = number | null;

export interface GroupWords {
  /** the group's stamp when its words were read */
  stamp: Stamp;
  words: Word[];
}

export interface SharedWordsCache {
  v: number;
  groups: Record<string, GroupWords>;
  /** server count of shared words minus cached ones, accepted after a full
      re-read (normally 0; >0 when shared words sit outside visible groups) */
  countOffset: number;
}

export const LW_WORDS_CACHE_VERSION = 1;

/** Firestore Timestamp, {seconds, nanoseconds}, ms or nothing → ms or null */
export function lwStampMs(v: unknown): Stamp {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

export function lwEmptyWordsCache(): SharedWordsCache {
  return { v: LW_WORDS_CACHE_VERSION, groups: {}, countOffset: 0 };
}

/** a stored cache, or an empty one if it is missing, broken or of another version */
export function lwNormWordsCache(raw: unknown): SharedWordsCache {
  const c = raw as SharedWordsCache | null;
  if (!c || c.v !== LW_WORDS_CACHE_VERSION || !c.groups || typeof c.groups !== 'object') return lwEmptyWordsCache();
  return { v: c.v, groups: c.groups, countOffset: Number.isInteger(c.countOffset) ? c.countOffset : 0 };
}

/** Which groups' words to (re)read and which cached groups to forget.
    A group is read when it isn't cached, or its stamp is known and differs from
    the cached one. A group without a stamp (older doc, or a pending local write)
    keeps its cached words. `all` re-reads every group. */
export function lwWordSyncPlan(groups: { id: string; stamp: Stamp }[], cache: SharedWordsCache, all = false) {
  const ids = new Set(groups.map((g) => g.id));
  const fetch = groups.filter((g) => {
    const c = cache.groups[g.id];
    return all || !c || (g.stamp != null && g.stamp !== c.stamp);
  }).map((g) => g.id);
  const drop = Object.keys(cache.groups).filter((id) => !ids.has(id));
  return { fetch, drop };
}

/** Groups this device stamped itself a moment ago already hold its own edit in
    the cache (lwPutCachedWord), so their new stamp is taken over without a
    re-read. Only cached groups qualify; a new one still has to be read. */
export function lwAdoptOwnStamps(fetch: string[], cache: SharedWordsCache, stampOf: Record<string, Stamp>,
  ownRecent: (groupId: string) => boolean): { fetch: string[]; cache: SharedWordsCache } {
  const adopt = fetch.filter((id) => cache.groups[id] && stampOf[id] != null && ownRecent(id));
  if (!adopt.length) return { fetch, cache };
  const groups = { ...cache.groups };
  adopt.forEach((id) => { groups[id] = { ...groups[id], stamp: stampOf[id] }; });
  return { fetch: fetch.filter((id) => !adopt.includes(id)), cache: { ...cache, groups } };
}

export function lwWithGroupWords(cache: SharedWordsCache, groupId: string, stamp: Stamp, words: Word[]): SharedWordsCache {
  return { ...cache, groups: { ...cache.groups, [groupId]: { stamp, words } } };
}

export function lwWithoutGroups(cache: SharedWordsCache, groupIds: string[]): SharedWordsCache {
  if (!groupIds.length) return cache;
  const groups = { ...cache.groups };
  groupIds.forEach((id) => { delete groups[id]; });
  return { ...cache, groups };
}

export function lwCachedWords(cache: SharedWordsCache): Word[] {
  return Object.values(cache.groups).flatMap((g) => g.words);
}

export function lwFindCachedWord(cache: SharedWordsCache | null, id: string): Word | null {
  if (!cache) return null;
  for (const g of Object.values(cache.groups)) {
    const w = g.words.find((x) => x.id === id);
    if (w) return w;
  }
  return null;
}

/** A word this device just wrote (shown before its group is re-read): taken out
    of whatever group held it and, if it is shared and its group is cached, put
    there. The group's stamp stays, so the coming stamp change re-reads it. */
export function lwPutCachedWord(cache: SharedWordsCache, word: Word): SharedWordsCache {
  const next = lwRemoveCachedWord(cache, word.id);
  const g = next.groups[word.groupId];
  if (!word.shared || !g) return next;
  return { ...next, groups: { ...next.groups, [word.groupId]: { ...g, words: [...g.words, word] } } };
}

export function lwRemoveCachedWord(cache: SharedWordsCache, id: string): SharedWordsCache {
  let changed = false;
  const groups: Record<string, GroupWords> = {};
  Object.entries(cache.groups).forEach(([gid, g]) => {
    const words = g.words.filter((w) => w.id !== id);
    if (words.length !== g.words.length) changed = true;
    groups[gid] = words.length !== g.words.length ? { ...g, words } : g;
  });
  return changed ? { ...cache, groups } : cache;
}

/** Does the server's count of shared words agree with the cache? */
export function lwWordsCountOk(serverCount: number, cache: SharedWordsCache): boolean {
  return serverCount - lwCachedWords(cache).length === cache.countOffset;
}

/** The words the app shows: the user's own plus the shared ones. A non-admin's
    own words come from their own query, so shared copies of them are skipped. */
export function lwMergeWords(own: Word[], shared: Word[], uid: string, isAdmin: boolean): Word[] {
  return isAdmin ? [...own, ...shared] : [...own, ...shared.filter((w) => w.userId !== uid)];
}
