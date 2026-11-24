/* idb-cache.js — a tiny key-value store in IndexedDB for data the device keeps
   between visits (the shared words cache, wordsync.ts). Values are structured
   clones, so plain objects and arrays. Every call resolves, never throws: with
   no IndexedDB (private mode, old browser, Node) get gives null and set does
   nothing, and the app simply reads from Firestore as before. */

const LW_IDB_NAME = 'lexicon-cache';
const LW_IDB_STORE = 'kv';

let lwIdbOpen = null;
function lwIdb() {
  if (!lwIdbOpen) {
    lwIdbOpen = new Promise((resolve) => {
      try {
        const req = indexedDB.open(LW_IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(LW_IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return lwIdbOpen;
}

function lwIdbRun(mode, fn) {
  return lwIdb().then((db) => new Promise((resolve) => {
    if (!db) { resolve(null); return; }
    try {
      const req = fn(db.transaction(LW_IDB_STORE, mode).objectStore(LW_IDB_STORE));
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

const lwCacheGet = (key) => lwIdbRun('readonly', (store) => store.get(key));
const lwCacheSet = (key, value) => lwIdbRun('readwrite', (store) => store.put(value, key));

export { lwCacheGet, lwCacheSet };
