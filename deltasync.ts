/* deltasync.ts — a device cache of a Firestore query whose docs carry
   `updatedAt` (server time): the user's progress, daily activity and the grammar
   lessons (pure, no Firestore, no React; lwWatchSince in firebase.js reads and writes).

   A fresh listener bills every doc of its query on each page load. Instead the
   device keeps the docs in IndexedDB with the latest updatedAt it has seen and
   listens only to docs changed after it. Docs written before updatedAt existed
   are read once, when the cache is filled, and stay until they change (then
   they get one). Docs that leave the query (deleted, or a lesson unpublished)
   aren't "changed since"; a count() check and a weekly full read catch them. */

import type { Progress } from './types.ts';
import { lwStampMs } from './wordsync.ts';

export type CachedDoc = { id: string; updatedAt?: number | null } & Record<string, unknown>;

export interface DeltaCache {
  v: number;
  /** docs by id, updatedAt as ms */
  docs: Record<string, CachedDoc>;
  /** latest updatedAt seen, ms; 0 before any */
  since: number;
  /** when everything was last read in full, ms */
  fullAt: number;
}

export const LW_DELTA_CACHE_VERSION = 1;
/** read everything again after this long, whatever the counts say */
export const LW_DELTA_FULL_EVERY_MS = 7 * 24 * 3600 * 1000;

export function lwEmptyDeltaCache(now = 0): DeltaCache {
  return { v: LW_DELTA_CACHE_VERSION, docs: {}, since: 0, fullAt: now };
}

/** a stored cache, or null if it is missing, broken or of another version
    (null means "fill it from scratch") */
export function lwNormDeltaCache(raw: unknown): DeltaCache | null {
  const c = raw as DeltaCache | null;
  if (!c || c.v !== LW_DELTA_CACHE_VERSION || !c.docs || typeof c.docs !== 'object') return null;
  return {
    v: c.v, docs: c.docs,
    since: Number.isFinite(c.since) ? c.since : 0,
    fullAt: Number.isFinite(c.fullAt) ? c.fullAt : 0,
  };
}

/** is a full read due (never done, or older than LW_DELTA_FULL_EVERY_MS)? */
export function lwDeltaFullDue(cache: DeltaCache, now: number): boolean {
  return now - cache.fullAt > LW_DELTA_FULL_EVERY_MS;
}

/** Docs read from Firestore go in (replacing older copies); `since` moves to the
    latest updatedAt among them. Timestamps become ms, so the cache can be stored.
    Only server timestamps move `since`: an older doc may hold updatedAt as a plain
    number (a device clock), which the "changed since" query never matches and
    which, from a clock running ahead, would hide later changes. */
export function lwPutDeltaDocs(cache: DeltaCache, docs: ({ id: string; updatedAt?: unknown } & Record<string, unknown>)[]): DeltaCache {
  if (!docs.length) return cache;
  const next = { ...cache.docs };
  let since = cache.since;
  docs.forEach((d) => {
    const stamp = lwStampMs(d.updatedAt);
    next[d.id] = { ...d, id: d.id, updatedAt: stamp };
    if (stamp != null && typeof d.updatedAt !== 'number' && stamp > since) since = stamp;
  });
  return { ...cache, docs: next, since };
}

/** this device's own write, shown before the server confirms it; `since` and the
    doc's old stamp stay, so the confirmed doc still comes back through the query */
export function lwPutLocalDoc(cache: DeltaCache, id: string, doc: Record<string, unknown>): DeltaCache {
  const old = cache.docs[id];
  return { ...cache, docs: { ...cache.docs, [id]: { ...doc, id, updatedAt: old ? old.updatedAt : null } } };
}

/** this device's counter write (merge + increment, the daily activity doc), shown
    before the server confirms it: `set` fields replace, `add` fields are added to
    what the cache holds (a doc not cached yet starts from 0). Like lwPutLocalDoc,
    `since` and the doc's stamp stay. */
export function lwBumpLocalDoc(cache: DeltaCache, id: string,
  set: Record<string, unknown>, add: Record<string, number>): DeltaCache {
  const old = cache.docs[id];
  const doc: Record<string, unknown> = { ...(old || {}), ...set };
  Object.entries(add).forEach(([k, v]) => {
    const had = old ? Number(old[k]) : 0;
    doc[k] = (Number.isFinite(had) ? had : 0) + v;
  });
  return { ...cache, docs: { ...cache.docs, [id]: { ...doc, id, updatedAt: old ? old.updatedAt : null } } };
}

export function lwRemoveDeltaDocs(cache: DeltaCache, ids: string[]): DeltaCache {
  if (!ids.some((id) => cache.docs[id])) return cache;
  const next = { ...cache.docs };
  ids.forEach((id) => { delete next[id]; });
  return { ...cache, docs: next };
}

export function lwDeltaCountOk(serverCount: number, cache: DeltaCache): boolean {
  return serverCount === Object.keys(cache.docs).length;
}

export function lwDeltaList(cache: DeltaCache): CachedDoc[] {
  return Object.values(cache.docs);
}

/** progress as App works with it: docs by word id */
export function lwProgressByWord(cache: DeltaCache): Record<string, Progress> {
  return Object.fromEntries(lwDeltaList(cache).map((p) => [p.wordId as string, p as unknown as Progress]));
}
