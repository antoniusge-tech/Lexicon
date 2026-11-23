/* firebase.js — Firebase init + per-user Firestore data layer + auth */

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, deleteUser, getAuth,
  linkWithPopup, onAuthStateChanged, reauthenticateWithCredential, reauthenticateWithPopup,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut,
  unlink,
} from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, initializeFirestore, onSnapshot,
  persistentLocalCache, persistentMultipleTabManager, query, serverTimestamp, setDoc, updateDoc,
  where, writeBatch,
} from 'firebase/firestore';
import { lwCurrentLang, lwRoIpa } from './data.js';
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
  return setDoc(ref(collectionName, id), data);
}

function lwDeleteDoc(collectionName, id) {
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
  if (progress) batch.set(ref(LW_COLLECTIONS.progress, uid + '_' + progress.wordId), { ...progress, userId: uid });
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
}

/* ---------------- Grammar lessons ---------------- */

/* Admins see every lesson (drafts too); users only published ones — the
   query filter is what the rules require. With `lang`, only that language's lessons. */
function lwWatchLessons(isAdmin, onChange, lang) {
  const inLang = lang ? [where('lang', '==', lang)] : [];
  const q = isAdmin ? query(col(LW_COLLECTIONS.lessons), ...inLang)
    : query(col(LW_COLLECTIONS.lessons), where('published', '==', true), ...inLang);
  return lwListen(q, 'lessons', (snap) => onChange(lwSnapItems(snap)));
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
  lwWatchUserAndSharedCollection, lwSetDoc, lwDeleteDoc, lwDeleteWordsByGroup,
  lwRecordAnswer, lwAddPracticeTime, lwSaveText, lwDeleteText, lwGetChapter,
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
