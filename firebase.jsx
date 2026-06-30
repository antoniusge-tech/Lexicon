/* firebase.jsx — Firebase init + per-user Firestore data layer + auth */

const LW_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAFNfL2zqb5jqhEzTHVYzQx0DLQfCHpt14',
  authDomain: 'lexicon-a0553.firebaseapp.com',
  projectId: 'lexicon-a0553',
  storageBucket: 'lexicon-a0553.firebasestorage.app',
  messagingSenderId: '1004533576564',
  appId: '1:1004533576564:web:3033728131c095ce0cb221',
};

firebase.initializeApp(LW_FIREBASE_CONFIG);
const lwDb = firebase.firestore();
const lwAuth = firebase.auth();
lwAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const LW_COLLECTIONS = {
  groups: 'groups',
  words: 'words',
  users: 'users',
  usernames: 'usernames',
};

/* synthetic email used to authenticate by username via Firebase Auth's email/password provider */
function lwUsernameToEmail(username) {
  return username.trim().toLowerCase() + '@lexicon.local';
}

async function lwRegister(username, password) {
  const name = username.trim();
  const nameLower = name.toLowerCase();
  const existing = await lwDb.collection(LW_COLLECTIONS.usernames).doc(nameLower).get();
  if (existing.exists) {
    const err = new Error('Это имя уже занято.');
    err.code = 'lw/username-taken';
    throw err;
  }
  const cred = await lwAuth.createUserWithEmailAndPassword(lwUsernameToEmail(name), password);
  const uid = cred.user.uid;
  await lwDb.collection(LW_COLLECTIONS.users).doc(uid).set({
    username: name,
    role: 'user',
    lang: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await lwDb.collection(LW_COLLECTIONS.usernames).doc(nameLower).set({ uid });
  return cred.user;
}

async function lwLogin(username, password) {
  const cred = await lwAuth.signInWithEmailAndPassword(lwUsernameToEmail(username), password);
  return cred.user;
}

function lwLogout() {
  return lwAuth.signOut();
}

/* Subscribe to auth state changes. Returns an unsubscribe function. */
function lwWatchAuth(onChange) {
  return lwAuth.onAuthStateChanged(onChange);
}

/* Subscribe to the current user's profile doc (role, lang). Returns an unsubscribe function. */
function lwWatchUserDoc(uid, onChange) {
  return lwDb.collection(LW_COLLECTIONS.users).doc(uid).onSnapshot((doc) => {
    onChange(doc.exists ? { id: doc.id, ...doc.data() } : null);
  });
}

/* Subscribe to a collection, calling onChange(items) on every update.
   Returns an unsubscribe function. */
function lwWatchCollection(name, onChange) {
  return lwDb.collection(name).onSnapshot((snap) => {
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onChange(items);
  });
}

/* Subscribe to a collection scoped to the given user. Returns an unsubscribe function. */
function lwWatchUserCollection(name, uid, onChange) {
  return lwDb.collection(name).where('userId', '==', uid).onSnapshot((snap) => {
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onChange(items);
  });
}

/* Subscribe to a user's own docs PLUS admin-authored shared:true docs in the same collection.
   Calls onChange(items) with the merged list on every update. Returns an unsubscribe function. */
function lwWatchUserAndSharedCollection(name, uid, onChange) {
  let own = null;
  let shared = null;
  const emit = () => { if (own && shared) onChange([...own, ...shared]); };
  const unsubOwn = lwDb.collection(name).where('userId', '==', uid).onSnapshot((snap) => {
    own = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    emit();
  });
  const unsubShared = lwDb.collection(name).where('shared', '==', true).onSnapshot((snap) => {
    shared = snap.docs.filter((doc) => doc.data().userId !== uid).map((doc) => ({ id: doc.id, ...doc.data() }));
    emit();
  });
  return () => { unsubOwn(); unsubShared(); };
}

function lwSetDoc(collectionName, item) {
  const { id, ...data } = item;
  return lwDb.collection(collectionName).doc(id).set(data);
}

function lwDeleteDoc(collectionName, id) {
  return lwDb.collection(collectionName).doc(id).delete();
}

/* Delete all words belonging to a group (cascade) */
async function lwDeleteWordsByGroup(groupId) {
  const snap = await lwDb.collection(LW_COLLECTIONS.words).where('groupId', '==', groupId).get();
  const batch = lwDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  return batch.commit();
}

/* ---------------- Admin ---------------- */

/* Fetch all users, plus a words/groups count per user, for the Admin screen. */
async function lwAdminFetchUsers() {
  const [usersSnap, groupsSnap, wordsSnap] = await Promise.all([
    lwDb.collection(LW_COLLECTIONS.users).get(),
    lwDb.collection(LW_COLLECTIONS.groups).get(),
    lwDb.collection(LW_COLLECTIONS.words).get(),
  ]);
  const groupCountByUser = {};
  groupsSnap.docs.forEach((doc) => {
    const uid = doc.data().userId;
    if (uid) groupCountByUser[uid] = (groupCountByUser[uid] || 0) + 1;
  });
  const wordCountByUser = {};
  wordsSnap.docs.forEach((doc) => {
    const uid = doc.data().userId;
    if (uid) wordCountByUser[uid] = (wordCountByUser[uid] || 0) + 1;
  });
  return usersSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    groupCount: groupCountByUser[doc.id] || 0,
    wordCount: wordCountByUser[doc.id] || 0,
  }));
}

function lwAdminSetRole(uid, role) {
  return lwDb.collection(LW_COLLECTIONS.users).doc(uid).update({ role });
}

/* Fetch every group and word across all users, for the Admin "all data" screen. */
async function lwAdminFetchAllData() {
  const [groupsSnap, wordsSnap] = await Promise.all([
    lwDb.collection(LW_COLLECTIONS.groups).get(),
    lwDb.collection(LW_COLLECTIONS.words).get(),
  ]);
  return {
    groups: groupsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    words: wordsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

Object.assign(window, {
  LW_COLLECTIONS,
  lwWatchCollection,
  lwWatchUserCollection,
  lwWatchUserAndSharedCollection,
  lwSetDoc,
  lwDeleteDoc,
  lwDeleteWordsByGroup,
  lwRegister,
  lwLogin,
  lwLogout,
  lwWatchAuth,
  lwWatchUserDoc,
  lwAdminFetchUsers,
  lwAdminSetRole,
  lwAdminFetchAllData,
});
