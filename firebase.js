/* firebase.js — Firebase init + per-user Firestore data layer + auth */

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, deleteUser, getAuth,
  linkWithPopup, onAuthStateChanged, reauthenticateWithCredential, reauthenticateWithPopup,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut,
  unlink,
} from 'firebase/auth';
import {
  collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, getFirestore, increment,
  initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, query,
  serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { lwCurrentLang, lwRoIpa } from './data.js';
import { lwCacheGet, lwCacheSet } from './idb-cache.js';
import {
  lwDeltaCountOk, lwDeltaFullDue, lwDeltaList, lwEmptyDeltaCache, lwNormDeltaCache,
  lwProgressByWord, lwPutDeltaDocs, lwPutLocalDoc, lwRemoveDeltaDocs,
} from './deltasync.ts';
import {
  lwCachedWords, lwEmptyWordsCache, lwFindCachedWord, lwMergeWords, lwNormWordsCache,
  lwAdoptOwnStamps, lwPutCachedWord, lwRemoveCachedWord, lwStampMs, lwWithGroupWords, lwWithoutGroups,
  lwWordSyncPlan, lwWordsCountOk,
} from './wordsync.ts';
import { lwConsoleFirebase } from './firebase-console.js';

const LW_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAFNfL2zqb5jqhEzTHVYzQx0DLQfCHpt14',
  authDomain: 'lexicon-a0553.firebaseapp.com',
  projectId: 'lexicon-a0553',
  storageBucket: 'lexicon-a0553.firebasestorage.app',
  messagingSenderId: '1004533576564',
  appId: '1:1004533576564:web:3033728131c095ce0cb221',
};

/* getApps() and the getFirestore() fallback are only for Vite hot updates in dev,
   which re-run this module in a page where Firebase is already initialised. */
const lwApp = getApps().length ? getApp() : initializeApp(LW_FIREBASE_CONFIG);
/* Offline cache: reads come from IndexedDB and writes queue up while the network
   is gone, then sync; open tabs share it. Where IndexedDB is unavailable the SDK
   logs a warning and keeps working with a memory cache. */
