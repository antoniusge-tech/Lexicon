/* firebase-console.js — a small compat-style window.firebase for console scripts.
   scripts/*.mjs and the book files (books/ready/*.mjs) are run in the browser
   console and were written for the compat SDK: firebase.auth().currentUser,
   firebase.firestore().collection(…).doc(…).get()/set()/update()/delete(),
   .where(…).get(), batch() and snapshots with .exists, .data(), .ref.
   This wraps the modular SDK so they keep working. It covers only that subset;
   the app itself never uses it. */

import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

function lwConsoleFirebase(db, auth) {
  const wrapDoc = (d) => ({
    id: d.id,
    exists: d.exists(),
    data: () => d.data(),
    ref: wrapRef(d.ref),
  });
  const wrapSnap = (s) => ({
    docs: s.docs.map(wrapDoc),
    size: s.size,
    empty: s.empty,
    forEach: (fn) => s.docs.map(wrapDoc).forEach(fn),
  });

  function wrapRef(r) {
    return {
      _ref: r,
      id: r.id,
      get: async () => wrapDoc(await getDoc(r)),
      set: (data, opts) => (opts ? setDoc(r, data, opts) : setDoc(r, data)),
      update: (data) => updateDoc(r, data),
      delete: () => deleteDoc(r),
      collection: (name) => wrapCollection(collection(r, name)),
    };
  }

  function wrapQuery(q) {
    return {
      where: (field, op, value) => wrapQuery(query(q, where(field, op, value))),
      get: async () => wrapSnap(await getDocs(q)),
    };
  }

  function wrapCollection(c) {
    return { ...wrapQuery(c), doc: (id) => wrapRef(id ? doc(c, id) : doc(c)) };
  }

  const firestore = {
    collection: (name) => wrapCollection(collection(db, name)),
    batch: () => {
      const b = writeBatch(db);
      const api = {
        set: (r, data, opts) => { if (opts) b.set(r._ref, data, opts); else b.set(r._ref, data); return api; },
        update: (r, data) => { b.update(r._ref, data); return api; },
        delete: (r) => { b.delete(r._ref); return api; },
        commit: () => b.commit(),
      };
      return api;
    },
  };

  return {
    auth: () => auth, // auth.currentUser is the same object in both SDKs
    firestore: () => firestore,
  };
}

export { lwConsoleFirebase };
