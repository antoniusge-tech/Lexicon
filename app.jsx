/* app.jsx — the root App: auth → profile → data subscriptions, navigation state,
   answers (recordAnswer), toasts and AI jobs; mounts React. Screens live in views/. */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import {
  LW_COLLECTIONS, lwAddBonusXp, lwAddPracticeTime, lwAuthInfo, lwDeleteDoc,
  lwDeleteReadingProgress, lwDeleteText, lwLogout, lwRecordAnswer, lwSaveLessonProgress,
  lwSaveText, lwSetDoc, lwUpdateUser, lwWatchAuth, lwWatchClips, lwWatchCollection,
  lwWatchLessons, lwWatchUserAndSharedCollection, lwWatchUserCollection, lwWatchUserDoc, lwWatchWords,
} from './firebase.js';
import {
  LW_KEYS, LW_READING_BATCH, lwAiFillWords, lwAiGenerateBatch, lwCefrField,
  lwCurrentLang, lwDocLang, lwLangField, lwLangInfo, lwLoad, lwSave, lwSetCurrentLang,
  lwUid, lwUserLangs,
} from './data.js';
import {
  LW_DEFAULT_DAILY_GOAL, LW_LESSON_TASKS, LW_XP_CORRECT, LW_XP_GOAL_BONUS,
  LW_XP_LESSON_BONUS, LW_XP_WRONG, lwBadgeMetrics, lwBadgeStates, lwGroupPaused,
  lwLastDays, lwLessonReviewQueue, lwLevel, lwLocalDate, lwNextLessonSrs, lwNextProgress, lwPracticeMs, lwReviewQueue,
  lwSetSrsSettings, lwSrsSettings, lwStatusCounts, lwStreak, lwTotalMs, lwTotalXp,
} from './progress.ts';
import { lwWordCount, lwWordsIndex } from './reading.ts';
import { lwFormsDeck, lwFormsToText, lwHasForms } from './forms.ts';
import {
  GeminiKeyModal, Ic, Modal, lwLeafGroups, lwParseImportLine,
} from './components.jsx';
import { AuthView, ChooseUsernameView } from './auth.jsx';
import { LW_LEARN_MODES, LW_SCREENS, lwHashToNav, lwNavToHash, lwNormNav } from './nav.ts';
import {
  LW_COLLOC_GROUP_NAME, LW_IMPORT_ERROR_MSG, LW_READING_ERROR_MSG, lwLazy,
  LW_READING_GROUP, LW_READING_GROUP_NAME, LW_VIDEO_GROUP_NAME,
} from './views/shared.jsx';
import {
  AppBar, CategoryView, GroupForm, LanguageSelectView, NavDrawer, TabBar, ToastStack,
} from './views/shell.jsx';
import { ChoiceView, FillView, LearnView, ReviewView, StudyView } from './views/learn.jsx';
import { FormsView } from './views/forms.jsx';
import { CollocView } from './views/collocations.jsx';
import { VideoView } from './views/video.jsx';
import { AddTextModal, ReaderView, ReadingHome, ReadingView } from './views/reader.jsx';
import { GrammarScreen } from './views/grammar.jsx';
import { LibraryView } from './views/library.jsx';
import { DeleteAccountModal, ProfileView } from './views/profile.jsx';
import { LevelTestScreen } from './views/level-test.jsx';

/* rarely opened screens load on demand (views/shared.jsx, lwLazy) */
const ImportView = lwLazy(() => import('./views/import.jsx').then((m) => ({ default: m.ImportView })));
const AdminView = lwLazy(() => import('./views/admin.jsx').then((m) => ({ default: m.AdminView })));

/* AI reading cards are kept per language (English keeps the original key) */
const lwReadingKey = (lang) => (lang === 'en' ? LW_KEYS.reading : LW_KEYS.reading + '_' + lang);

function lwLoadReading(lang) {
  const saved = lwLoad(lwReadingKey(lang), null);
  const cards = saved && Array.isArray(saved.cards) ? saved.cards : [];
  const index = saved && Number.isInteger(saved.index) ? saved.index : 0;
  return { lang, cards, index: cards.length ? Math.min(index, cards.length - 1) : 0, status: 'idle', error: null };
}