const lwDb = (() => {
  try {
    return initializeFirestore(lwApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(lwApp);
  }
})();
/* getAuth keeps the session in IndexedDB (falls back to localStorage), the same
   place the compat SDK used, so signed-in users stay signed in. */
const lwAuth = getAuth(lwApp);

/* references by path: col('words'), ref('users', uid), ref('texts', id, 'chapters', '0') */
const col = (...path) => collection(lwDb, ...path);
const ref = (...path) => doc(lwDb, ...path);

const LW_COLLECTIONS = {
  groups: 'groups',
  words: 'words',
  users: 'users',
  usernames: 'usernames',
  progress: 'progress',
  activity: 'activity',
  texts: 'texts',
  readingProgress: 'reading_progress',
  collocations: 'collocations',
  lessons: 'lessons',
  lessonProgress: 'lesson_progress',
  levelQuestions: 'level_questions',
  clips: 'clips',
};

/* Legacy accounts (registered before real emails) authenticate via a synthetic
   email derived from the username. New accounts use the user's real email. */
function lwUsernameToEmail(username) {
  return username.trim().toLowerCase() + '@lexicon.local';
}

async function lwRegister(username, email, password) {
  const name = username.trim();
  const nameLower = name.toLowerCase();
  const existing = await getDoc(ref(LW_COLLECTIONS.usernames, nameLower));
  if (existing.exists()) {
    const err = new Error('This username is taken.');
    err.code = 'lw/username-taken';
    throw err;
  }
  const cred = await createUserWithEmailAndPassword(lwAuth, email.trim(), password);
  const uid = cred.user.uid;
  await setDoc(ref(LW_COLLECTIONS.users, uid), {
    username: name,
    role: 'user',
    lang: null,
    createdAt: serverTimestamp(),
  });
  await setDoc(ref(LW_COLLECTIONS.usernames, nameLower), { uid });
  return cred.user;
}

/* identifier is either an email or a username (legacy synthetic-email accounts) */
async function lwLogin(identifier, password) {
  const id = identifier.trim();
  const email = id.includes('@') ? id : lwUsernameToEmail(id);
  const cred = await signInWithEmailAndPassword(lwAuth, email, password);
  return cred.user;
}

function lwResetPassword(email) {
  return sendPasswordResetEmail(lwAuth, email.trim());
}

/* Permanently delete the signed-in user's account: re-auth (Firebase requires a
   recent login before user.delete()), then remove their words, groups, username
   reservation and profile doc, and finally the Auth record itself. */
async function lwDeleteAccount(password) {
  const user = lwAuth.currentUser;
  if (!user) {
    const err = new Error('Not signed in');
    err.code = 'lw/not-signed-in';
    throw err;
  }
  /* Firebase wants a recent sign-in: password accounts confirm with the
     password, Google-only accounts with a Google popup. */
  if (lwHasPassword(user)) {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  } else {
    await reauthenticateWithPopup(user, lwGoogleProvider());
  }

  const uid = user.uid;
  /* own reading texts: chapters live in a subcollection and must go first */
  const ownTexts = await getDocs(query(col(LW_COLLECTIONS.texts), where('userId', '==', uid)));
  for (const t of ownTexts.docs) await lwDeleteText(t.id, (t.data().chapters || []).length);
  for (const coll of [LW_COLLECTIONS.words, LW_COLLECTIONS.groups, LW_COLLECTIONS.progress, LW_COLLECTIONS.activity, LW_COLLECTIONS.readingProgress, LW_COLLECTIONS.collocations, LW_COLLECTIONS.lessonProgress]) {
    const snap = await getDocs(query(col(coll), where('userId', '==', uid)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(lwDb);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  const profile = await getDoc(ref(LW_COLLECTIONS.users, uid));
  const username = profile.exists() ? profile.data().username : null;
  if (username) {
    await deleteDoc(ref(LW_COLLECTIONS.usernames, username.toLowerCase()));
  }
  await deleteDoc(ref(LW_COLLECTIONS.users, uid));
  await deleteUser(user);
}

function lwLogout() {
  return signOut(lwAuth);
}

/* Subscribe to auth state changes. Returns an unsubscribe function. */
function lwWatchAuth(onChange) {
  return onAuthStateChanged(lwAuth, onChange);
}

/* Subscribe to the current user's profile doc. Calls onChange(profile) or
   onChange(null) when the server says there is no profile (a new Google user).
   A "missing" answer from the offline cache alone is ignored — the doc may just
   not be cached on this device yet. Returns an unsubscribe function. */
function lwWatchUserDoc(uid, onChange) {
  return onSnapshot(ref(LW_COLLECTIONS.users, uid), { includeMetadataChanges: true }, (d) => {
    if (!d.exists() && d.metadata.fromCache) return;
    onChange(d.exists() ? { id: d.id, ...d.data() } : null);
  });
}

/* Update some of the signed-in user's own profile fields (lang, dailyGoal, cefr, avatar…). */
function lwUpdateUser(uid, fields) {
  const data = { ...fields };
  Object.keys(data).forEach((k) => { if (data[k] === undefined) delete data[k]; });
  return updateDoc(ref(LW_COLLECTIONS.users, uid), data);
}

/* ---------------- Google sign-in ---------------- */

function lwGoogleProvider() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

function lwHasPassword(user) {
  return !!user && user.providerData.some((p) => p.providerId === 'password');
}

/* which sign-in methods the current user has, and the linked Google email */
function lwAuthInfo() {
  const user = lwAuth.currentUser;
  if (!user) return { password: false, google: false, googleEmail: null, email: null };
  const g = user.providerData.find((p) => p.providerId === 'google.com');
  return { password: lwHasPassword(user), google: !!g, googleEmail: g ? g.email : null, email: user.email };
}

/* Popup sign-in; falls back to a full-page redirect when the popup is blocked.
   A first-time Google user has no profile yet — App then asks for a username. */
async function lwSignInWithGoogle() {
  try {
    return (await signInWithPopup(lwAuth, lwGoogleProvider())).user;
  } catch (e) {
    if (e && e.code === 'auth/popup-blocked') {
      await signInWithRedirect(lwAuth, lwGoogleProvider());
      return null;
    }
    throw e;
  }
}

/* Create the profile for a signed-in user who has none (first Google sign-in).
   The username is reserved first: usernames/{name} can only be created, never
   overwritten, so a taken name fails here before anything else is written. */
async function lwCreateProfile(username) {
  const user = lwAuth.currentUser;
  const name = username.trim();
  const nameLower = name.toLowerCase();
  const existing = await getDoc(ref(LW_COLLECTIONS.usernames, nameLower));
  if (existing.exists()) {
    const err = new Error('This username is taken.');
    err.code = 'lw/username-taken';
    throw err;
  }
  await setDoc(ref(LW_COLLECTIONS.usernames, nameLower), { uid: user.uid });
  await setDoc(ref(LW_COLLECTIONS.users, user.uid), {
    username: name,
    role: 'user',
    lang: null,
    createdAt: serverTimestamp(),
  });
}

function lwLinkGoogle() {
  return linkWithPopup(lwAuth.currentUser, lwGoogleProvider());
}

function lwUnlinkGoogle() {
  return unlink(lwAuth.currentUser, 'google.com');
}

/* ---------------- Read meter ----------------
   Counts, per listener or fetch, how many docs came from the server (what
   Firestore bills) and how many snapshots came only from the offline cache.
   Type lwReadReport() in the browser console to see the table.
   The first server snapshot of a listener is counted in full: an upper bound,
   since a listener resumed within 30 min is billed only for changed docs. */
const lwReadStats = {};
function lwMeter(label, snap, full) {
  const s = lwReadStats[label] || (lwReadStats[label] = { snapshots: 0, fromCache: 0, serverDocs: 0, docs: 0 });
  s.snapshots++;
  s.docs = snap.size;
  if (snap.metadata.fromCache) { s.fromCache++; return; }
  s.serverDocs += full ? snap.size : snap.docChanges().filter((c) => c.type !== 'removed').length;
}
function lwReadReport() {
  const rows = Object.entries(lwReadStats).map(([label, s]) => ({ label, ...s }))
    .sort((a, b) => b.serverDocs - a.serverDocs);
  console.table(rows);
  const total = rows.reduce((n, r) => n + r.serverDocs, 0);
  console.log('Server docs (≈ billed reads) since page load: ' + total);
  return total;
}

/* Listen to a query and pass every snapshot with a data change to onSnap.
   Metadata changes are listened to only so the meter sees the server answer
   that follows a cached one (the listener's data stays the same then). */
function lwListen(q, label, onSnap) {
  let first = true;
  let synced = false;
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    lwMeter(label, snap, !synced && !snap.metadata.fromCache);
    if (!snap.metadata.fromCache) synced = true;
    if (first || snap.docChanges().length) { first = false; onSnap(snap); }
  });
}
/* A one-off query, metered. */
async function lwFetch(q, label) {
  const snap = await getDocs(q);
  lwMeter(label, snap, true);
  return snap;
}

const lwSnapItems = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* Subscribe to a collection, calling onChange(items) on every update.
   Returns an unsubscribe function. */
function lwWatchCollection(name, onChange) {
  return lwListen(col(name), name + ' (all)', (snap) => onChange(lwSnapItems(snap)));
}

/* Subscribe to a collection scoped to the given user. Returns an unsubscribe function. */
function lwWatchUserCollection(name, uid, onChange) {
  return lwListen(query(col(name), where('userId', '==', uid)), name, (snap) => onChange(lwSnapItems(snap)));
}

/* Subscribe to a user's own docs PLUS admin-authored shared:true docs in the same collection.
   Calls onChange(items) with the merged list on every update. Returns an unsubscribe function.
   An admin's own docs are mostly shared, so for an admin the "own" query asks only for
   private ones (shared == false): the shared query already brings the rest, and Firestore
   would otherwise bill every shared doc of theirs twice.
   With `lang`, both queries ask only for docs of that learning language, so the
   other language's words aren't read at all (every content doc carries `lang`;
   scripts/backfill-lang.mjs tagged the old ones). */
function lwWatchUserAndSharedCollection(name, uid, onChange, isAdmin, lang) {
  let own = null;
  let shared = null;
  const emit = () => { if (own && shared) onChange([...own, ...shared]); };
  const inLang = lang ? [where('lang', '==', lang)] : [];
  const ownQuery = isAdmin
    ? query(col(name), where('userId', '==', uid), where('shared', '==', false), ...inLang)
    : query(col(name), where('userId', '==', uid), ...inLang);
  const unsubOwn = lwListen(ownQuery, name + ' (own)', (snap) => {
    own = lwSnapItems(snap);
    emit();
  });
  const unsubShared = lwListen(query(col(name), where('shared', '==', true), ...inLang), name + ' (shared)', (snap) => {
    shared = isAdmin ? lwSnapItems(snap)
      : snap.docs.filter((d) => d.data().userId !== uid).map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  return () => { unsubOwn(); unsubShared(); };
}

/* ---------------- Words: shared ones from the device cache ----------------
   Shared words (written only by admins) come from IndexedDB and are re-read
   per group when the group's `updatedAt` changes (wordsync.ts). Own words keep a
   live listener. Every write of a shared word stamps its group (lwTouchGroups),
   and once per watcher a count() of shared words checks the cache, so an add
   or delete that missed the stamp (an old client, a script) still shows up. */

const lwWordWatchers = new Set();

/* count() of this language's shared words; Firestore bills 1 read per 1000 counted */
async function lwCountSharedWords(lang) {
  const n = (await getCountFromServer(query(col(LW_COLLECTIONS.words), where('shared', '==', true), where('lang', '==', lang)))).data().count;
  const s = lwReadStats['words (shared, count)'] || (lwReadStats['words (shared, count)'] = { snapshots: 0, fromCache: 0, serverDocs: 0, docs: 0 });
  s.snapshots++;
  s.docs = n;
  s.serverDocs += Math.max(1, Math.ceil(n / 1000));
  return n;
}

/* Stamp groups whose shared words changed. Stamps are collected for a moment and
   written once per group: an import of hundreds of words is one update, not
   hundreds to the same doc (Firestore sustains about one write per second per
   doc). Writes from one device apply in order, so the stamp lands after the
   words. A group deleted meanwhile just fails its update, which is fine. */
const lwTouchPending = new Set();
let lwTouchTimer = null;
/* groupId → when this device last stamped it: the stamp that comes back is our
   own edit, already in the cache, so watchers take it over without a re-read
   (if another admin edits the same group in those seconds, their change shows
   with the group's next stamp) */
const lwOwnTouches = new Map();
const LW_OWN_TOUCH_MS = 15000;
const lwOwnTouchRecent = (groupId) => Date.now() - (lwOwnTouches.get(groupId) || 0) < LW_OWN_TOUCH_MS;
function lwTouchGroups(groupIds) {
  groupIds.filter(Boolean).forEach((id) => lwTouchPending.add(id));
  clearTimeout(lwTouchTimer);
  lwTouchTimer = setTimeout(() => {
    const ids = [...lwTouchPending];
    lwTouchPending.clear();
    ids.forEach((id) => lwOwnTouches.set(id, Date.now()));
    ids.forEach((id) => updateDoc(ref(LW_COLLECTIONS.groups, id), { updatedAt: serverTimestamp() })
      .catch((e) => console.warn('Could not stamp group ' + id + ':', e.code || e)));
  }, 500);
}

/* the cached shared word with this id, from any active watcher */
function lwKnownSharedWord(id) {
  for (const w of lwWordWatchers) { const x = w.find(id); if (x) return x; }
  return null;
}

/* Watch the words of `lang` this user sees: own ones live, shared ones from the
   device cache. Call syncGroups(sharedGroups) whenever the shared groups (with
   updatedAt) change. onChange gets the merged list. Returns { syncGroups, stop }. */
function lwWatchWords({ uid, isAdmin, lang }, onChange) {
  const key = 'words:' + uid + ':' + lang;
  let own = null;
  let cache = null;
  let groups = null;
  let stopped = false;
  let running = false;
  let rerun = false;
  let readAll = false;
  let checked = false;
  let runTimer = null;
  let checkTimer = null;

  const emit = () => { if (own && cache) onChange(lwMergeWords(own, lwCachedWords(cache), uid, isAdmin)); };
  const store = () => lwCacheSet(key, cache);

  const ownQuery = isAdmin
    ? query(col(LW_COLLECTIONS.words), where('userId', '==', uid), where('shared', '==', false), where('lang', '==', lang))
    : query(col(LW_COLLECTIONS.words), where('userId', '==', uid), where('lang', '==', lang));
  const unsubOwn = lwListen(ownQuery, 'words (own)', (snap) => { own = lwSnapItems(snap); emit(); });

  const schedule = (ms) => { clearTimeout(runTimer); runTimer = setTimeout(run, ms); };

  /* re-read the groups that changed, then (once, when things have settled)
     compare the server count of shared words with the cache */
  async function run() {
    if (stopped || !cache || !groups) return;
    if (running) { rerun = true; return; }
    running = true;
    const full = readAll;
    readAll = false;
    try {
      const plan = lwWordSyncPlan(groups, cache, full);
      cache = lwWithoutGroups(cache, plan.drop);
      const stampOf = Object.fromEntries(groups.map((g) => [g.id, g.stamp]));
      const own = full ? { fetch: plan.fetch, cache } : lwAdoptOwnStamps(plan.fetch, cache, stampOf, lwOwnTouchRecent);
      const adopted = plan.fetch.length - own.fetch.length;
      cache = own.cache;
      await Promise.all(own.fetch.map(async (gid) => {
        const snap = await lwFetch(query(col(LW_COLLECTIONS.words), where('groupId', '==', gid), where('shared', '==', true)),
          'words (shared, by group)');
        if (!stopped) cache = lwWithGroupWords(cache, gid, stampOf[gid], lwSnapItems(snap));
      }));
      if (stopped) return;
      if (full) {
        /* after a full re-read the cache is as right as it can be: accept any
           remaining difference (shared words outside visible groups) */
        const n = await lwCountSharedWords(lang);
        const offset = n - lwCachedWords(cache).length;
        if (offset) console.warn('Shared ' + lang + ' words outside visible groups: ' + offset);
        cache = { ...cache, countOffset: offset };
      }
      if (plan.fetch.length || plan.drop.length || full || adopted) { store(); emit(); }
      if (!checked) { clearTimeout(checkTimer); checkTimer = setTimeout(check, 3000); }
    } catch (e) {
      console.warn('Shared words sync failed (cached words stay):', e.code || e);
    } finally {
      running = false;
      if (rerun && !stopped) { rerun = false; schedule(0); }
    }
  }

  async function check() {
    if (stopped || checked || running) return;
    checked = true;
    try {
      const n = await lwCountSharedWords(lang);
      if (!stopped && !lwWordsCountOk(n, cache)) {
        console.warn('Shared ' + lang + ' words: ' + n + ' on the server, ' + lwCachedWords(cache).length + ' cached — reading them all again.');
        readAll = true;
        schedule(0);
      }
    } catch (e) {
      console.warn('Shared words count failed:', e.code || e);
    }
  }

  lwCacheGet(key).then((raw) => {
    if (stopped) return;
    cache = lwNormWordsCache(raw);
    emit();
    schedule(0);
  });

  const watcher = {
    /* shared groups of this language, as App has them (with updatedAt) */
    syncGroups(list) {
      const first = !groups;
      groups = list.map((g) => ({ id: g.id, stamp: lwStampMs(g.updatedAt) }));
      schedule(first ? 0 : 800); // let a burst of stamp changes settle
    },
    /* this device wrote or deleted a word: show it now, before its group is re-read */
    put(word) { if (cache) { cache = lwPutCachedWord(cache, word); store(); emit(); } },
    remove(id) { if (cache) { cache = lwRemoveCachedWord(cache, id); store(); emit(); } },
    find(id) { return lwFindCachedWord(cache, id); },
    stop() {
      stopped = true;
      clearTimeout(runTimer);
      clearTimeout(checkTimer);
      unsubOwn();
      lwWordWatchers.delete(watcher);
    },
  };
  lwWordWatchers.add(watcher);
  return watcher;
}

/* Content collections whose docs belong to one learning language (`lang`). */
const LW_LANG_COLLECTIONS = [LW_COLLECTIONS.groups, LW_COLLECTIONS.words, LW_COLLECTIONS.collocations, LW_COLLECTIONS.lessons, LW_COLLECTIONS.texts];

function lwSetDoc(collectionName, item) {
  const { id, ...data } = item;
  // Firestore rejects any field whose value is undefined. Strip such fields so
  // partially-populated items (e.g. legacy docs without userId/username) still save.
  Object.keys(data).forEach((k) => { if (data[k] === undefined) delete data[k]; });
  // A new doc gets the language being studied now; an edited doc keeps its own
  // (edits start from the stored doc). Legacy docs without one are only shown in
  // English, so editing them there tags them 'en'.
  if (LW_LANG_COLLECTIONS.includes(collectionName) && !data.lang) data.lang = lwCurrentLang();
  // Romanian is read as written: a word saved without a transcription gets one by rule.
  if (collectionName === LW_COLLECTIONS.words && data.lang === 'ro' && !data.ipa && data.word) data.ipa = lwRoIpa(data.word, data.pos);
  // A group's stamp tells devices to re-read its shared words (lwWatchWords).
  // Stamps: a group's tells devices to re-read its shared words (lwWatchWords);
  // a lesson's lets devices ask only for changed lessons (lwWatchSince).
  if (collectionName === LW_COLLECTIONS.groups || collectionName === LW_COLLECTIONS.lessons) data.updatedAt = serverTimestamp();
  if (collectionName === LW_COLLECTIONS.lessons) lwSinceLocal(collectionName, (w) => w.put(id, data));
  const done = setDoc(ref(collectionName, id), data);
  if (collectionName === LW_COLLECTIONS.words) {
    // a shared word stamps its group, and the group it left if it moved or went private
    const prev = lwKnownSharedWord(id);
    lwTouchGroups([data.shared ? data.groupId : null, prev && prev.groupId !== (data.shared ? data.groupId : null) ? prev.groupId : null]);
    lwWordWatchers.forEach((w) => w.put({ id, ...data }));
  }
  return done;
}

function lwDeleteDoc(collectionName, id) {
  if (collectionName === LW_COLLECTIONS.words) {
    const prev = lwKnownSharedWord(id);
    if (prev) lwTouchGroups([prev.groupId]);
    lwWordWatchers.forEach((w) => w.remove(id));
  }
  lwSinceLocal(collectionName, (w) => w.remove([id]));
  return deleteDoc(ref(collectionName, id));
}

/* Delete all words belonging to a group (cascade). Pass the owner's userId for
   non-admin callers — the rules only allow listing docs the query provably owns. */
async function lwDeleteWordsByGroup(groupId, userId) {
  const q = userId
    ? query(col(LW_COLLECTIONS.words), where('groupId', '==', groupId), where('userId', '==', userId))
    : query(col(LW_COLLECTIONS.words), where('groupId', '==', groupId));
  const snap = await lwFetch(q, 'words (delete group)');
  const batch = writeBatch(lwDb);
  snap.docs.forEach((d) => batch.delete(d.ref));
  // the group goes too, so it needs no stamp: devices drop it with its words
  snap.docs.forEach((d) => lwWordWatchers.forEach((w) => w.remove(d.id)));
  return batch.commit();
}

/* ---------------- Progress (FSRS) & daily activity ---------------- */

/* Daily activity is kept per learning language — XP, level, streak and practice
   time of one language don't count for another. English keeps the original id
   `${uid}_${date}`, other languages use `${uid}_${lang}_${date}`. */
function lwActivityRef(uid, lang, date) {
  return ref(LW_COLLECTIONS.activity, uid + '_' + (lang && lang !== 'en' ? lang + '_' : '') + date);
}

/* Record one answer in a single batch: the word's new progress doc plus the
   day's activity counters. Uses merge + increment (no transaction), so it also
   works offline. `progress` is the full doc from lwNextProgress, or null for an
   answer that belongs to no word (grammar tests): then only activity is written. */
function lwRecordAnswer({ uid, lang, progress, date, correct, xp, goalBonus, ms }) {
  const batch = writeBatch(lwDb);
  if (progress) {
    // updatedAt (server time) lets devices ask only for changed progress (lwWatchProgress)
    const id = uid + '_' + progress.wordId;
    batch.set(ref(LW_COLLECTIONS.progress, id), { ...progress, userId: uid, updatedAt: serverTimestamp() });
    lwSinceLocal(LW_COLLECTIONS.progress, (w) => w.put(id, { ...progress, userId: uid }));
  }
  const day = {
    userId: uid, lang: lang || 'en', date,
    answers: increment(1), correct: increment(correct ? 1 : 0), xp: increment(xp + (goalBonus || 0)), ms: increment(ms || 0),
  };
  if (goalBonus) day.goalMet = true;
  batch.set(lwActivityRef(uid, lang, date), day, { merge: true });
  return batch.commit();
}

/* Add practice time without an answer (reading): bumps activity.ms only. */
function lwAddPracticeTime(uid, lang, date, ms) {
  return setDoc(lwActivityRef(uid, lang, date),
    { userId: uid, lang: lang || 'en', date, ms: increment(ms) }, { merge: true });
}

/* Delete this user's progress docs for the given words (e.g. after the words were deleted). */
async function lwDeleteProgressForWords(uid, wordIds) {
  for (let i = 0; i < wordIds.length; i += 400) {
    const batch = writeBatch(lwDb);
    wordIds.slice(i, i + 400).forEach((id) => batch.delete(ref(LW_COLLECTIONS.progress, uid + '_' + id)));
    await batch.commit();
  }
  lwSinceLocal(LW_COLLECTIONS.progress, (w) => w.remove(wordIds.map((id) => uid + '_' + id)));
}

/* ---------------- Cached queries: progress and lessons ----------------
   A query whose docs carry updatedAt (server time) is kept in IndexedDB
   (deltasync.ts). A load reads only docs changed since the latest updatedAt the
   device has seen, through a live listener that keeps bringing changes (other
   devices too). The first load, a weekly full read, or a cache that disagrees
   with a count() of the query reads everything. The "changed since" query needs
   a composite index (firestore.indexes.json); without one the watcher falls
   back to a plain listener on the whole query, so nothing breaks. */

const lwSinceWatchers = new Set();

/* key: IndexedDB key; base: the query; label: for lwReadReport; collection:
   where local writes come from (lwSetDoc/lwDeleteDoc, lwRecordAnswer).
   onChange(cache) gets the DeltaCache. Returns { put, remove, stop }. */
function lwWatchSince({ key, base, label, collection: collectionName }, onChange) {
  let cache = null;
  let stopped = false;
  let unsub = () => {};
  let checkTimer = null;

  const emit = () => { if (cache) onChange(cache); };
  const store = () => lwCacheSet(key, cache);
  const meterCount = (n) => {
    const s = lwReadStats[label + ' (count)'] || (lwReadStats[label + ' (count)'] = { snapshots: 0, fromCache: 0, serverDocs: 0, docs: 0 });
    s.snapshots++;
    s.docs = n;
    s.serverDocs += Math.max(1, Math.ceil(n / 1000));
  };

  async function readAll() {
    const snap = await lwFetch(base, label + ' (full)');
    if (stopped) return;
    cache = lwPutDeltaDocs(lwEmptyDeltaCache(Date.now()), lwSnapItems(snap));
    store();
    emit();
  }

  /* the old way: one listener on the whole query */
  function fallback(err) {
    console.warn(label + ': the "changed since" query failed, listening to all of it instead.', (err && err.message) || err);
    unsub();
    unsub = lwListen(base, label, (snap) => {
      cache = lwPutDeltaDocs(lwEmptyDeltaCache(Date.now()), lwSnapItems(snap));
      store();
      emit();
    });
  }

  function listenSince() {
    let synced = false;
    const changed = query(base, where('updatedAt', '>', Timestamp.fromMillis(cache.since)));
    unsub = onSnapshot(changed, { includeMetadataChanges: true }, (snap) => {
      lwMeter(label + ' (changed)', snap, !synced && !snap.metadata.fromCache);
      if (!snap.metadata.fromCache) synced = true;
      const docs = snap.docChanges().filter((c) => c.type !== 'removed').map((c) => ({ id: c.doc.id, ...c.doc.data() }));
      if (!docs.length) return;
      cache = lwPutDeltaDocs(cache, docs);
      store();
      emit();
    }, (err) => {
      // no index yet: fall back to the full listener; other errors (quota,
      // offline) leave the cached docs in place
      if (err && err.code === 'failed-precondition') fallback(err);
      else console.warn(label + ' listener failed (cached docs stay):', (err && err.code) || err);
    });
  }

  /* safety net: docs deleted (or a lesson unpublished) aren't "changed since" */
  async function check() {
    if (stopped) return;
    try {
      const n = (await getCountFromServer(base)).data().count;
      meterCount(n);
      if (!stopped && !lwDeltaCountOk(n, cache)) {
        console.warn(label + ': ' + n + ' on the server, ' + Object.keys(cache.docs).length + ' cached — reading them all again.');
        await readAll();
      }
    } catch (e) {
      console.warn(label + ' count failed:', e.code || e);
    }
  }

  lwCacheGet(key).then(async (raw) => {
    if (stopped) return;
    cache = lwNormDeltaCache(raw);
    try {
      if (cache && !lwDeltaFullDue(cache, Date.now())) emit();
      else await readAll();
    } catch (e) {
      console.warn(label + ' could not be read:', e.code || e);
      fallback(e);
      return;
    }
    if (stopped) return;
    listenSince();
    checkTimer = setTimeout(check, 3000);
  });

  const watcher = {
    collection: collectionName,
    /* this device's write: show it now */
    put(id, doc) { if (cache) { cache = lwPutLocalDoc(cache, id, doc); store(); emit(); } },
    remove(ids) { if (cache) { cache = lwRemoveDeltaDocs(cache, ids); store(); emit(); } },
    stop() {
      stopped = true;
      clearTimeout(checkTimer);
      unsub();
      lwSinceWatchers.delete(watcher);
    },
  };
  lwSinceWatchers.add(watcher);
  return watcher;
}

const lwSinceLocal = (collectionName, fn) => lwSinceWatchers.forEach((w) => { if (w.collection === collectionName) fn(w); });

/* The user's progress, as { wordId: doc }. Returns { stop }. */
function lwWatchProgress(uid, onChange) {
  return lwWatchSince({
    key: 'progress:' + uid,
    base: query(col(LW_COLLECTIONS.progress), where('userId', '==', uid)),
    label: 'progress',
    collection: LW_COLLECTIONS.progress,
  }, (cache) => onChange(lwProgressByWord(cache)));
}

/* ---------------- Grammar lessons ---------------- */

/* Admins see every lesson (drafts too); users only published ones — the
   query filter is what the rules require. With `lang`, only that language's lessons. */
function lwWatchLessons(isAdmin, onChange, lang) {
  const inLang = lang ? [where('lang', '==', lang)] : [];
  const q = isAdmin ? query(col(LW_COLLECTIONS.lessons), ...inLang)
    : query(col(LW_COLLECTIONS.lessons), where('published', '==', true), ...inLang);
  /* from the device cache plus lessons changed since (lwWatchSince); admins and
     users cache apart, since their queries differ (drafts) */
  const w = lwWatchSince({
    key: 'lessons:' + (isAdmin ? 'all' : 'published') + ':' + (lang || 'any'),
    base: q,
    label: 'lessons',
    collection: LW_COLLECTIONS.lessons,
  }, (cache) => onChange(lwDeltaList(cache)));
  return () => w.stop();
}

/* level test question bank of one language (shared content, admins write it) */
function lwWatchLevelQuestions(lang, onChange) {
  return lwListen(query(col(LW_COLLECTIONS.levelQuestions), where('lang', '==', lang || 'en')),
    'level_questions', (snap) => onChange(lwSnapItems(snap)));
}

/* video clips of one language (shared content, admins write them) */
function lwWatchClips(lang, onChange) {
  return lwListen(query(col(LW_COLLECTIONS.clips), where('lang', '==', lang || 'en')),
    'clips', (snap) => onChange(lwSnapItems(snap)));
}

/* merge fields into this user's progress for a lesson */
function lwSaveLessonProgress(uid, lessonId, fields) {
  return setDoc(ref(LW_COLLECTIONS.lessonProgress, uid + '_' + lessonId),
    { ...fields, userId: uid, lessonId }, { merge: true });
}

/* XP bonus for a first lesson completion: activity only, no answer counted */
function lwAddBonusXp(uid, lang, date, xp) {
  return setDoc(lwActivityRef(uid, lang, date),
    { userId: uid, lang: lang || 'en', date, xp: increment(xp) }, { merge: true });
}

/* ---------------- Reading texts ---------------- */

/* Save a text: meta doc texts/{id} (no body, so lists stay light) plus one doc
   per chapter in texts/{id}/chapters/{n}. Chapters repeat userId/shared for the rules.
   A chapter may carry `exercises` (books from scripts/upload-book.mjs). */
async function lwSaveText(meta, chapters) {
  const textRef = ref(LW_COLLECTIONS.texts, meta.id);
  const { id, ...data } = meta;
  if (!data.lang) data.lang = lwCurrentLang();
  for (let i = 0; i < chapters.length; i += 400) {
    const batch = writeBatch(lwDb);
    chapters.slice(i, i + 400).forEach((c, k) => {
      batch.set(doc(textRef, 'chapters', String(i + k)), {
        userId: meta.userId, shared: meta.shared, title: c.title || '', paragraphs: c.paragraphs,
        ...(c.exercises ? { exercises: c.exercises } : {}),
      });
    });
    await batch.commit();
  }
  await setDoc(textRef, data); // meta last: the text shows up only once its chapters exist
}

async function lwDeleteText(id, chapterCount) {
  const textRef = ref(LW_COLLECTIONS.texts, id);
  for (let i = 0; i < chapterCount; i += 400) {
    const batch = writeBatch(lwDb);
    for (let n = i; n < Math.min(i + 400, chapterCount); n++) batch.delete(doc(textRef, 'chapters', String(n)));
    await batch.commit();
  }
  await deleteDoc(textRef);
}

async function lwGetChapter(textId, n) {
  const d = await getDoc(ref(LW_COLLECTIONS.texts, textId, 'chapters', String(n)));
  return d.exists() ? d.data() : null;
}

function lwSaveReadingProgress(uid, textId, fields) {
  return setDoc(ref(LW_COLLECTIONS.readingProgress, uid + '_' + textId),
    { ...fields, userId: uid, textId, updatedAt: Date.now() }, { merge: true });
}

function lwDeleteReadingProgress(uid, textId) {
  return deleteDoc(ref(LW_COLLECTIONS.readingProgress, uid + '_' + textId));
}

/* ---------------- Admin ---------------- */

/* Fetch all users, plus a words/groups count per user, for the Admin screen. */
async function lwAdminFetchUsers() {
  const [usersSnap, groupsSnap, wordsSnap] = await Promise.all([
    lwFetch(col(LW_COLLECTIONS.users), 'users (admin)'),
    lwFetch(col(LW_COLLECTIONS.groups), 'groups (admin)'),
    lwFetch(col(LW_COLLECTIONS.words), 'words (admin)'),
  ]);
  const groupCountByUser = {};
  groupsSnap.docs.forEach((d) => {
    const uid = d.data().userId;
    if (uid) groupCountByUser[uid] = (groupCountByUser[uid] || 0) + 1;
  });
  const wordCountByUser = {};
  wordsSnap.docs.forEach((d) => {
    const uid = d.data().userId;
    if (uid) wordCountByUser[uid] = (wordCountByUser[uid] || 0) + 1;
  });
  return usersSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    groupCount: groupCountByUser[d.id] || 0,
    wordCount: wordCountByUser[d.id] || 0,
  }));
}

function lwAdminSetRole(uid, role) {
  return updateDoc(ref(LW_COLLECTIONS.users, uid), { role });
}

/* Fetch every group and word across all users, for the Admin "all data" screen. */
async function lwAdminFetchAllData() {
  const [groupsSnap, wordsSnap] = await Promise.all([
    lwFetch(col(LW_COLLECTIONS.groups), 'groups (admin all data)'),
    lwFetch(col(LW_COLLECTIONS.words), 'words (admin all data)'),
  ]);
  return {
    groups: lwSnapItems(groupsSnap),
    words: lwSnapItems(wordsSnap),
  };
}

export {
  LW_COLLECTIONS, lwReadReport, lwWatchCollection, lwWatchUserCollection,
  lwWatchUserAndSharedCollection, lwWatchWords, lwWatchProgress, lwTouchGroups, lwSetDoc, lwDeleteDoc,
  lwDeleteWordsByGroup, lwRecordAnswer, lwAddPracticeTime, lwSaveText, lwDeleteText, lwGetChapter,
  lwSaveReadingProgress, lwDeleteReadingProgress, lwDeleteProgressForWords,
  lwWatchLessons, lwWatchLevelQuestions, lwWatchClips, lwSaveLessonProgress,
  lwAddBonusXp, lwRegister, lwLogin, lwLogout, lwResetPassword, lwDeleteAccount,
  lwWatchAuth, lwWatchUserDoc, lwUpdateUser, lwAuthInfo, lwSignInWithGoogle,
  lwCreateProfile, lwLinkGoogle, lwUnlinkGoogle, lwAdminFetchUsers, lwAdminSetRole,
  lwAdminFetchAllData,
};

/* Console API: scripts/*.mjs and books run in the browser console and call these as window.lwX,
   and Firestore/Auth through window.firebase: a small compat-style shim (firebase-console.js). */
Object.assign(window, {
  firebase: lwConsoleFirebase(lwDb, lwAuth),
  LW_COLLECTIONS,
  lwTouchGroups, // scripts that write shared words call it with the groups they touched
  lwServerTime: () => serverTimestamp(), // scripts that write lessons set updatedAt: window.lwServerTime()
  lwReadReport,
  lwWatchCollection,
  lwWatchUserCollection,
  lwWatchUserAndSharedCollection,
  lwSetDoc,
  lwDeleteDoc,
  lwDeleteWordsByGroup,
  lwRecordAnswer,
  lwAddPracticeTime,
  lwSaveText,
  lwDeleteText,
  lwGetChapter,
  lwSaveReadingProgress,
  lwDeleteReadingProgress,
  lwDeleteProgressForWords,
  lwWatchLessons,
  lwWatchLevelQuestions,
  lwWatchClips,
  lwSaveLessonProgress,
  lwAddBonusXp,
  lwRegister,
  lwLogin,
  lwLogout,
  lwResetPassword,
  lwDeleteAccount,
  lwWatchAuth,
  lwWatchUserDoc,
  lwUpdateUser,
  lwAuthInfo,
  lwSignInWithGoogle,
  lwCreateProfile,
  lwLinkGoogle,
  lwUnlinkGoogle,
  lwAdminFetchUsers,
  lwAdminSetRole,
  lwAdminFetchAllData,
});
