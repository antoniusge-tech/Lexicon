/* progsync.ts — the device cache of the user's own progress docs (pure, no
   Firestore, no React; firebase.js does the reading and writing).

   A user's progress grows with every word studied, and a fresh listener bills
   every doc on each page load. Every answer now writes `updatedAt` (server
   time), so the device keeps the docs in IndexedDB with the latest updatedAt it
   has seen and asks only for docs changed after it. Docs written before
   updatedAt existed are read once, when the cache is first filled, and stay
   until they change (then they get one). */

import type { Progress } from './types.ts';
import { lwStampMs } from './wordsync.ts';

export interface ProgressCache {
  v: number;
  /** progress docs by doc id (`<uid>_<wordId>`), updatedAt as ms */
  docs: Record<string, Progress & { id: string; updatedAt?: number | null }>;
  /** latest updatedAt seen, ms; 0 before any */
  since: number;
}

export const LW_PROGRESS_CACHE_VERSION = 1;

export function lwEmptyProgressCache(): ProgressCache {
  return { v: LW_PROGRESS_CACHE_VERSION, docs: {}, since: 0 };
}

/** a stored cache, or null if it is missing, broken or of another version
    (null means "fill it from scratch") */
export function lwNormProgressCache(raw: unknown): ProgressCache | null {
  const c = raw as ProgressCache | null;
  if (!c || c.v !== LW_PROGRESS_CACHE_VERSION || !c.docs || typeof c.docs !== 'object') return null;
  return { v: c.v, docs: c.docs, since: Number.isFinite(c.since) ? c.since : 0 };
}

/** Docs read from Firestore go in (replacing older copies); `since` moves to the
    latest updatedAt among them. Timestamps become ms, so the cache can be stored. */
export function lwPutProgressDocs(cache: ProgressCache, docs: ({ id: string; updatedAt?: unknown } & Record<string, unknown>)[]): ProgressCache {
  if (!docs.length) return cache;
  const next = { ...cache.docs };
  let since = cache.since;
  docs.forEach((d) => {
    const stamp = lwStampMs(d.updatedAt);
    next[d.id] = { ...(d as unknown as Progress), id: d.id, updatedAt: stamp };
    if (stamp != null && stamp > since) since = stamp;
  });
  return { ...cache, docs: next, since };
}

/** this device's own write, shown before the server confirms it; `since` stays,
    so the confirmed doc still comes back through the "changed since" query */
export function lwPutLocalProgress(cache: ProgressCache, id: string, doc: Progress): ProgressCache {
  const old = cache.docs[id];
  return { ...cache, docs: { ...cache.docs, [id]: { ...doc, id, updatedAt: old ? old.updatedAt : null } } };
}

export function lwRemoveProgressDocs(cache: ProgressCache, ids: string[]): ProgressCache {
  if (!ids.some((id) => cache.docs[id])) return cache;
  const next = { ...cache.docs };
  ids.forEach((id) => { delete next[id]; });
  return { ...cache, docs: next };
}

/** what App works with: progress docs by word id */
export function lwProgressByWord(cache: ProgressCache): Record<string, Progress> {
  return Object.fromEntries(Object.values(cache.docs).map((p) => [p.wordId, p]));
}

export function lwProgressCountOk(serverCount: number, cache: ProgressCache): boolean {
  return serverCount === Object.keys(cache.docs).length;
}
