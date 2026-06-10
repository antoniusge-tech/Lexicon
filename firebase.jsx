/* firebase.jsx — Firebase init + shared Firestore data layer (open access, no auth) */

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

const LW_COLLECTIONS = {
  groups: 'groups',
  words: 'words',
};

/* Subscribe to a collection, calling onChange(items) on every update.
   Returns an unsubscribe function. */
function lwWatchCollection(name, onChange) {
  return lwDb.collection(name).onSnapshot((snap) => {
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onChange(items);
  });
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

Object.assign(window, {
  LW_COLLECTIONS,
  lwWatchCollection,
  lwSetDoc,
  lwDeleteDoc,
  lwDeleteWordsByGroup,
});