function App() {
  const [theme, setTheme] = useState(() => lwLoad(LW_KEYS.theme, 'light'));
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = signed out
  const [userDoc, setUserDoc] = useState(undefined); // undefined = loading, null = no profile yet (new Google user)
  const [online, setOnline] = useState(() => navigator.onLine);
  const [authInfo, setAuthInfo] = useState(() => lwAuthInfo()); // sign-in methods (password / Google)
  const [groups, setGroups] = useState([]);
  const [words, setWords] = useState([]);
  const [progress, setProgress] = useState({}); // { [wordId]: FSRS progress doc }
  const [activityDocs, setActivityDocs] = useState([]); // daily activity docs of every language
  const [now, setNow] = useState(() => Date.now()); // ticks each minute so due counts stay fresh
  const [texts, setTexts] = useState([]); // reading texts: own + shared (meta only, chapters load on open)
  const [readingProgress, setReadingProgress] = useState({}); // { [textId]: reading_progress doc }
  const [collocations, setCollocations] = useState([]); // own + shared collocation entries
  const [clips, setClips] = useState([]); // video clips of the current language (shared, admin-made)
  const [lessons, setLessons] = useState([]); // grammar lessons (published; admins also see drafts)
  const [lessonProgress, setLessonProgress] = useState({}); // { [lessonId]: lesson_progress doc }
  /* where the user is: a screen (tab), the Learn sub-mode and the Reading and
     Grammar sub-screens (nav.ts). It survives reloads and is mirrored in the URL
     hash; a link with a hash (#/grammar/lesson/<id>) opens that screen. */
  const [nav, setNav] = useState(() => {
    const saved = lwNormNav(lwLoad(LW_KEYS.nav, null));
    return lwHashToNav(window.location.hash, saved) || saved;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false); // group picker sheet on Learn
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [deleteText, setDeleteText] = useState(null); // text awaiting delete confirmation
  /* study groups picked on Learn, per language: { en: [groupId…], ro: […] }
     (older devices saved a plain array — that was English) */
  const [selectedByLang, setSelectedByLang] = useState(() => {
    const saved = lwLoad(LW_KEYS.selected, null);
    if (Array.isArray(saved)) return { en: saved };
    return saved && typeof saved === 'object' ? saved : {};
  });
  /* card direction per language: 'en-ru' = studied language first (EN → RU,
     RO → RU), 'ru-en' = Russian first. Older devices saved a plain string (English). */
  const [directionByLang, setDirectionByLang] = useState(() => {
    const saved = lwLoad(LW_KEYS.direction, null);
    if (typeof saved === 'string') return { en: saved };
    return saved && typeof saved === 'object' ? saved : {};
  });
  const [studyStats, setStudyStats] = useState({ knownCount: 0, poolCount: 0, groupCount: 0 });
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [geminiKeyOpen, setGeminiKeyOpen] = useState(false);
  /* Reading practice state lives here so it survives switching tabs.
     cards — пачка из LW_READING_BATCH сгенерированных текстов-карточек, index — текущая.
     status/error live here too (not inside ReadingView) so that a generation
     started on the reading tab keeps running — and stays visible — even after
     the user navigates away and comes back. cards+index персистятся в
     localStorage (см. эффект ниже), status/error — эфемерны. Какая сторона
     показана (тексты или настройки) определяется в ReadingView наличием
     карточек, отдельного флага нет. */
  const [reading, setReading] = useState(() => lwLoadReading('en'));
  /* Import draft lives here so the generated/typed text survives leaving the
     import tab. status/error drive the AI-fill button + toasts, same as reading.
     groupId is chosen lazily once groups load (see effect below). */
  const [importState, setImportState] = useState({ text: '', groupId: '', status: 'idle', error: null });
  const [toasts, setToasts] = useState([]);
  /* monotonically increasing id: lets us ignore a stale response when the user
     kicks off a newer generation ("Another text") before the previous resolves. */
  const genIdRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);
  const pushToast = useCallback((toast) => {
    const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    setToasts((list) => [...list, { id, ...toast }]);
    return id;
  }, []);

  /* Service worker (vite-plugin-pwa): the app installs and starts offline. When a
     new deploy has downloaded, offer a reload instead of swapping the app under
     the user's hands; until then the old version keeps working. */
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        pushToast({ kind: 'info', title: 'A new version of Lexicon is ready', msg: 'Reload to update.',
          action: { label: 'Reload', run: () => updateSW(true) } });
      },
    });
  }, [pushToast]);

  /* speech had no voice for the language studied (lwUtterance): say so once
     per language and session, instead of letting it sound like English */
  const missingVoiceWarned = useRef(new Set());
  useEffect(() => {
    const onMissing = (e) => {
      const code = e.detail;
      if (missingVoiceWarned.current.has(code)) return;
      missingVoiceWarned.current.add(code);
      const name = lwLangInfo(code).name;
      pushToast({
        kind: 'error',
        title: 'No ' + name + ' voice on this device',
        msg: 'The browser reads ' + name + ' words with another voice, so they sound wrong. Install a ' + name
          + ' voice in your system speech settings (Mac: Accessibility → Spoken Content → System voice → Manage voices; '
          + 'Windows: Time & language → Speech; Android: Text-to-speech → Install voice data), then reload the page.',
      });
    };
    window.addEventListener('lw-missing-voice', onMissing);
    return () => window.removeEventListener('lw-missing-voice', onMissing);
  }, [pushToast]);

  /* Kick off text generation. Runs the promise at the App level so it outlives
     ReadingView unmounting; on completion it updates `reading` and raises a
     bottom-right toast so the user knows they can return to the reading tab. */
  const startReadingGeneration = useCallback((params) => {
    const { pool, levels, topicPrompts, lengthWords } = params;
    const myGen = ++genIdRef.current;
    const genLang = lwCurrentLang();
    setReading((r) => ({ ...r, cards: [], index: 0, status: 'loading', error: null }));
    lwAiGenerateBatch(pool, levels, topicPrompts, lengthWords, LW_READING_BATCH)
      .then((cards) => {
        if (genIdRef.current !== myGen) return; // superseded by a newer request
        /* the user switched language meanwhile: keep the texts for that language */
        setReading((r) => {
          if (r.lang !== genLang) { lwSave(lwReadingKey(genLang), { cards, index: 0 }); return r; }
          return { ...r, cards, index: 0, status: 'idle', error: null };
        });
        pushToast({
          kind: 'success',
          title: 'Texts ready (' + cards.length + ')',
          msg: 'Open the Reading tab and swipe through the cards.',
          action: { label: 'Open', view: 'ai-texts' },
        });
      })
      .catch((e) => {
        if (genIdRef.current !== myGen) return;
        const code = (e && e.code) || 'error';
        setReading((r) => ({ ...r, status: 'idle', error: code }));
        pushToast({
          kind: 'error',
          title: 'Could not generate texts',
          msg: LW_READING_ERROR_MSG[code] || LW_READING_ERROR_MSG.error,
          action: { label: 'Settings', view: 'ai-texts' },
        });
      });
  }, [pushToast]);

  /* Enrich the import draft with AI. Like startReadingGeneration, the promise
     runs at the App level so it outlives the import tab; blocks the form via
     status:'loading' and raises a toast when done. rawWords are the bare words
     (no ipa/tr yet) extracted by ImportView. */
  const startImportAiFill = useCallback((rawWords) => {
    const myGen = ++genIdRef.current;
    setImportState((s) => ({ ...s, status: 'loading', error: null }));
    lwAiFillWords(rawWords)
      .then((res) => {
        if (genIdRef.current !== myGen) return;
        const byWord = {};
        res.forEach((r) => { byWord[r.word.toLowerCase()] = r; });
        setImportState((s) => {
          const lines = s.text.split('\n');
          const out = lines.map((line) => {
            const l = line.trim();
            if (!l) return line;
            const p = lwParseImportLine(l);
            const w = (p && p.word) || (l.indexOf('|') === -1 ? l : '');
            const r = w && byWord[w.toLowerCase()];
            if (!r) return line; // leave lines AI didn't touch untouched
            const forms = lwFormsToText(r.forms, lwCurrentLang(), r.pos);
            return [r.word, r.ipa, r.tr, r.example, r.exampleTr, r.pos, ...(forms ? [forms] : [])].join(' | ');
          });
          return { ...s, text: out.join('\n'), status: 'idle', error: null };
        });
        pushToast({
          kind: 'success',
          title: 'Words filled in',
          msg: 'AI added transcriptions, translations and examples.',
          action: { label: 'Open', view: 'import' },
        });
      })
      .catch((e) => {
        if (genIdRef.current !== myGen) return;
        const code = (e && e.code) || 'error';
        setImportState((s) => ({ ...s, status: 'idle', error: code }));
        pushToast({
          kind: 'error',
          title: 'Could not fill in the words',
          msg: LW_IMPORT_ERROR_MSG[code] || LW_IMPORT_ERROR_MSG.error,
          action: { label: 'Import', view: 'import' },
        });
      });
  }, [pushToast]);

  /* write imported words to Firestore. Words go to the owner of the group: this
     user (shared if an admin), or — for an admin importing into another user's
     group — that user, shared like the group. */
  const importWords = useCallback((items, group) => {
    if (!authUser) return;
    const isAdmin = userDoc && userDoc.role === 'admin';
    const foreign = isAdmin && group && group.userId && group.userId !== authUser.uid;
    const owner = foreign
      ? { userId: group.userId, username: group.username, shared: !!group.shared }
      : { userId: authUser.uid, username: userDoc && userDoc.username, shared: isAdmin };
    items.forEach((w) => lwSetDoc(LW_COLLECTIONS.words, { ...w, ...owner })
      .catch((e) => { console.error('importWords failed', e); alert('Could not import a word: ' + (e && e.message || e)); }));
  }, [authUser, userDoc]);

  /* auth state */
  useEffect(() => lwWatchAuth(setAuthUser), []);

  /* user profile (role, lang) */
  useEffect(() => {
    setAuthInfo(lwAuthInfo());
    if (!authUser) { setUserDoc(undefined); return; }
    return lwWatchUserDoc(authUser.uid, setUserDoc);
  }, [authUser]);

  /* languages this user learns and the one studied now. Everything below —
     groups, words, texts, collocations, lessons — is scoped to `lang`. Set before
     any child renders, so AI prompts, speech and new docs follow it too. */
  const langs = lwUserLangs(userDoc);
  const lang = userDoc && langs.includes(userDoc.lang) ? userDoc.lang : (langs[0] || null);
  lwSetCurrentLang(lang || 'en');
  /* review settings (users.srs, every language) and paused groups (per language) */
  const srs = useMemo(() => lwSrsSettings(userDoc), [userDoc]);
  lwSetSrsSettings(srs);
  const groupStateField = lwLangField('groupState', lang);
  const groupState = (userDoc && userDoc[groupStateField]) || null;
  /* write some of the user's own profile fields (lang, dailyGoal, cefr, avatar) */
  const updateProfile = useCallback((fields) => {
    if (!authUser) return Promise.resolve();
    return lwUpdateUser(authUser.uid, fields).catch((e) => {
      console.error('updateProfile failed', e);
      pushToast({ kind: 'error', title: 'Could not save your profile', msg: (e && e.message) || String(e) });
    });
  }, [authUser, pushToast]);
  /* switch to another language (adding it to the user's list if it is new). The
     open book, lesson and Library group filter belong to the old language. */
  const setLang = useCallback((l) => {
    if (l === lang) return;
    setNav((n) => ({ ...n, reading: { view: 'home' }, grammar: { view: 'home' } }));
    lwSave(LW_KEYS.library, { ...(lwLoad(LW_KEYS.library, null) || {}), groupId: '' });
    updateProfile({ lang: l, langs: langs.includes(l) ? langs : [...langs, l] });
  }, [lang, langs, updateProfile]);
  /* first launch: the languages picked; the first one is studied first */
  const chooseLangs = useCallback((list) => { updateProfile({ langs: list, lang: list[0] }); }, [updateProfile]);
  /* stop learning a language: its words stay in Firestore and come back if it is added again */
  const removeLang = useCallback((l) => {
    const rest = langs.filter((x) => x !== l);
    if (!rest.length) return;
    if (l === lang) setNav((n) => ({ ...n, reading: { view: 'home' }, grammar: { view: 'home' } }));
    updateProfile({ langs: rest, lang: l === lang ? rest[0] : lang });
  }, [lang, langs, updateProfile]);

  /* the AI reading cards of the language studied now */
  useEffect(() => {
    if (lang && reading.lang !== lang) setReading(lwLoadReading(lang));
  }, [lang, reading.lang]);

  const selected = (lang && selectedByLang[lang]) || [];
  const setSelected = useCallback((v) => setSelectedByLang((m) => {
    const cur = m[lang] || [];
    return { ...m, [lang]: typeof v === 'function' ? v(cur) : v };
  }), [lang]);

  /* online/offline banner; Firestore keeps working from its cache meanwhile */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* live sync with this user's Firestore data. Waits for the profile: an admin's
     own docs are mostly shared, and lwWatchUserAndSharedCollection then skips
     them in the "own" query so they aren't read (and billed) twice. Content
     (groups, words, texts, collocations, lessons) is queried for the language
     studied now only; a switch re-subscribes. Until the new language's first
     snapshot arrives the state still holds the old one, which the scoped lists
     below (inLang) filter out. */
  const ownerIsAdmin = userDoc ? userDoc.role === 'admin' : null;
  /* Words: own ones live, shared ones from the device cache, re-read per group
     when the group's updatedAt changes (lwWatchWords, wordsync.ts). The shared
     groups drive that, but only once this language's groups have arrived: an
     empty list before then would look like "every group was deleted". */
  const wordsWatchRef = useRef(null);
  const [groupsLang, setGroupsLang] = useState(null); // language of the groups now in state
  useEffect(() => {
    if (!authUser || ownerIsAdmin === null || !lang) { setGroups([]); setWords([]); setGroupsLang(null); return; }
    const unsubGroups = lwWatchUserAndSharedCollection(LW_COLLECTIONS.groups, authUser.uid,
      (items) => { setGroups(items); setGroupsLang(lang); }, ownerIsAdmin, lang);
    const watch = lwWatchWords({ uid: authUser.uid, isAdmin: ownerIsAdmin, lang }, setWords);
    wordsWatchRef.current = watch;
    return () => { unsubGroups(); watch.stop(); wordsWatchRef.current = null; };
  }, [authUser, ownerIsAdmin, lang]);
  useEffect(() => {
    if (!wordsWatchRef.current || groupsLang !== lang) return;
    wordsWatchRef.current.syncGroups(groups.filter((g) => g.shared && lwDocLang(g) === lang));
  }, [groups, groupsLang, lang]);

  /* admins import into anyone's group: while Import is open they see every
     group and word (other users' private ones too; the rules allow admins). */
  const adminImport = !!authUser && !!userDoc && userDoc.role === 'admin' && nav.tab === 'import';
  const [allGroups, setAllGroups] = useState(null);
  const [allWords, setAllWords] = useState(null);
  useEffect(() => {
    if (!adminImport) { setAllGroups(null); setAllWords(null); return; }
    const unsubGroups = lwWatchCollection(LW_COLLECTIONS.groups, setAllGroups);
    const unsubWords = lwWatchCollection(LW_COLLECTIONS.words, setAllWords);
    return () => { unsubGroups(); unsubWords(); };
  }, [adminImport]);

  /* live sync with this user's progress + daily activity */
  useEffect(() => {
    if (!authUser) { setProgress({}); setActivityDocs([]); return; }
    const unsubProgress = lwWatchUserCollection(LW_COLLECTIONS.progress, authUser.uid,
      (items) => setProgress(Object.fromEntries(items.map((p) => [p.wordId, p]))));
    const unsubActivity = lwWatchUserCollection(LW_COLLECTIONS.activity, authUser.uid, setActivityDocs);
    return () => { unsubProgress(); unsubActivity(); };
  }, [authUser]);

  /* Each language is its own learner: XP, level, streak, daily goal, practice
     time and the week chart come only from this language's activity
     ({ 'YYYY-MM-DD': doc }; docs without `lang` are English). */
  const activity = useMemo(
    () => Object.fromEntries(activityDocs.filter((a) => lwDocLang(a) === lang).map((a) => [a.date, a])),
    [activityDocs, lang]
  );
  const direction = directionByLang[lang] || 'en-ru';
  const setDirection = useCallback((d) => setDirectionByLang((m) => ({ ...m, [lang]: d })), [lang]);

  /* reading texts (own + shared) and where the user is in each */
  useEffect(() => {
    if (!authUser || ownerIsAdmin === null) { setReadingProgress({}); return; }
    return lwWatchUserCollection(LW_COLLECTIONS.readingProgress, authUser.uid,
      (items) => setReadingProgress(Object.fromEntries(items.map((r) => [r.textId, r]))));
  }, [authUser, ownerIsAdmin]);
  useEffect(() => {
    if (!authUser || ownerIsAdmin === null || !lang) { setTexts([]); return; }
    return lwWatchUserAndSharedCollection(LW_COLLECTIONS.texts, authUser.uid, setTexts, ownerIsAdmin, lang);
  }, [authUser, ownerIsAdmin, lang]);

  /* grammar lessons and this user's progress in them */
  const roleForLessons = userDoc ? userDoc.role : null;
  useEffect(() => {
    if (!authUser || !roleForLessons || !lang) { setLessons([]); return; }
    return lwWatchLessons(roleForLessons === 'admin', setLessons, lang);
  }, [authUser, roleForLessons, lang]);
  useEffect(() => {
    if (!authUser) { setLessonProgress({}); return; }
    return lwWatchUserCollection(LW_COLLECTIONS.lessonProgress, authUser.uid,
      (items) => setLessonProgress(Object.fromEntries(items.map((p) => [p.lessonId, p]))));
  }, [authUser]);

  /* video clips of the language studied now */
  useEffect(() => {
    if (!authUser || !lang) { setClips([]); return; }
    return lwWatchClips(lang, setClips);
  }, [authUser, lang]);

  /* collocation entries (own + shared) */
  useEffect(() => {
    if (!authUser || ownerIsAdmin === null || !lang) { setCollocations([]); return; }
    return lwWatchUserAndSharedCollection(LW_COLLECTIONS.collocations, authUser.uid, setCollocations, ownerIsAdmin, lang);
  }, [authUser, ownerIsAdmin, lang]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const dailyGoal = (userDoc && userDoc[lwLangField('dailyGoal', lang)]) || LW_DEFAULT_DAILY_GOAL;

  /* Record one answer from Study / Choice / Fill / Review: the word's next FSRS
     state (`opts.easy`: a fill typed quickly with no mistake) plus today's XP.
     A +50 bonus lands once, on the answer that reaches the daily goal. Snapshots apply local writes immediately, so rapid answers
     already see the updated progress/activity. */
  const lastAnswerAt = useRef(0); // for practice time (activity.ms)
  /* answers sent today that the activity snapshot may not show yet: the
     collocation game records several answers at once, and each must see the
     others so the goal bonus lands only once */
  const sentToday = useRef({ date: '', answers: 0, goalMet: false });
  const recordAnswer = useCallback((wordId, known, mode, opts) => {
    if (!authUser) return;
    const t = Date.now();
    const ms = lwPracticeMs(lastAnswerAt.current, t);
    lastAnswerAt.current = t;
    const date = lwLocalDate(t);
    const today = activity[date] || {};
    const sent = sentToday.current.date === date && sentToday.current.lang === lang ? sentToday.current : { date, lang, answers: 0, goalMet: false };
    const answersBefore = Math.max(today.answers || 0, sent.answers);
    const goalBonus = !today.goalMet && !sent.goalMet && answersBefore + 1 >= dailyGoal ? LW_XP_GOAL_BONUS : 0;
    sentToday.current = { date, lang, answers: answersBefore + 1, goalMet: sent.goalMet || !!goalBonus || !!today.goalMet };
    lwRecordAnswer({
      uid: authUser.uid,
      lang,
      progress: wordId ? lwNextProgress(progress[wordId] || null, wordId, known, mode, t, opts) : null, // null: a grammar test answer
      date,
      correct: known,
      xp: known ? LW_XP_CORRECT : LW_XP_WRONG,
      goalBonus,
      ms,
    }).catch((e) => {
      console.error('recordAnswer failed', e);
      pushToast({ kind: 'error', title: 'Could not save progress', msg: (e && e.message) || String(e) });
    });
    setNow(t);
  }, [authUser, lang, activity, progress, dailyGoal, pushToast]);

  /* persistence (local-only settings) */
  useEffect(() => { document.documentElement.dataset.theme = theme; lwSave(LW_KEYS.theme, theme); }, [theme]);
  useEffect(() => { lwSave(LW_KEYS.selected, selectedByLang); }, [selectedByLang]);
  useEffect(() => { lwSave(LW_KEYS.direction, directionByLang); }, [directionByLang]);
  useEffect(() => { lwSave(LW_KEYS.nav, nav); }, [nav]);
  /* nav → URL: each move to another screen is a browser history entry, so Back
     (and Android's back gesture) returns to the previous screen. The first
     render only replaces the entry; a hash that already means this nav (e.g.
     #/learn for #/learn/cards, or one we just came Back to) is left alone. */
  const navHashSet = useRef(false);
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
    const hash = lwNavToHash(nav);
    const here = lwHashToNav(window.location.hash, nav);
    if (here && lwNavToHash(here) === hash) { navHashSet.current = true; return; }
    if (navHashSet.current) window.history.pushState(null, '', hash);
    else window.history.replaceState(null, '', hash);
    navHashSet.current = true;
  }, [nav]);
  /* URL → nav: Back/Forward, or a hash typed or pasted into the address bar.
     A hash that names no screen is replaced by the current screen's. */
  useEffect(() => {
    const onUrl = () => {
      const next = lwHashToNav(window.location.hash, navRef.current);
      if (next) setNav(next);
      else window.history.replaceState(null, '', lwNavToHash(navRef.current));
    };
    window.addEventListener('popstate', onUrl);
    window.addEventListener('hashchange', onUrl);
    return () => { window.removeEventListener('popstate', onUrl); window.removeEventListener('hashchange', onUrl); };
  }, []);
  /* персистим пачку карточек чтения (без эфемерных status/error) */
  useEffect(() => {
    lwSave(lwReadingKey(reading.lang), { cards: reading.cards, index: reading.index });
  }, [reading.lang, reading.cards, reading.index]);

  /* content of the language studied now (docs without `lang` are English) */
  const inLang = useCallback((d) => lwDocLang(d) === lang, [lang]);
  const scopedGroups = useMemo(() => groups.filter(inLang), [groups, inLang]);
  const scopedWords = useMemo(() => words.filter(inLang), [words, inLang]);
  const scopedTexts = useMemo(() => texts.filter(inLang), [texts, inLang]);
  const scopedCollocations = useMemo(() => collocations.filter(inLang), [collocations, inLang]);
  const scopedLessons = useMemo(() => lessons.filter(inLang), [lessons, inLang]);

  /* default selection: every top-level group of this language, once its groups
     load (only if the user never picked for this language) */
  useEffect(() => {
    if (lang && selectedByLang[lang] == null && scopedGroups.length) {
      setSelected(scopedGroups.filter((g) => !g.parentId).map((g) => g.id));
    }
  }, [lang, selectedByLang, scopedGroups, setSelected]);

  /* keep this language's selection valid if a group is deleted (skip until its
     groups have loaded). Only the current language's groups are loaded, so the
     other languages' selections are left as they are. */
  useEffect(() => {
    if (!lang || !scopedGroups.length) return;
    setSelectedByLang((m) => {
      if (!m[lang]) return m;
      const kept = m[lang].filter((id) => scopedGroups.some((g) => g.id === id));
      return kept.length === m[lang].length ? m : { ...m, [lang]: kept };
    });
  }, [lang, scopedGroups]);

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const countByGroup = useMemo(() => {
    const m = {};
    scopedGroups.forEach((g) => { m[g.id] = 0; });
    scopedWords.forEach((w) => { if (m[w.groupId] != null) m[w.groupId]++; });
    return m;
  }, [scopedGroups, scopedWords]);

  /* Learn → Review: 'focus' plays the groups selected in Learn (plus a small
     background share), 'all' every due word; paused groups never come up */
  const [reviewScope, setReviewScope] = useState(() => lwLoad(LW_KEYS.reviewScope, 'focus'));
  useEffect(() => { lwSave(LW_KEYS.reviewScope, reviewScope); }, [reviewScope]);
  const isPaused = useCallback((gid) => lwGroupPaused(gid, groupById, groupState), [groupById, groupState]);
  const reviewPlan = useMemo(() => lwReviewQueue({
    words: scopedWords, progress, now, focus: selected, scope: reviewScope, isPaused, srs,
  }), [scopedWords, progress, now, selected, reviewScope, isPaused, srs]);
  /* Grammar → Review: completed lessons whose rule is due again (lwLessonReviewQueue) */
  const grammarPlan = useMemo(() => lwLessonReviewQueue(scopedLessons, lessonProgress, now), [scopedLessons, lessonProgress, now]);
  /* pause or resume reviews of a group (users.groupState, per language) */
  const setGroupPaused = useCallback((gid, paused) => {
    const next = { ...(groupState || {}) };
    if (paused) next[gid] = 'paused'; else delete next[gid];
    updateProfile({ [groupStateField]: next });
  }, [groupState, groupStateField, updateProfile]);

  /* streak / goal / XP / review queue size for the footer (dashboard comes in stage 3).
     Streak, goal and XP count every language; due and status counts only this one's words.
     Progress for words that no longer exist (e.g. a shared word an admin deleted) is ignored.
     dueCount is the size of the next Review session (scope, paused groups, session size). */
  const stats = useMemo(() => {
    const today = activity[lwLocalDate(now)] || {};
    const xp = lwTotalXp(activity);
    const dueCount = srs.session > 0 ? Math.min(srs.session, reviewPlan.ids.length) : reviewPlan.ids.length;
    const statusCounts = lwStatusCounts(progress, scopedWords, now);
    /* Learn → Forms: studied words of the chosen groups whose forms are new or due */
    const formsDue = lwFormsDeck(scopedWords, selected, progress, lang, now).due.length;
    const grammarDue = grammarPlan.ids.length;
    return {
      streak: lwStreak(activity, now),
      todayAnswers: today.answers || 0,
      goal: dailyGoal,
      xp,
      level: lwLevel(xp),
      dueCount,
      formsDue,
      grammarDue,
      statusCounts,
      totalMs: lwTotalMs(activity),
      week: lwLastDays(activity, now, 7),
    };
  }, [activity, progress, scopedWords, now, dailyGoal, reviewPlan, srs, selected, lang, grammarPlan]);

  /* Badges, per language like every other stat: metrics from the current
     language's data; earned ones are kept in users/{uid}.badges (badges_<lang>
     for non-English, lwLangField). New ones are saved 2 s after the data
     settles and announced with a toast; the very first time, everything
     already earned is saved quietly with a single toast. */
  const badgesField = lwLangField('badges', lang);
  const earnedBadges = userDoc ? userDoc[badgesField] : undefined;
  const badgeStates = useMemo(() => {
    if (!authUser) return [];
    const textIds = new Set(scopedTexts.map((t) => t.id));
    const metrics = lwBadgeMetrics({
      uid: authUser.uid, activity, progress, words: scopedWords,
      readingProgress: Object.fromEntries(Object.entries(readingProgress).filter(([id]) => textIds.has(id))),
      lessons: scopedLessons, lessonProgress, collocations: scopedCollocations,
      levelTest: userDoc && userDoc[lwLangField('levelTest', lang)], now,
    });
    return lwBadgeStates(metrics, earnedBadges);
  }, [authUser, activity, progress, scopedWords, scopedTexts, readingProgress, scopedLessons, lessonProgress, scopedCollocations, now, earnedBadges, userDoc, lang]);
  useEffect(() => {
    if (!authUser || !userDoc || !lang) return;
    const fresh = badgeStates.filter((b) => b.reached && !b.earnedAt);
    if (!fresh.length) return;
    const t = setTimeout(() => {
      const ts = Date.now();
      const fields = {};
      fresh.forEach((b) => { fields[badgesField + '.' + b.badge.id] = ts; });
      lwUpdateUser(authUser.uid, fields).catch((e) => console.error('badges', e));
      if (!earnedBadges) {
        pushToast({ kind: 'success', title: 'You have ' + fresh.length + (fresh.length === 1 ? ' badge' : ' badges'), msg: 'See your achievements in Profile.', action: { label: 'View', view: 'profile' } });
      } else {
        fresh.forEach((b) => pushToast({ kind: 'success', title: 'New badge: ' + b.badge.title, msg: b.badge.icon + ' ' + b.badge.text, action: { label: 'View', view: 'profile' } }));
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [badgeStates, authUser, userDoc, lang, badgesField, earnedBadges, pushToast]);

  const scopedSelected = selected;
  const scopedCountByGroup = countByGroup;

  /* Navigate by name. Accepts screens ('reading', 'library', ...), Learn modes
     ('cards', 'review', 'choice', 'fill'; legacy 'study' = cards) and 'category'
     (opens the group picker on Learn) — toast actions use these names. */
  const goTo = useCallback((name) => {
    setDrawerOpen(false);
    if (name === 'study') name = 'cards';
    if (name === 'category') { setNav((n) => ({ ...n, tab: 'learn' })); setGroupsOpen(true); return; }
    if (name === 'ai-texts') { setNav((n) => ({ ...n, tab: 'reading', reading: { view: 'ai' } })); return; }
    /* Grammar again while already on it returns to the lesson list */
    if (name === 'grammar') { setNav((n) => ({ ...n, tab: 'grammar', grammar: n.tab === 'grammar' ? { view: 'home' } : n.grammar })); return; }
    if (name === 'collocations') {
      lwSave(LW_KEYS.library, { ...(lwLoad(LW_KEYS.library, null) || {}), view: 'colloc' });
      setNav((n) => ({ ...n, tab: 'library' }));
      return;
    }
    if (name === 'reading-home') { setNav((n) => ({ ...n, tab: 'reading', reading: { view: 'home' } })); return; }
    /* Reading again while already on it returns to the Reading home (out of a book / AI practice) */
    if (name === 'reading') { setNav((n) => ({ ...n, tab: 'reading', reading: n.tab === 'reading' ? { view: 'home' } : n.reading })); return; }
    if (LW_LEARN_MODES.some((m) => m.id === name)) { setNav((n) => ({ ...n, tab: 'learn', learnMode: name })); return; }
    if (LW_SCREENS.includes(name)) setNav((n) => ({ ...n, tab: name }));
  }, []);

  /* An auto-created group of this user ("From reading", "Collocations"):
     found by name among their own leaf groups with the same `shared`, created
     on first use. Resolves to the group id. */
  const ensureAutoGroup = useCallback(async (name, color, shared) => {
    const existing = lwLeafGroups(scopedGroups).find((g) => g.name === name && g.userId === authUser.uid && !!g.shared === shared);
    if (existing) return existing.id;
    const id = lwUid() + lwUid();
    await lwSetDoc(LW_COLLECTIONS.groups,
      { id, name, color, userId: authUser.uid, username: userDoc && userDoc.username, shared });
    return id;
  }, [authUser, userDoc, scopedGroups]);

  /* "+ Add to cards" from the reader. groupId may be LW_READING_GROUP: then the
     user's "From reading" group is used, created on first use. Reader words stay
     private (shared: false) even for admins. Resolves to the saved word. */
  const addWordFromReading = useCallback(async (fields, groupId) => {
    const base = { userId: authUser.uid, username: userDoc && userDoc.username, shared: false };
    let gid = groupId;
    if (!gid || gid === LW_READING_GROUP) gid = await ensureAutoGroup(LW_READING_GROUP_NAME, '#2F9E8F', false);
    const word = {
      ...fields, ...base, id: fields.id || lwUid() + lwUid(), groupId: gid,
      createdAt: fields.createdAt || Date.now(),
    };
    await lwSetDoc(LW_COLLECTIONS.words, word);
    return word;
  }, [authUser, userDoc, ensureAutoGroup]);

  /* "+ Add to cards" from a video clip: a private card in "From video" */
  const addWordFromVideo = useCallback(async (fields) => {
    const gid = await ensureAutoGroup(LW_VIDEO_GROUP_NAME, '#D6453E', false);
    const word = {
      ...fields, userId: authUser.uid, username: userDoc && userDoc.username, shared: false,
      id: lwUid() + lwUid(), groupId: gid, createdAt: Date.now(),
    };
    await lwSetDoc(LW_COLLECTIONS.words, word);
    return word;
  }, [authUser, userDoc, ensureAutoGroup]);

  /* Save a collocation entry. New phrases become cards in the "Collocations"
     group first, then the entry links them by id. Admin entries and their new
     cards are shared, like everything an admin creates. */
  const saveCollocation = useCallback(async (entry, phrases, newPhrases) => {
    const isAdminUser = userDoc && userDoc.role === 'admin';
    const shared = entry.id ? !!entry.shared : !!isAdminUser;
    const owner = { userId: entry.userId || authUser.uid, username: entry.username || (userDoc && userDoc.username), shared };
    const links = phrases.slice();
    if (newPhrases.length) {
      const gid = await ensureAutoGroup(LW_COLLOC_GROUP_NAME, '#5B6CE8', shared);
      const t = Date.now();
      for (let i = 0; i < newPhrases.length; i++) {
        const { partner, ...fields } = newPhrases[i];
        const id = lwUid() + lwUid();
        await lwSetDoc(LW_COLLECTIONS.words, {
          ...fields, pos: 'phrase', id, groupId: gid, createdAt: t + i,
          userId: authUser.uid, username: userDoc && userDoc.username, shared,
        });
        links.push({ wordId: id, partner });
      }
    }
    const doc = {
      ...entry, ...owner, id: entry.id || lwUid() + lwUid(),
      phrases: links, createdAt: entry.createdAt || Date.now(), updatedAt: Date.now(),
    };
    await lwSetDoc(LW_COLLECTIONS.collocations, doc);
    return doc;
  }, [authUser, userDoc, ensureAutoGroup]);

  const wordIndex = useMemo(() => lwWordsIndex(scopedWords), [scopedWords]);

  /* Reading time counts as practice time (activity.ms, no answers/XP): every
     30 s while a text is open, the page is visible and the user did something
     in the last minute (scroll, tap, key) or speech is playing. */
  const lastActiveAt = useRef(Date.now());
  useEffect(() => {
    const mark = () => { lastActiveAt.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchmove'];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, mark));
  }, []);
  const readingOpen = nav.tab === 'reading' && (nav.reading.view === 'reader' || nav.reading.view === 'ai');
  useEffect(() => {
    if (!authUser || !readingOpen) return;
    const TICK = 30 * 1000;
    const t = setInterval(() => {
      const speaking = 'speechSynthesis' in window && window.speechSynthesis.speaking;
      if (document.hidden || (!speaking && Date.now() - lastActiveAt.current > 60 * 1000)) return;
      lwAddPracticeTime(authUser.uid, lang, lwLocalDate(Date.now()), TICK)
        .catch((e) => console.error('reading time', e));
    }, TICK);
    return () => clearInterval(t);
  }, [authUser, lang, readingOpen]);

  /* ---- grammar ---- */
  const setGrammar = useCallback((g) => setNav((n) => ({ ...n, tab: 'grammar', grammar: g })), []);
  const lessonError = useCallback((title) => (e) => {
    console.error(title, e);
    pushToast({ kind: 'error', title, msg: (e && e.message) || String(e) });
  }, [pushToast]);
  /* admin: save a lesson; a new one (or one moved to another topic) goes last in its topic */
  const saveLesson = useCallback((lesson, publish) => {
    const prev = scopedLessons.find((l) => l.id === lesson.id);
    const sameTopic = (l) => (l.topic || '').trim().toLowerCase() === lesson.topic.toLowerCase() && l.id !== lesson.id;
    const moved = !prev || (prev.topic || '').trim().toLowerCase() !== lesson.topic.toLowerCase();
    const order = moved ? Math.max(0, ...scopedLessons.filter(sameTopic).map((l) => l.order || 0)) + 10 : (prev.order || 0);
    const doc = {
      ...lesson, id: lesson.id || lwUid() + lwUid(), order, published: !!publish,
      userId: (prev && prev.userId) || authUser.uid, username: (prev && prev.username) || userDoc.username, shared: true,
      createdAt: (prev && prev.createdAt) || Date.now(), updatedAt: Date.now(),
    };
    setGrammar({ view: 'lesson', lessonId: doc.id });
    lwSetDoc(LW_COLLECTIONS.lessons, doc)
      .then(() => pushToast({ kind: 'success', title: publish ? 'Lesson published' : 'Draft saved', msg: doc.title }))
      .catch(lessonError('Could not save the lesson'));
  }, [scopedLessons, authUser, userDoc, setGrammar, pushToast, lessonError]);
  /* admin: move a lesson up/down within its topic (orders are rewritten as 10, 20, …) */
  const moveLesson = useCallback((topicLessons, index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= topicLessons.length) return;
    const list = topicLessons.slice();
    [list[index], list[j]] = [list[j], list[index]];
    list.forEach((l, i) => {
      const order = (i + 1) * 10;
      if (l.order !== order) lwSetDoc(LW_COLLECTIONS.lessons, { ...l, order }).catch(lessonError('Could not reorder'));
    });
  }, [lessonError]);
  const saveLessonProgress = useCallback((lessonId, fields) => lwSaveLessonProgress(authUser.uid, lessonId, fields)
    .catch(lessonError('Could not save lesson progress')), [authUser, lessonError]);
  /* a finished test: attempts, last/best score; 10/10 completes the lesson (+50 XP
     the first time) and schedules its first review (lesson_progress.srs) */
  const finishLessonTest = useCallback((lessonId, score) => {
    const p = lessonProgress[lessonId] || {};
    const passed = score >= LW_LESSON_TASKS;
    const fields = { attempts: (p.attempts || 0) + 1, last: score, best: Math.max(p.best || 0, score) };
    if (passed && !p.completedAt) {
      fields.completedAt = Date.now();
      fields.srs = lwNextLessonSrs(null, lessonId, score, LW_LESSON_TASKS, Date.now());
      lwAddBonusXp(authUser.uid, lang, lwLocalDate(Date.now()), LW_XP_LESSON_BONUS).catch(lessonError('Could not add XP'));
    }
    saveLessonProgress(lessonId, fields);
    return passed && !p.completedAt;
  }, [lessonProgress, authUser, lang, saveLessonProgress, lessonError]);
  /* Grammar → Review: a lesson's tasks in this session are done; reschedule its rule */
  const gradeLessonReview = useCallback((lessonId, right, total) => {
    const p = lessonProgress[lessonId] || {};
    saveLessonProgress(lessonId, { srs: lwNextLessonSrs(p.srs, lessonId, right, total, Date.now()) });
  }, [lessonProgress, saveLessonProgress]);

  /* save a new text (meta + chapters); admins may publish it for everyone */
  const saveText = useCallback((meta, chapters) => lwSaveText({
    ...meta,
    id: lwUid() + lwUid(),
    userId: authUser.uid,
    username: userDoc && userDoc.username,
    chapters: chapters.map((c) => ({ title: c.title || '', words: c.paragraphs.reduce((n, p) => n + lwWordCount(p), 0) })),
    createdAt: Date.now(),
  }, chapters), [authUser, userDoc]);

  if (authUser === undefined) {
    return null; /* firebase auth still initializing */
  }
  if (authUser === null) {
    return <AuthView />;
  }
  if (userDoc === undefined) {
    return null; /* user profile still loading */
  }
  if (userDoc === null) {
    /* signed in but no profile: a first Google sign-in picks a username. Password
       sign-ups write their profile right after creating the account, so for them
       this is only a moment between the two writes. */
    if (authInfo.password) return null;
    return <ChooseUsernameView email={authUser.email} />;
  }
  if (!lang) {
    return <LanguageSelectView onSelect={chooseLangs} />;
  }

  const isAdmin = userDoc.role === 'admin';
  /* Learn modes with something to play: Forms once a word of this language has
     forms (never in English), Video once there are clips (admins always see it:
     they add clips there). A hidden mode in the URL or saved nav shows Cards. */
  const learnModes = LW_LEARN_MODES.filter((m) => (m.id !== 'forms' || lwHasForms(scopedWords, lang))
    && (m.id !== 'video' || isAdmin || clips.length > 0));
  const { tab } = nav;
  const learnMode = learnModes.some((m) => m.id === nav.learnMode) ? nav.learnMode : 'cards';
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const learnProps = {
    words: scopedWords, groupById, direction, progress, recordAnswer,
    goLibrary: () => goTo('library'), goCategory: () => setGroupsOpen(true),
  };

  return (
    <div className="app">
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        tab={tab} learnMode={learnMode} goTo={goTo} stats={stats}
        user={userDoc} isAdmin={isAdmin} wordCount={scopedWords.length} lang={lang} langs={langs} setLang={setLang}
        theme={theme} onToggleTheme={toggleTheme}
        onGeminiKey={() => { setDrawerOpen(false); setGeminiKeyOpen(true); }} />
      <div className="app-main">
        <AppBar onMenu={() => setDrawerOpen(true)} level={stats.level} xp={stats.xp} onLevel={() => goTo('profile')} />
        {!online && (
          <div className="offline-bar" role="status">
            <Ic.CloudOff width="16" height="16" /> Offline — answers will sync when you're back.
          </div>
        )}
        {/* keyed by language: every view starts fresh (filters, decks, open sheets) after a switch */}
        <main key={lang} className={'content content-' + tab}>
          {tab === 'learn' ? (
            <LearnView mode={learnMode} setMode={(m) => goTo(m)} modes={learnModes} stats={stats} studyStats={studyStats}
              selectedCount={scopedSelected.length} onPickGroups={() => setGroupsOpen(true)}
              reviewScope={reviewScope} setReviewScope={setReviewScope} reviewPlan={reviewPlan}>
              {learnMode === 'review' ? (
                <ReviewView key={reviewScope} {...learnProps} now={now} plan={reviewPlan} scope={reviewScope} session={srs.session}
                  showAll={() => setReviewScope('all')} goStudy={() => goTo('cards')} />
              ) : learnMode === 'choice' ? (
                <ChoiceView {...learnProps} selected={scopedSelected} onStatsChange={setStudyStats} />
              ) : learnMode === 'fill' ? (
                <FillView {...learnProps} selected={scopedSelected} onStatsChange={setStudyStats} />
              ) : learnMode === 'forms' ? (
                <FormsView {...learnProps} selected={scopedSelected} onStatsChange={setStudyStats} lang={lang}
                  goStudy={() => goTo('cards')} />
              ) : learnMode === 'video' ? (
                <VideoView key={'video-' + lang} clips={clips} words={scopedWords} progress={progress} now={now} online={online}
                  recordAnswer={recordAnswer} addWord={addWordFromVideo} isAdmin={isAdmin} uid={authUser.uid}
                  lang={lang} pushToast={pushToast} />
              ) : learnMode === 'colloc' ? (
                <CollocView key="colloc" entries={scopedCollocations} words={scopedWords} progress={progress} now={now}
                  recordAnswer={recordAnswer} goCatalog={() => goTo('collocations')} goStudy={() => goTo('cards')} />
              ) : (
                <StudyView {...learnProps} groups={scopedGroups} selected={scopedSelected} onStatsChange={setStudyStats} />
              )}
            </LearnView>
          ) : tab === 'reading' && nav.reading.view === 'reader' && scopedTexts.some((t) => t.id === nav.reading.textId) ? (
            <ReaderView key={nav.reading.textId} text={scopedTexts.find((t) => t.id === nav.reading.textId)}
              prog={readingProgress[nav.reading.textId]} uid={authUser.uid}
              words={scopedWords} wordIndex={wordIndex} progress={progress} now={now} groups={scopedGroups} addWord={addWordFromReading}
              recordAnswer={recordAnswer} onBack={() => goTo('reading-home')} />
          ) : tab === 'reading' && nav.reading.view === 'ai' ? (
            <ReadingView groups={scopedGroups} words={scopedWords} countByGroup={scopedCountByGroup}
              reading={reading} setReading={setReading}
              startGenerate={startReadingGeneration}
              defaultLevel={userDoc[lwCefrField(lang)]}
              wordIndex={wordIndex} progress={progress} now={now} addWord={addWordFromReading}
              onBack={() => goTo('reading-home')}
              goLibrary={() => goTo('library')} />
          ) : tab === 'reading' ? (
            <ReadingHome texts={scopedTexts} progressByText={readingProgress} userId={authUser.uid} isAdmin={isAdmin}
              aiReady={(reading.cards || []).length}
              onOpen={(id) => setNav((n) => ({ ...n, reading: { view: 'reader', textId: id } }))}
              onOpenAi={() => goTo('ai-texts')}
              onAdd={() => setAddTextOpen(true)}
              onDelete={(t) => setDeleteText(t)} />
          ) : tab === 'grammar' ? (
            <GrammarScreen nav={nav.grammar} setGrammar={setGrammar} lessons={scopedLessons} progressBy={lessonProgress}
              isAdmin={isAdmin} userLevel={userDoc[lwCefrField(lang)]} recordAnswer={recordAnswer}
              reviewPlan={grammarPlan} now={now} gradeReview={gradeLessonReview}
              saveLesson={saveLesson} moveLesson={moveLesson} saveProgress={saveLessonProgress} finishTest={finishLessonTest}
              deleteLesson={(l) => { setGrammar({ view: 'home' }); lwDeleteDoc(LW_COLLECTIONS.lessons, l.id).catch(lessonError('Could not delete the lesson')); }} />
          ) : tab === 'library' ? (
            <LibraryView groups={scopedGroups} words={scopedWords} userId={authUser.uid} username={userDoc.username} isAdmin={isAdmin}
              progress={progress} now={now} direction={direction} recordAnswer={recordAnswer}
              collocations={scopedCollocations} saveCollocation={saveCollocation} pushToast={pushToast} clips={clips}
              groupState={groupState} setGroupPaused={setGroupPaused}
              goImport={() => goTo('import')} />
          ) : tab === 'import' ? (
            <ImportView groups={allGroups ? allGroups.filter(inLang) : scopedGroups}
              words={allWords ? allWords.filter(inLang) : scopedWords} uid={authUser.uid} importState={importState} setImportState={setImportState}
              startAiFill={startImportAiFill} onImport={importWords}
              goLibrary={() => goTo('library')} />
          ) : tab === 'admin' && isAdmin ? (
            <AdminView currentUid={authUser.uid} />
          ) : tab === 'leveltest' ? (
            <LevelTestScreen lang={lang} user={userDoc} uid={authUser.uid} isAdmin={isAdmin} updateProfile={updateProfile}
              pushToast={pushToast} onClose={() => goTo('profile')} />
          ) : (
            <ProfileView user={userDoc} stats={stats} badges={badgeStates} updateProfile={updateProfile} srs={srs}
              authInfo={authInfo} refreshAuthInfo={() => setAuthInfo(lwAuthInfo())}
              pushToast={pushToast} goLearn={() => goTo('cards')} goLevelTest={() => goTo('leveltest')}
              theme={theme} onToggleTheme={toggleTheme}
              direction={direction} setDirection={setDirection}
              lang={lang} langs={langs} setLang={setLang} removeLang={removeLang}
              onGeminiKey={() => setGeminiKeyOpen(true)}
              onLogout={() => lwLogout()}
              onDeleteAccount={() => setDeleteAccountOpen(true)} />
          )}
        </main>
      </div>
      <TabBar tab={tab} goTo={goTo} />
      {groupsOpen && (
        <Modal title="Study groups" sheet onClose={() => setGroupsOpen(false)}>
          <CategoryView groups={scopedGroups} selected={scopedSelected} setSelected={setSelected}
            countByGroup={scopedCountByGroup} ctaLabel="Done" goStudy={() => setGroupsOpen(false)} />
        </Modal>
      )}
      {addTextOpen && <AddTextModal isAdmin={isAdmin} onSave={saveText} onClose={() => setAddTextOpen(false)} />}
      {deleteText && (
        <Modal title="Delete text" onClose={() => setDeleteText(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDeleteText(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const t = deleteText;
              setDeleteText(null);
              lwDeleteText(t.id, (t.chapters || []).length)
                .then(() => { if (readingProgress[t.id]) return lwDeleteReadingProgress(authUser.uid, t.id); })
                .catch((e) => pushToast({ kind: 'error', title: 'Could not delete the text', msg: (e && e.message) || String(e) }));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete <strong>{deleteText.title}</strong>{deleteText.shared ? ' for everyone' : ''}? This can't be undone.</p>
        </Modal>
      )}
      {deleteAccountOpen && <DeleteAccountModal hasPassword={authInfo.password} onClose={() => setDeleteAccountOpen(false)} />}
      {geminiKeyOpen && <GeminiKeyModal onClose={() => setGeminiKeyOpen(false)} />}
      <ToastStack toasts={toasts}
        onDismiss={dismissToast}
        onAction={(action) => { if (action && action.run) action.run(); else if (action && action.view) goTo(action.view); }} />
    </div>
  );
}

/* A render error used to unmount the whole tree and leave a blank page.
   Show what broke instead, with a reload that skips the browser cache. */
class LwErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info && info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return window.lwRenderFatal(this.state.error, React.createElement);
  }
}

/* Console API: scripts/*.mjs and books run in the browser console and call these as window.lwX. */
Object.assign(window, { App, GroupForm });

createRoot(document.getElementById('root')).render(<LwErrorBoundary><App /></LwErrorBoundary>);

window.lwAppStarted = true;
