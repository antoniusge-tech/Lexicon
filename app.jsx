/* app.jsx — main App: nav, theme, study + library views, persistence */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* Fisher–Yates */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Navigation: four tabs (bottom tab bar on mobile, sidebar on desktop) plus
   import/admin screens reached from the menu. Learn has four sub-modes. */
const LW_LEARN_MODES = [
  { id: 'cards', label: 'Cards' },
  { id: 'review', label: 'Review' },
  { id: 'choice', label: 'Choice' },
  { id: 'fill', label: 'Fill' },
  { id: 'colloc', label: 'Phrases' },
  { id: 'video', label: 'Video' },
];
const LW_TABS = [
  { id: 'learn', label: 'Learn', icon: Ic.Learn },
  { id: 'reading', label: 'Reading', icon: Ic.Book },
  { id: 'grammar', label: 'Grammar', icon: Ic.Grammar },
  { id: 'library', label: 'Library', icon: Ic.Library },
  { id: 'profile', label: 'Profile', icon: Ic.Person },
];
const LW_SCREENS = ['learn', 'reading', 'grammar', 'library', 'profile', 'import', 'admin', 'leveltest'];
const LW_ROLE_LABEL = { admin: 'Admin', premium: 'Premium', user: 'User' };

/* Human-readable reading-generation errors, keyed by the .code set in data.jsx.
   Reused by the reading tab's inline hints and by the toast messages. */
const LW_READING_ERROR_MSG = {
  quota: 'Daily Gemini limit reached. Try again later.',
  'bad-key': 'Your Gemini key is invalid. Update it in Profile → Gemini API key.',
  refusal: 'The model could not write a text. Try again.',
  overload: 'Gemini is overloaded right now. Try again in a minute.',
  empty: 'This group has no words yet.',
  error: 'AI service error. Try again later.',
};

/* Same, but for the import tab's "Заполнить с AI" (batch word enrichment). */
const LW_IMPORT_ERROR_MSG = {
  quota: 'Daily Gemini limit reached. Try again later.',
  'bad-key': 'Your Gemini key is invalid. Update it in Profile → Gemini API key.',
  refusal: 'The model could not process the list. Try fewer words.',
  overload: 'Gemini is overloaded right now. Try again in a minute.',
  error: 'AI service error. Try again later.',
};

/* AI reading cards are kept per language (English keeps the original key) */
const lwReadingKey = (lang) => (lang === 'en' ? LW_KEYS.reading : LW_KEYS.reading + '_' + lang);
function lwLoadReading(lang) {
  const saved = window.lwLoad(lwReadingKey(lang), null);
  const cards = saved && Array.isArray(saved.cards) ? saved.cards : [];
  const index = saved && Number.isInteger(saved.index) ? saved.index : 0;
  return { lang, cards, index: cards.length ? Math.min(index, cards.length - 1) : 0, status: 'idle', error: null };
}

function App() {
  const [theme, setTheme] = useState(() => window.lwLoad(LW_KEYS.theme, 'light'));
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = signed out
  const [userDoc, setUserDoc] = useState(undefined); // undefined = loading, null = no profile yet (new Google user)
  const [online, setOnline] = useState(() => navigator.onLine);
  const [authInfo, setAuthInfo] = useState(() => window.lwAuthInfo()); // sign-in methods (password / Google)
  const [groups, setGroups] = useState([]);
  const [words, setWords] = useState([]);
  const [progress, setProgress] = useState({}); // { [wordId]: Leitner progress doc }
  const [activityDocs, setActivityDocs] = useState([]); // daily activity docs of every language
  const [now, setNow] = useState(() => Date.now()); // ticks each minute so due counts stay fresh
  const [texts, setTexts] = useState([]); // reading texts: own + shared (meta only, chapters load on open)
  const [readingProgress, setReadingProgress] = useState({}); // { [textId]: reading_progress doc }
  const [collocations, setCollocations] = useState([]); // own + shared collocation entries
  const [clips, setClips] = useState([]); // video clips of the current language (shared, admin-made)
  const [lessons, setLessons] = useState([]); // grammar lessons (published; admins also see drafts)
  const [lessonProgress, setLessonProgress] = useState({}); // { [lessonId]: lesson_progress doc }
  /* where the user is: a screen (tab) + the Learn sub-mode; both survive reloads */
  const [nav, setNav] = useState(() => {
    const saved = window.lwLoad(LW_KEYS.nav, null) || {};
    return {
      tab: LW_SCREENS.includes(saved.tab) ? saved.tab : 'learn',
      learnMode: LW_LEARN_MODES.some((m) => m.id === saved.learnMode) ? saved.learnMode : 'cards',
      /* Reading sub-screen: library home, AI practice, or a text open in the reader */
      reading: saved.reading && ['home', 'ai', 'reader'].includes(saved.reading.view) ? saved.reading : { view: 'home' },
      /* Grammar sub-screen: lesson list, a lesson, its test, or the lesson editor (admins) */
      grammar: saved.grammar && ['home', 'lesson', 'quiz', 'edit'].includes(saved.grammar.view) ? saved.grammar : { view: 'home' },
    };
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false); // group picker sheet on Learn
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [deleteText, setDeleteText] = useState(null); // text awaiting delete confirmation
  /* study groups picked on Learn, per language: { en: [groupId…], ro: […] }
     (older devices saved a plain array — that was English) */
  const [selectedByLang, setSelectedByLang] = useState(() => {
    const saved = window.lwLoad(LW_KEYS.selected, null);
    if (Array.isArray(saved)) return { en: saved };
    return saved && typeof saved === 'object' ? saved : {};
  });
  /* card direction per language: 'en-ru' = studied language first (EN → RU,
     RO → RU), 'ru-en' = Russian first. Older devices saved a plain string (English). */
  const [directionByLang, setDirectionByLang] = useState(() => {
    const saved = window.lwLoad(LW_KEYS.direction, null);
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

  /* speech had no voice for the language studied (lwUtterance): say so once
     per language and session, instead of letting it sound like English */
  const missingVoiceWarned = useRef(new Set());
  useEffect(() => {
    const onMissing = (e) => {
      const code = e.detail;
      if (missingVoiceWarned.current.has(code)) return;
      missingVoiceWarned.current.add(code);
      const name = window.lwLangInfo(code).name;
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
    const genLang = window.lwCurrentLang();
    setReading((r) => ({ ...r, cards: [], index: 0, status: 'loading', error: null }));
    window.lwAiGenerateBatch(pool, levels, topicPrompts, lengthWords, window.LW_READING_BATCH)
      .then((cards) => {
        if (genIdRef.current !== myGen) return; // superseded by a newer request
        /* the user switched language meanwhile: keep the texts for that language */
        setReading((r) => {
          if (r.lang !== genLang) { window.lwSave(lwReadingKey(genLang), { cards, index: 0 }); return r; }
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
    window.lwAiFillWords(rawWords)
      .then((res) => {
        if (genIdRef.current !== myGen) return;
        const byWord = {};
        res.forEach((r) => { byWord[r.word.toLowerCase()] = r; });
        setImportState((s) => {
          const lines = s.text.split('\n');
          const out = lines.map((line) => {
            const l = line.trim();
            if (!l) return line;
            const p = window.lwParseImportLine(l);
            const w = (p && p.word) || (l.indexOf('|') === -1 ? l : '');
            const r = w && byWord[w.toLowerCase()];
            if (!r) return line; // leave lines AI didn't touch untouched
            return [r.word, r.ipa, r.tr, r.example, r.exampleTr, r.pos].join(' | ');
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

  /* write imported words to Firestore (owned by this user) */
  const importWords = useCallback((items) => {
    if (!authUser) return;
    const isAdmin = userDoc && userDoc.role === 'admin';
    items.forEach((w) => window.lwSetDoc(window.LW_COLLECTIONS.words,
      { ...w, userId: authUser.uid, username: userDoc && userDoc.username, shared: isAdmin })
      .catch((e) => { console.error('importWords failed', e); alert('Could not import a word: ' + (e && e.message || e)); }));
  }, [authUser, userDoc]);

  /* auth state */
  useEffect(() => window.lwWatchAuth(setAuthUser), []);

  /* user profile (role, lang) */
  useEffect(() => {
    setAuthInfo(window.lwAuthInfo());
    if (!authUser) { setUserDoc(undefined); return; }
    return window.lwWatchUserDoc(authUser.uid, setUserDoc);
  }, [authUser]);

  /* languages this user learns and the one studied now. Everything below —
     groups, words, texts, collocations, lessons — is scoped to `lang`. Set before
     any child renders, so AI prompts, speech and new docs follow it too. */
  const langs = window.lwUserLangs(userDoc);
  const lang = userDoc && langs.includes(userDoc.lang) ? userDoc.lang : (langs[0] || null);
  window.lwSetCurrentLang(lang || 'en');
  /* write some of the user's own profile fields (lang, dailyGoal, cefr, avatar) */
  const updateProfile = useCallback((fields) => {
    if (!authUser) return Promise.resolve();
    return window.lwUpdateUser(authUser.uid, fields).catch((e) => {
      console.error('updateProfile failed', e);
      pushToast({ kind: 'error', title: 'Could not save your profile', msg: (e && e.message) || String(e) });
    });
  }, [authUser, pushToast]);
  /* switch to another language (adding it to the user's list if it is new). The
     open book, lesson and Library group filter belong to the old language. */
  const setLang = useCallback((l) => {
    if (l === lang) return;
    setNav((n) => ({ ...n, reading: { view: 'home' }, grammar: { view: 'home' } }));
    window.lwSave(LW_KEYS.library, { ...(window.lwLoad(LW_KEYS.library, null) || {}), groupId: '' });
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

  /* live sync with this user's Firestore data */
  useEffect(() => {
    if (!authUser) { setGroups([]); setWords([]); return; }
    const unsubGroups = window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.groups, authUser.uid, setGroups);
    const unsubWords = window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.words, authUser.uid, setWords);
    return () => { unsubGroups(); unsubWords(); };
  }, [authUser]);

  /* live sync with this user's progress + daily activity */
  useEffect(() => {
    if (!authUser) { setProgress({}); setActivityDocs([]); return; }
    const unsubProgress = window.lwWatchUserCollection(window.LW_COLLECTIONS.progress, authUser.uid,
      (items) => setProgress(Object.fromEntries(items.map((p) => [p.wordId, p]))));
    const unsubActivity = window.lwWatchUserCollection(window.LW_COLLECTIONS.activity, authUser.uid, setActivityDocs);
    return () => { unsubProgress(); unsubActivity(); };
  }, [authUser]);

  /* Each language is its own learner: XP, level, streak, daily goal, practice
     time and the week chart come only from this language's activity
     ({ 'YYYY-MM-DD': doc }; docs without `lang` are English). */
  const activity = useMemo(
    () => Object.fromEntries(activityDocs.filter((a) => window.lwDocLang(a) === lang).map((a) => [a.date, a])),
    [activityDocs, lang]
  );
  const direction = directionByLang[lang] || 'en-ru';
  const setDirection = useCallback((d) => setDirectionByLang((m) => ({ ...m, [lang]: d })), [lang]);

  /* reading texts (own + shared) and where the user is in each */
  useEffect(() => {
    if (!authUser) { setTexts([]); setReadingProgress({}); return; }
    const unsubTexts = window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.texts, authUser.uid, setTexts);
    const unsubRp = window.lwWatchUserCollection(window.LW_COLLECTIONS.readingProgress, authUser.uid,
      (items) => setReadingProgress(Object.fromEntries(items.map((r) => [r.textId, r]))));
    return () => { unsubTexts(); unsubRp(); };
  }, [authUser]);

  /* grammar lessons and this user's progress in them */
  const roleForLessons = userDoc ? userDoc.role : null;
  useEffect(() => {
    if (!authUser || !roleForLessons) { setLessons([]); return; }
    return window.lwWatchLessons(roleForLessons === 'admin', setLessons);
  }, [authUser, roleForLessons]);
  useEffect(() => {
    if (!authUser) { setLessonProgress({}); return; }
    return window.lwWatchUserCollection(window.LW_COLLECTIONS.lessonProgress, authUser.uid,
      (items) => setLessonProgress(Object.fromEntries(items.map((p) => [p.lessonId, p]))));
  }, [authUser]);

  /* video clips of the language studied now */
  useEffect(() => {
    if (!authUser || !lang) { setClips([]); return; }
    return window.lwWatchClips(lang, setClips);
  }, [authUser, lang]);

  /* collocation entries (own + shared) */
  useEffect(() => {
    if (!authUser) { setCollocations([]); return; }
    return window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.collocations, authUser.uid, setCollocations);
  }, [authUser]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const dailyGoal = (userDoc && userDoc[window.lwLangField('dailyGoal', lang)]) || window.LW_DEFAULT_DAILY_GOAL;

  /* Record one answer from Study / Choice / Fill / Review: next Leitner box for
     the word plus today's XP. A +50 bonus lands once, on the answer that reaches
     the daily goal. Snapshots apply local writes immediately, so rapid answers
     already see the updated progress/activity. */
  const lastAnswerAt = useRef(0); // for practice time (activity.ms)
  /* answers sent today that the activity snapshot may not show yet: the
     collocation game records several answers at once, and each must see the
     others so the goal bonus lands only once */
  const sentToday = useRef({ date: '', answers: 0, goalMet: false });
  const recordAnswer = useCallback((wordId, known, mode) => {
    if (!authUser) return;
    const t = Date.now();
    const ms = window.lwPracticeMs(lastAnswerAt.current, t);
    lastAnswerAt.current = t;
    const date = window.lwLocalDate(t);
    const today = activity[date] || {};
    const sent = sentToday.current.date === date && sentToday.current.lang === lang ? sentToday.current : { date, lang, answers: 0, goalMet: false };
    const answersBefore = Math.max(today.answers || 0, sent.answers);
    const goalBonus = !today.goalMet && !sent.goalMet && answersBefore + 1 >= dailyGoal ? window.LW_XP_GOAL_BONUS : 0;
    sentToday.current = { date, lang, answers: answersBefore + 1, goalMet: sent.goalMet || !!goalBonus || !!today.goalMet };
    window.lwRecordAnswer({
      uid: authUser.uid,
      lang,
      progress: wordId ? window.lwNextProgress(progress[wordId] || null, wordId, known, mode, t) : null, // null: a grammar test answer
      date,
      correct: known,
      xp: known ? window.LW_XP_CORRECT : window.LW_XP_WRONG,
      goalBonus,
      ms,
    }).catch((e) => {
      console.error('recordAnswer failed', e);
      pushToast({ kind: 'error', title: 'Could not save progress', msg: (e && e.message) || String(e) });
    });
    setNow(t);
  }, [authUser, lang, activity, progress, dailyGoal, pushToast]);

  /* persistence (local-only settings) */
  useEffect(() => { document.documentElement.dataset.theme = theme; window.lwSave(LW_KEYS.theme, theme); }, [theme]);
  useEffect(() => { window.lwSave(LW_KEYS.selected, selectedByLang); }, [selectedByLang]);
  useEffect(() => { window.lwSave(LW_KEYS.direction, directionByLang); }, [directionByLang]);
  useEffect(() => { window.lwSave(LW_KEYS.nav, nav); }, [nav]);
  /* персистим пачку карточек чтения (без эфемерных status/error) */
  useEffect(() => {
    window.lwSave(lwReadingKey(reading.lang), { cards: reading.cards, index: reading.index });
  }, [reading.lang, reading.cards, reading.index]);

  /* content of the language studied now (docs without `lang` are English) */
  const inLang = useCallback((d) => window.lwDocLang(d) === lang, [lang]);
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

  /* keep selections valid if a group is deleted (skip until groups have loaded) */
  useEffect(() => {
    if (!groups.length) return;
    setSelectedByLang((m) => {
      const out = {};
      Object.keys(m).forEach((l) => { out[l] = (m[l] || []).filter((id) => groups.some((g) => g.id === id)); });
      return out;
    });
  }, [groups]);

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const countByGroup = useMemo(() => {
    const m = {};
    scopedGroups.forEach((g) => { m[g.id] = 0; });
    scopedWords.forEach((w) => { if (m[w.groupId] != null) m[w.groupId]++; });
    return m;
  }, [scopedGroups, scopedWords]);

  /* streak / goal / XP / review queue size for the footer (dashboard comes in stage 3).
     Streak, goal and XP count every language; due and status counts only this one's words.
     Progress for words that no longer exist (e.g. a shared word an admin deleted) is ignored. */
  const stats = useMemo(() => {
    const today = activity[window.lwLocalDate(now)] || {};
    const xp = window.lwTotalXp(activity);
    const wordIds = new Set(scopedWords.map((w) => w.id));
    const dueCount = Object.values(progress).filter((p) => wordIds.has(p.wordId) && p.due <= now).length;
    const statusCounts = window.lwStatusCounts(progress, scopedWords, now);
    return {
      streak: window.lwStreak(activity, now),
      todayAnswers: today.answers || 0,
      goal: dailyGoal,
      xp,
      level: window.lwLevel(xp),
      dueCount,
      statusCounts,
      totalMs: window.lwTotalMs(activity),
      week: window.lwLastDays(activity, now, 7),
    };
  }, [activity, progress, scopedWords, now, dailyGoal]);

  /* Badges, per language like every other stat: metrics from the current
     language's data; earned ones are kept in users/{uid}.badges (badges_<lang>
     for non-English, lwLangField). New ones are saved 2 s after the data
     settles and announced with a toast; the very first time, everything
     already earned is saved quietly with a single toast. */
  const badgesField = window.lwLangField('badges', lang);
  const earnedBadges = userDoc ? userDoc[badgesField] : undefined;
  const badgeStates = useMemo(() => {
    if (!authUser) return [];
    const textIds = new Set(scopedTexts.map((t) => t.id));
    const metrics = window.lwBadgeMetrics({
      uid: authUser.uid, activity, progress, words: scopedWords,
      readingProgress: Object.fromEntries(Object.entries(readingProgress).filter(([id]) => textIds.has(id))),
      lessons: scopedLessons, lessonProgress, collocations: scopedCollocations,
      levelTest: userDoc && userDoc[window.lwLangField('levelTest', lang)], now,
    });
    return window.lwBadgeStates(metrics, earnedBadges);
  }, [authUser, activity, progress, scopedWords, scopedTexts, readingProgress, scopedLessons, lessonProgress, scopedCollocations, now, earnedBadges, userDoc, lang]);
  useEffect(() => {
    if (!authUser || !userDoc || !lang) return;
    const fresh = badgeStates.filter((b) => b.reached && !b.earnedAt);
    if (!fresh.length) return;
    const t = setTimeout(() => {
      const ts = Date.now();
      const fields = {};
      fresh.forEach((b) => { fields[badgesField + '.' + b.badge.id] = ts; });
      window.lwUpdateUser(authUser.uid, fields).catch((e) => console.error('badges', e));
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
      window.lwSave(LW_KEYS.library, { ...(window.lwLoad(LW_KEYS.library, null) || {}), view: 'colloc' });
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
    const existing = window.lwLeafGroups(scopedGroups).find((g) => g.name === name && g.userId === authUser.uid && !!g.shared === shared);
    if (existing) return existing.id;
    const id = window.lwUid() + window.lwUid();
    await window.lwSetDoc(window.LW_COLLECTIONS.groups,
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
      ...fields, ...base, id: fields.id || window.lwUid() + window.lwUid(), groupId: gid,
      createdAt: fields.createdAt || Date.now(),
    };
    await window.lwSetDoc(window.LW_COLLECTIONS.words, word);
    return word;
  }, [authUser, userDoc, ensureAutoGroup]);

  /* "+ Add to cards" from a video clip: a private card in "From video" */
  const addWordFromVideo = useCallback(async (fields) => {
    const gid = await ensureAutoGroup(LW_VIDEO_GROUP_NAME, '#D6453E', false);
    const word = {
      ...fields, userId: authUser.uid, username: userDoc && userDoc.username, shared: false,
      id: window.lwUid() + window.lwUid(), groupId: gid, createdAt: Date.now(),
    };
    await window.lwSetDoc(window.LW_COLLECTIONS.words, word);
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
        const id = window.lwUid() + window.lwUid();
        await window.lwSetDoc(window.LW_COLLECTIONS.words, {
          ...fields, pos: 'phrase', id, groupId: gid, createdAt: t + i,
          userId: authUser.uid, username: userDoc && userDoc.username, shared,
        });
        links.push({ wordId: id, partner });
      }
    }
    const doc = {
      ...entry, ...owner, id: entry.id || window.lwUid() + window.lwUid(),
      phrases: links, createdAt: entry.createdAt || Date.now(), updatedAt: Date.now(),
    };
    await window.lwSetDoc(window.LW_COLLECTIONS.collocations, doc);
    return doc;
  }, [authUser, userDoc, ensureAutoGroup]);

  const wordIndex = useMemo(() => window.lwWordsIndex(scopedWords), [scopedWords]);

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
      window.lwAddPracticeTime(authUser.uid, lang, window.lwLocalDate(Date.now()), TICK)
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
      ...lesson, id: lesson.id || window.lwUid() + window.lwUid(), order, published: !!publish,
      userId: (prev && prev.userId) || authUser.uid, username: (prev && prev.username) || userDoc.username, shared: true,
      createdAt: (prev && prev.createdAt) || Date.now(), updatedAt: Date.now(),
    };
    setGrammar({ view: 'lesson', lessonId: doc.id });
    window.lwSetDoc(window.LW_COLLECTIONS.lessons, doc)
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
      if (l.order !== order) window.lwSetDoc(window.LW_COLLECTIONS.lessons, { ...l, order }).catch(lessonError('Could not reorder'));
    });
  }, [lessonError]);
  const saveLessonProgress = useCallback((lessonId, fields) => window.lwSaveLessonProgress(authUser.uid, lessonId, fields)
    .catch(lessonError('Could not save lesson progress')), [authUser, lessonError]);
  /* a finished test: attempts, last/best score; 10/10 completes the lesson (+50 XP the first time) */
  const finishLessonTest = useCallback((lessonId, score) => {
    const p = lessonProgress[lessonId] || {};
    const passed = score >= window.LW_LESSON_TASKS;
    const fields = { attempts: (p.attempts || 0) + 1, last: score, best: Math.max(p.best || 0, score) };
    if (passed && !p.completedAt) {
      fields.completedAt = Date.now();
      window.lwAddBonusXp(authUser.uid, lang, window.lwLocalDate(Date.now()), window.LW_XP_LESSON_BONUS).catch(lessonError('Could not add XP'));
    }
    saveLessonProgress(lessonId, fields);
    return passed && !p.completedAt;
  }, [lessonProgress, authUser, lang, saveLessonProgress, lessonError]);

  /* save a new text (meta + chapters); admins may publish it for everyone */
  const saveText = useCallback((meta, chapters) => window.lwSaveText({
    ...meta,
    id: window.lwUid() + window.lwUid(),
    userId: authUser.uid,
    username: userDoc && userDoc.username,
    chapters: chapters.map((c) => ({ title: c.title || '', words: c.paragraphs.reduce((n, p) => n + window.lwWordCount(p), 0) })),
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

  const { tab, learnMode } = nav;
  const isAdmin = userDoc.role === 'admin';
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
            <LearnView mode={learnMode} setMode={(m) => goTo(m)} stats={stats} studyStats={studyStats}
              selectedCount={scopedSelected.length} onPickGroups={() => setGroupsOpen(true)}>
              {learnMode === 'review' ? (
                <ReviewView {...learnProps} now={now} goStudy={() => goTo('cards')} />
              ) : learnMode === 'choice' ? (
                <ChoiceView {...learnProps} selected={scopedSelected} />
              ) : learnMode === 'fill' ? (
                <FillView {...learnProps} selected={scopedSelected} />
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
              wordIndex={wordIndex} progress={progress} now={now} groups={scopedGroups} addWord={addWordFromReading}
              onBack={() => goTo('reading-home')} />
          ) : tab === 'reading' && nav.reading.view === 'ai' ? (
            <ReadingView groups={scopedGroups} words={scopedWords} countByGroup={scopedCountByGroup}
              reading={reading} setReading={setReading}
              startGenerate={startReadingGeneration}
              defaultLevel={userDoc[window.lwCefrField(lang)]}
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
              isAdmin={isAdmin} userLevel={userDoc[window.lwCefrField(lang)]} recordAnswer={recordAnswer}
              saveLesson={saveLesson} moveLesson={moveLesson} saveProgress={saveLessonProgress} finishTest={finishLessonTest}
              deleteLesson={(l) => { setGrammar({ view: 'home' }); window.lwDeleteDoc(window.LW_COLLECTIONS.lessons, l.id).catch(lessonError('Could not delete the lesson')); }} />
          ) : tab === 'library' ? (
            <LibraryView groups={scopedGroups} words={scopedWords} userId={authUser.uid} username={userDoc.username} isAdmin={isAdmin}
              progress={progress} now={now} direction={direction} recordAnswer={recordAnswer}
              collocations={scopedCollocations} saveCollocation={saveCollocation} pushToast={pushToast} clips={clips}
              goImport={() => goTo('import')} />
          ) : tab === 'import' ? (
            <ImportView groups={scopedGroups} importState={importState} setImportState={setImportState}
              startAiFill={startImportAiFill} onImport={importWords}
              goLibrary={() => goTo('library')} />
          ) : tab === 'admin' && isAdmin ? (
            <AdminView currentUid={authUser.uid} />
          ) : tab === 'leveltest' ? (
            <LevelTestScreen lang={lang} user={userDoc} uid={authUser.uid} isAdmin={isAdmin} updateProfile={updateProfile}
              pushToast={pushToast} onClose={() => goTo('profile')} />
          ) : (
            <ProfileView user={userDoc} stats={stats} badges={badgeStates} updateProfile={updateProfile}
              authInfo={authInfo} refreshAuthInfo={() => setAuthInfo(window.lwAuthInfo())}
              pushToast={pushToast} goLearn={() => goTo('cards')} goLevelTest={() => goTo('leveltest')}
              theme={theme} onToggleTheme={toggleTheme}
              direction={direction} setDirection={setDirection}
              lang={lang} langs={langs} setLang={setLang} removeLang={removeLang}
              onGeminiKey={() => setGeminiKeyOpen(true)}
              onLogout={() => window.lwLogout()}
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
              window.lwDeleteText(t.id, (t.chapters || []).length)
                .then(() => { if (readingProgress[t.id]) return window.lwDeleteReadingProgress(authUser.uid, t.id); })
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
        onAction={(action) => { if (action && action.view) goTo(action.view); }} />
    </div>
  );
}

/* ---------------- Delete account confirmation ---------------- */
function DeleteAccountModal({ hasPassword, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !hasPassword || !!password; // Google-only accounts confirm in a Google popup instead

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await window.lwDeleteAccount(password);
      try {
        [LW_KEYS.studySession, LW_KEYS.selected, LW_KEYS.nav].forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
      /* onAuthStateChanged in App unmounts the signed-in UI from here */
    } catch (err) {
      const code = err && err.code;
      setError(code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'Wrong password.'
        : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? ''
        : code === 'auth/user-mismatch' ? 'Pick the same Google account you signed in with.'
        : 'Could not delete the account. Try again.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete account" onClose={busy ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={!ready || busy}>
          {busy ? 'Deleting…' : hasPassword ? 'Delete forever' : 'Confirm with Google & delete'}
        </button>
      </>}>
      <p className="confirm-text">
        This permanently deletes <strong>all your words, groups, progress and profile</strong>.
        It can't be undone. {hasPassword ? 'Enter your password to confirm.' : 'Confirm with your Google account.'}
      </p>
      {hasPassword && (
        <label className="field">
          <span className="field-label">Password</span>
          <input className="input" type="password" value={password} autoFocus autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </label>
      )}
      {error && <p className="field-hint" style={{ color: 'var(--error)', marginTop: 10 }}>{error}</p>}
    </Modal>
  );
}

/* ---------------- Toast notifications (bottom-right) ---------------- */
function Toast({ toast, onDismiss, onAction }) {
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 220); // matches toastOut animation
  }, [toast.id, onDismiss]);

  /* auto-dismiss success toasts; keep errors until the user closes them */
  useEffect(() => {
    if (toast.kind !== 'success') return;
    const t = setTimeout(close, 7000);
    return () => clearTimeout(t);
  }, [toast.kind, close]);

  return (
    <div className={'toast toast-' + (toast.kind === 'error' ? 'error' : 'success') + (leaving ? ' is-out' : '')}
      role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.kind === 'error'
          ? <Ic.Close width="18" height="18" />
          : <Ic.Check width="18" height="18" />}
      </span>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.msg && <span className="toast-msg">{toast.msg}</span>}
        {toast.action && (
          <button type="button" className="toast-action"
            onClick={() => { onAction(toast.action); close(); }}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" className="toast-close" aria-label="Close" onClick={close}>
        <Ic.Close width="16" height="16" />
      </button>
    </div>
  );
}

function ToastStack({ toasts, onDismiss, onAction }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} onAction={onAction} />
      ))}
    </div>
  );
}

/* ---------------- App shell: app bar, navigation drawer / sidebar, tab bar ----------------
   Below 1024px: glass app bar on top, slide-in drawer, bottom tab bar.
   From 1024px the drawer is a permanent sidebar and the app bar + tab bar hide (CSS). */
function AppBar({ onMenu, level, xp, onLevel }) {
  return (
    <header className="appbar">
      <button className="icon-btn" onClick={onMenu} aria-label="Menu"><Ic.Menu /></button>
      <span className="brand-name">Lexicon</span>
      <button className="level-chip" type="button" onClick={onLevel} title={xp + ' XP'}>
        <Ic.Star width="16" height="16" /> LVL {level}
      </button>
    </header>
  );
}

/* the user's photo, or the first letter of their username */
function Avatar({ user, className = '' }) {
  if (user && user.avatar) return <img className={'avatar ' + className} src={user.avatar} alt="" />;
  return <span className={'avatar ' + className}>{((user && user.username) || '?').slice(0, 1).toUpperCase()}</span>;
}

function NavDrawer({ open, onClose, tab, learnMode, goTo, stats, user, isAdmin, wordCount, lang, langs, setLang, theme, onToggleTheme, onGeminiKey }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const item = (name, Icon, label, active, extra) => (
    <button key={name} type="button" className={'nav-item' + (active ? ' on' : '')} onClick={() => goTo(name)}>
      <Icon /><span className="nav-label">{label}</span>{extra}
    </button>
  );
  const learnOn = tab === 'learn' && learnMode !== 'review';
  const activeToday = stats.todayAnswers > 0;

  return (
    <>
      <div className={'drawer-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' open' : '')}>
        <div className="drawer-head">
          <div className="drawer-logo"><Ic.Library /></div>
          <div className="drawer-brand">
            <span className="brand-name">Lexicon</span>
            <span className="drawer-sub">{window.lwLangInfo(lang).name} lab</span>
          </div>
          <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close menu"><Ic.Close /></button>
        </div>

        <button type="button" className="drawer-profile" onClick={() => goTo('profile')}>
          <div className="drawer-profile-top">
            <Avatar user={user} />
            <span className="drawer-profile-text">
              <span className="drawer-name">{user.username}</span>
              <span className="drawer-meta">Level {stats.level} · {stats.xp} XP</span>
            </span>
          </div>
          <span className="drawer-streak">
            <Ic.Flame width="18" height="18" />
            <span>{stats.streak} day streak</span>
            <span className={'streak-badge' + (activeToday ? ' on' : '')}>{activeToday ? 'Active' : 'Study today'}</span>
          </span>
        </button>

        {langs.length > 1 && (
          <div className="seg drawer-langs" role="group" aria-label="Language you learn">
            {langs.map((code) => {
              const l = window.lwLangInfo(code);
              return (
                <button key={code} type="button" className={'seg-btn' + (lang === code ? ' on' : '')}
                  aria-pressed={lang === code} onClick={() => setLang(code)}>{l.flag} {l.name}</button>
              );
            })}
          </div>
        )}

        <nav className="drawer-nav">
          {item('cards', Ic.Learn, 'Learn', learnOn)}
          {item('review', Ic.Repeat, 'Review', tab === 'learn' && learnMode === 'review',
            stats.dueCount > 0 && <span className="nav-badge nav-badge-hot">{stats.dueCount}</span>)}
          {item('reading', Ic.Book, 'Reading', tab === 'reading')}
          {item('grammar', Ic.Grammar, 'Grammar', tab === 'grammar')}
          {item('library', Ic.Library, 'Library', tab === 'library', <span className="nav-badge">{wordCount} words</span>)}
          {item('import', Ic.Plus, 'Import', tab === 'import')}
          {isAdmin && item('admin', Ic.Settings, 'Admin', tab === 'admin')}
        </nav>

        <div className="drawer-section">Settings</div>
        <nav className="drawer-nav">
          {item('profile', Ic.Person, 'Profile', tab === 'profile')}
          <button type="button" className="nav-item" onClick={onToggleTheme}>
            <Ic.Moon /><span className="nav-label">Dark theme</span>
            <span className={'switch' + (theme === 'dark' ? ' on' : '')} aria-hidden="true" />
          </button>
          <button type="button" className="nav-item" onClick={onGeminiKey}>
            <Ic.Key /><span className="nav-label">Gemini API key</span>
          </button>
        </nav>
      </aside>
    </>
  );
}

function TabBar({ tab, goTo }) {
  return (
    <nav className="tabbar">
      {LW_TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={'tab' + (tab === id ? ' on' : '')} onClick={() => goTo(id)}>
          <Icon /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------------- Learn: header (daily goal, modes, groups) + answer buttons ---------------- */

/* Again / Know under a card — same as swiping left / right, but they show when
   the word comes back. Know on a word reviewed early keeps its box, so its
   label shows the time left until it is due. */
function LeitnerButtons({ prog, wordId, onAnswer }) {
  const t = Date.now();
  const knowIn = window.lwNextProgress(prog || null, wordId, true, '', t).due - t;
  return (
    <div className="answer-btns">
      <button className="answer-btn answer-again" type="button" onClick={() => onAnswer('unknown')}>
        <span className="answer-icon"><Ic.Close width="22" height="22" /></span>
        <span className="answer-label">Again</span>
        <span className="answer-int">{window.lwFormatInterval(window.LW_BOXES[0])}</span>
      </button>
      <button className="answer-btn answer-know" type="button" onClick={() => onAnswer('known')}>
        <span className="answer-icon"><Ic.DoubleCheck width="22" height="22" /></span>
        <span className="answer-label">Know</span>
        <span className="answer-int">{window.lwFormatInterval(knowIn)}</span>
      </button>
    </div>
  );
}

function LearnView({ mode, setMode, stats, studyStats, selectedCount, onPickGroups, children }) {
  /* on narrow screens the modes scroll sideways: keep the chosen one in view */
  const pillsRef = useRef(null);
  useEffect(() => {
    const on = pillsRef.current && pillsRef.current.querySelector('.mode-pill.on');
    if (on && pillsRef.current.scrollWidth > pillsRef.current.clientWidth) {
      pillsRef.current.scrollLeft = on.offsetLeft - (pillsRef.current.clientWidth - on.offsetWidth) / 2;
    }
  }, [mode]);
  const pct = Math.min(100, Math.round((stats.todayAnswers / stats.goal) * 100));
  return (
    <div className="learn">
      <div className="learn-head">
        <div className="goal">
          <div className="goal-row">
            <span className="goal-label">Daily goal</span>
            <span className={'goal-count' + (pct >= 100 ? ' met' : '')}>{stats.todayAnswers} / {stats.goal} answers</span>
          </div>
          <div className="goal-track"><div className="goal-fill" style={{ width: pct + '%' }} /></div>
        </div>
        <div className="mode-pills" role="tablist" ref={pillsRef}>
          {LW_LEARN_MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
              className={'mode-pill' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)}>
              {m.label}
              {m.id === 'review' && stats.dueCount > 0 && <span className="mode-pill-count">{stats.dueCount}</span>}
            </button>
          ))}
        </div>
        {mode !== 'review' && mode !== 'colloc' && mode !== 'video' && (
          <div className="learn-sub">
            <button type="button" className="groups-chip" onClick={onPickGroups}>
              <Ic.Tag width="15" height="15" /> {selectedCount} {selectedCount === 1 ? 'group' : 'groups'} <Ic.Chevron width="15" height="15" />
            </button>
            {mode === 'cards' && studyStats.poolCount > 0 && (
              <span className="learn-session">{studyStats.knownCount} / {studyStats.poolCount} known</span>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Level test (any language) + question bank editor (admins) ---------------- */
function LevelTestScreen({ lang, user, uid, isAdmin, updateProfile, pushToast, onClose }) {
  const info = window.lwLangInfo(lang);
  const cefrKey = window.lwCefrField(lang);
  const testKey = window.lwLangField('levelTest', lang);
  const [bank, setBank] = useState(null); // null while loading
  useEffect(() => window.lwWatchLevelQuestions(lang, setBank), [lang]);
  const [view, setView] = useState('intro'); // intro | test | result | manage
  const [run, setRun] = useState(null); // { asked, answers, level, q, order, picked }
  const [result, setResult] = useState(null);
  useEffect(() => { window.scrollTo(0, 0); }, [view, run && run.q && run.q.id]);
  const last = user[testKey];
  const ready = bank && bank.length >= window.LW_LEVEL_TEST_MIN_BANK;

  const ask = (q, asked, answers, level) => setRun({ asked, answers, level, q, order: shuffle([0, 1, 2, 3]), picked: null });
  const start = () => {
    const level = user[cefrKey] ? window.lwLevelIndex(user[cefrKey]) : 1; // A2 when unknown
    const q = window.lwLevelTestPick(bank, [], level);
    if (!q) return;
    setResult(null);
    ask(q, [q.id], [], level);
    setView('test');
  };
  const finish = (answers) => {
    const res = window.lwLevelTestResult(answers);
    setResult(res);
    setView('result');
    updateProfile({ [testKey]: { level: res.level, correct: res.correct, total: res.total, at: Date.now() } });
  };
  /* slot: index of the shown option, or -1 for "I don't know" */
  const answer = (slot) => {
    if (!run || run.picked != null) return;
    const ok = slot >= 0 && run.order[slot] === run.q.answer;
    setRun((r) => ({ ...r, picked: slot }));
    setTimeout(() => {
      const answers = [...run.answers, { id: run.q.id, level: run.q.level, target: run.level, ok }];
      const level = ok ? Math.min(5, run.level + 1) : Math.max(0, run.level - 1);
      const q = answers.length < window.LW_LEVEL_TEST_LEN ? window.lwLevelTestPick(bank, run.asked, level) : null;
      if (!q) { finish(answers); return; }
      ask(q, [...run.asked, q.id], answers, level);
    }, 250);
  };

  if (view === 'manage' && isAdmin) {
    return <LevelQuestionsAdmin bank={bank || []} lang={lang} uid={uid} pushToast={pushToast} onBack={() => setView('intro')} />;
  }

  if (view === 'test' && run) {
    const n = run.answers.length;
    return (
      <div className="grammar quiz lt">
        <div className="ls-back-row">
          <button type="button" className="btn btn-ghost sm" onClick={() => { setRun(null); setView('intro'); }}><Ic.Close width="15" height="15" /> Quit test</button>
          <span className="ls-pos">{info.name} level test</span>
        </div>
        <div className="colloc-head">
          <span className="colloc-kicker">Question {n + 1} of {window.LW_LEVEL_TEST_LEN}</span>
        </div>
        <div className="colloc-segs">
          {Array.from({ length: window.LW_LEVEL_TEST_LEN }, (_, i) => <span key={i} className={'colloc-seg' + (i < n ? ' on' : i === n ? ' cur' : '')} />)}
        </div>
        <div className="ls-card quiz-card">
          <p className="quiz-type">{run.q.skill === 'vocabulary' ? 'Vocabulary' : 'Grammar'}</p>
          <p className="quiz-q quiz-q-big">{run.q.q}</p>
          <div className="quiz-options">
            {run.order.map((oi, slot) => (
              <button key={slot} type="button" className={'quiz-option' + (run.picked === slot ? ' picked' : '')}
                disabled={run.picked != null} onClick={() => answer(slot)}>
                <span className="quiz-letter">{'ABCD'[slot]}</span>{run.q.options[oi]}
              </button>
            ))}
          </div>
          <button type="button" className={'btn btn-ghost lt-idk' + (run.picked === -1 ? ' picked' : '')} disabled={run.picked != null} onClick={() => answer(-1)}>
            I don't know
          </button>
        </div>
      </div>
    );
  }

  if (view === 'result' && result) {
    const current = user[cefrKey];
    return (
      <div className="grammar quiz lt">
        <div className="quiz-result pass">
          <span className="lt-level">{result.level}</span>
          <h2 className="quiz-result-title">{window.LW_CEFR_NAMES[result.level]}</h2>
          <p className="quiz-result-sub">Your {info.name} level. You answered {result.correct} of {result.total} questions correctly.</p>
          <div className="lt-bars">
            {result.byLevel.map((b) => (
              <div className="lt-bar" key={b.level}>
                <span className="lt-bar-lv">{b.level}</span>
                <span className="badge-track lt-bar-track"><span className="badge-fill" style={{ width: Math.round((b.right / b.asked) * 100) + '%' }} /></span>
                <span className="lt-bar-num">{b.right}/{b.asked}</span>
              </div>
            ))}
          </div>
          <div className="quiz-result-btns">
            {current === result.level ? (
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            ) : (
              <>
                <button className="btn btn-soft" onClick={onClose}>{current ? 'Keep ' + current : 'Not now'}</button>
                <button className="btn btn-primary" onClick={() => { updateProfile({ [cefrKey]: result.level }); onClose(); }}>Set {result.level} as my level</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grammar lt">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onClose}>
          <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Profile
        </button>
      </div>
      <section className="ls-cta lt-intro">
        <span className="ls-cta-icon"><Ic.ListCheck width="24" height="24" /></span>
        <h1 className="ls-cta-title">{info.name} level test</h1>
        <p className="ls-cta-sub">{window.LW_LEVEL_TEST_LEN} questions · about 8 minutes. The questions get harder or easier as you answer.
          No hints and no answers during the test — tap “I don't know” instead of guessing.</p>
        {last && <p className="ls-cta-note">Last test: {last.level} ({last.correct}/{last.total}) · {new Date(last.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
        {bank === null ? <span className="spinner" aria-hidden="true" />
          : ready ? <button type="button" className="btn btn-primary ls-cta-btn" onClick={start}>Start the test <Ic.Arrow width="16" height="16" /></button>
          : <p className="ls-cta-note">The test isn't ready for {info.name} yet.</p>}
        {isAdmin && bank && (
          <button type="button" className="btn btn-soft sm" onClick={() => setView('manage')}><Ic.Edit width="15" height="15" /> Manage questions ({bank.length})</button>
        )}
      </section>
    </div>
  );
}

const lwEmptyLevelQuestion = (level) => ({ level: level || 'B1', skill: 'grammar', q: '', options: ['', '', '', ''], answer: 0, why: '' });

function LevelQuestionsAdmin({ bank, lang, uid, pushToast, onBack }) {
  const info = window.lwLangInfo(lang);
  const [level, setLevel] = useState('all');
  const [form, setForm] = useState(null); // question being edited or created
  const [confirm, setConfirm] = useState(null);
  const counts = Object.fromEntries(window.LW_CEFR_ALL.map((lv) => [lv, bank.filter((q) => q.level === lv).length]));
  const list = bank.filter((q) => level === 'all' || q.level === level)
    .sort((a, b) => window.lwLevelIndex(a.level) - window.lwLevelIndex(b.level) || (a.createdAt || 0) - (b.createdAt || 0));
  const fail = (title) => (e) => pushToast({ kind: 'error', title, msg: (e && e.message) || String(e) });
  const save = (q) => {
    const now = Date.now();
    window.lwSetDoc(window.LW_COLLECTIONS.levelQuestions, {
      ...q, id: q.id || window.lwUid() + window.lwUid(), lang, userId: q.userId || uid, shared: true,
      createdAt: q.createdAt || now, updatedAt: now,
    }).catch(fail('Could not save the question'));
    setForm(null);
  };
  return (
    <div className="grammar lt">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}>
          <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Level test
        </button>
      </div>
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Test questions</h1>
          <p className="lib-sub">{info.name} · {bank.length} questions · the test needs at least {window.LW_LEVEL_TEST_MIN_BANK}, about 10 per level is best</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(lwEmptyLevelQuestion(level === 'all' ? 'B1' : level))}><Ic.Plus /> New question</button>
      </div>
      <div className="status-chips">
        <button type="button" className={'chip' + (level === 'all' ? ' chip-on' : '')} onClick={() => setLevel('all')}>All <span className="chip-count">{bank.length}</span></button>
        {window.LW_CEFR_ALL.map((lv) => (
          <button key={lv} type="button" className={'chip' + (level === lv ? ' chip-on' : '')} onClick={() => setLevel(lv)}>
            {lv} <span className="chip-count">{counts[lv]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty-card lib-empty">
          <p className="empty-title">No questions{level === 'all' ? '' : ' at ' + level}</p>
          <button className="btn btn-primary" onClick={() => setForm(lwEmptyLevelQuestion(level === 'all' ? 'B1' : level))}><Ic.Plus /> New question</button>
        </div>
      ) : (
        <div className="gr-list">
          {list.map((q) => (
            <div className="gr-item lq-item" key={q.id}>
              <button type="button" className="gr-item-main" onClick={() => setForm(q)}>
                <span className="gr-num lq-lv">{q.level}</span>
                <span className="gr-item-text">
                  <span className="gr-item-title">{q.q}</span>
                  <span className="gr-item-meta"><span>{q.skill === 'vocabulary' ? 'Vocabulary' : 'Grammar'}</span><span>✓ {q.options[q.answer]}</span></span>
                </span>
              </button>
              <div className="gr-item-tools">
                <button type="button" className="icon-btn sm danger" aria-label="Delete" onClick={() => setConfirm(q)}><Ic.Trash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title={form.id ? 'Edit question' : 'New question'} onClose={() => setForm(null)}>
          <LevelQuestionForm initial={form} onSave={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Delete question" onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const q = confirm;
              setConfirm(null);
              window.lwDeleteDoc(window.LW_COLLECTIONS.levelQuestions, q.id).catch(fail('Could not delete the question'));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete <strong>{confirm.q}</strong>? This can't be undone.</p>
        </Modal>
      )}
    </div>
  );
}

function LevelQuestionForm({ initial, onSave, onCancel }) {
  const [d, setD] = useState(() => ({ ...lwEmptyLevelQuestion(), ...initial, options: [0, 1, 2, 3].map((i) => (initial.options || [])[i] || '') }));
  const [tried, setTried] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const opts = d.options.map((o) => o.trim());
  const errors = [];
  if (!d.q.trim()) errors.push('Write the question.');
  if (opts.some((o) => !o)) errors.push('Fill in all 4 options.');
  else if (new Set(opts.map((o) => o.toLowerCase())).size < 4) errors.push('Options must be different.');
  const submit = () => {
    setTried(true);
    if (errors.length) return;
    onSave({ ...d, q: d.q.trim(), options: opts, why: (d.why || '').trim() });
  };
  return (
    <div className="form">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Level</span>
          <select className="input" value={d.level} onChange={(e) => set('level', e.target.value)}>
            {window.LW_CEFR_ALL.map((lv) => <option key={lv} value={lv}>{lv} · {window.LW_CEFR_NAMES[lv]}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select className="input" value={d.skill} onChange={(e) => set('skill', e.target.value)}>
            <option value="grammar">Grammar</option>
            <option value="vocabulary">Vocabulary</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Question</span>
        <input className="input" value={d.q} autoFocus placeholder="She ___ to work every day." onChange={(e) => set('q', e.target.value)} />
        <span className="field-hint">Mark the gap with ___ .</span>
      </label>
      <div className="field">
        <span className="field-label">Options — pick the correct one</span>
        <div className="lf-options">
          {d.options.map((o, j) => (
            <label className={'lf-option' + (d.answer === j ? ' on' : '')} key={j}>
              <input type="radio" name="lq-ans" checked={d.answer === j} onChange={() => set('answer', j)} aria-label={'Correct answer ' + (j + 1)} />
              <input className="input input-sm" value={o} placeholder={'option ' + (j + 1)}
                onChange={(e) => set('options', d.options.map((x, k) => (k === j ? e.target.value : x)))} />
            </label>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">Note for admins (optional)</span>
        <input className="input" value={d.why || ''} placeholder="why this answer is right" onChange={(e) => set('why', e.target.value)} />
      </label>
      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>{initial.id ? 'Save changes' : 'Add question'}</button>
      </div>
    </div>
  );
}

/* ---------------- Badges (Profile) ---------------- */
const LW_BADGES_COLLAPSED = 8;
function lwBadgeNum(v, unit) { return unit === 'h' ? (Math.floor(v * 10) / 10) : Math.floor(v); }
function BadgesSection({ badges }) {
  const [all, setAll] = useState(false);
  if (!badges.length) return null;
  const got = (b) => b.earnedAt || b.reached;
  const sorted = badges.slice().sort((a, b) => (got(b) ? 1 : 0) - (got(a) ? 1 : 0)
    || (got(a) ? (b.earnedAt || Date.now()) - (a.earnedAt || Date.now()) : b.value / b.target - a.value / a.target));
  const shown = all ? sorted : sorted.slice(0, LW_BADGES_COLLAPSED);
  const count = badges.filter(got).length;
  return (
    <section className="dash-card badges">
      <div className="dash-head">
        <h2 className="dash-title">Badges</h2>
        <span className="dash-badge">{count} of {badges.length}</span>
      </div>
      <div className="badge-grid">
        {shown.map((b) => {
          const on = got(b);
          const pct = Math.min(100, Math.round((b.value / b.target) * 100));
          return (
            <div className={'badge-card' + (on ? ' on' : '')} key={b.badge.id} title={b.badge.text}>
              <span className="badge-icon" aria-hidden="true">{b.badge.icon}</span>
              <span className="badge-title">{b.badge.title}</span>
              {on ? (
                <span className="badge-sub">{b.earnedAt ? new Date(b.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}</span>
              ) : (
                <>
                  <span className="badge-sub">{b.badge.text}</span>
                  <span className="badge-track"><span className="badge-fill" style={{ width: pct + '%' }} /></span>
                  <span className="badge-num">{lwBadgeNum(b.value, b.badge.unit)} / {b.target}{b.badge.unit === 'level' ? '' : ' ' + b.badge.unit}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {badges.length > LW_BADGES_COLLAPSED && (
        <button type="button" className="btn btn-soft sm badges-more" onClick={() => setAll((x) => !x)}>
          {all ? 'Show less' : 'Show all ' + badges.length}
        </button>
      )}
    </section>
  );
}

/* ---------------- Profile: who you are, your progress (dashboard), settings ---------------- */
const LW_STATUS_META = [
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'review', label: 'To review' },
  { id: 'mastered', label: 'Mastered' },
];

function ProfileView({ user, stats, badges, updateProfile, authInfo, refreshAuthInfo, pushToast, goLearn, goLevelTest,
  theme, onToggleTheme, direction, setDirection, lang, langs, setLang, removeLang, onGeminiKey, onLogout, onDeleteAccount }) {
  const fileRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  /* lwLevel: level n starts at 50·(n−1)² XP */
  const levelStart = 50 * (stats.level - 1) ** 2;
  const levelEnd = 50 * stats.level ** 2;
  const levelPct = Math.round(((stats.xp - levelStart) / (levelEnd - levelStart)) * 100);
  const langInfo = window.lwLangInfo(lang);
  const cefrKey = window.lwCefrField(lang);
  const cefrTargetKey = window.lwCefrField(lang, true);
  const otherLangs = LW_LANGUAGES.filter((l) => !langs.includes(l.code));
  const since = user.createdAt && user.createdAt.toDate
    ? user.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const left = Math.max(0, stats.goal - stats.todayAnswers);
  const counts = stats.statusCounts;
  const totalWords = counts.new + counts.learning + counts.review + counts.mastered;

  const pickAvatar = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await updateProfile({ avatar: await window.lwFileToPhoto(file, 256, true) });
    } catch (err) {
      pushToast({ kind: 'error', title: 'Could not use this image', msg: 'Try a JPEG or PNG photo.' });
    }
    setAvatarBusy(false);
  };

  const googleAction = async (link) => {
    setGoogleBusy(true);
    try {
      if (link) await window.lwLinkGoogle(); else await window.lwUnlinkGoogle();
      refreshAuthInfo();
      pushToast({ kind: 'success', title: link ? 'Google account linked' : 'Google account unlinked',
        msg: link ? 'You can now sign in with Google.' : 'Sign in with your password from now on.' });
    } catch (err) {
      const code = err && err.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        pushToast({ kind: 'error', title: link ? 'Could not link Google' : 'Could not unlink Google',
          msg: code === 'auth/credential-already-in-use' ? 'This Google account already belongs to another Lexicon account.'
            : code === 'auth/operation-not-allowed' ? 'Google sign-in is not enabled for this app yet.'
            : (err && err.message) || String(err) });
      }
    }
    setGoogleBusy(false);
  };

  return (
    <div className="profile">
      {/* who you are */}
      <section className="profile-card">
        <div className="profile-avatar-wrap">
          <Avatar user={user} className="avatar-xl" />
          <button type="button" className="avatar-edit" onClick={() => fileRef.current && fileRef.current.click()}
            disabled={avatarBusy} aria-label="Change photo" title="Change photo">
            {avatarBusy ? <span className="spinner" /> : <Ic.Camera width="16" height="16" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        </div>
        <span className="level-pill"><Ic.Star width="14" height="14" /> Level {stats.level}
          {user.role && user.role !== 'user' ? ' · ' + (LW_ROLE_LABEL[user.role] || user.role) : ''}</span>
        <h1 className="profile-name">{user.username}</h1>
        <p className="profile-handle">@{user.username.toLowerCase()}{since ? ' · Member since ' + since : ''}</p>
        <span className="learning-chip">
          {langInfo.flag + ' Learning ' + langInfo.name}
          {user[cefrKey] ? ' · ' + user[cefrKey] : ''}{user[cefrTargetKey] ? ' → ' + user[cefrTargetKey] : ''}
        </span>
        {user.avatar && (
          <button type="button" className="btn btn-ghost sm" onClick={() => updateProfile({ avatar: '' })}>Remove photo</button>
        )}
      </section>

      {/* headline numbers */}
      <section className="tiles">
        <div className="tile"><span className="tile-icon tile-icon-blue"><Ic.Check width="18" height="18" /></span>
          <span className="tile-num">{counts.mastered}</span><span className="tile-label">Words mastered</span></div>
        <div className="tile"><span className="tile-icon tile-icon-gold"><Ic.Flame width="18" height="18" /></span>
          <span className="tile-num">{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</span><span className="tile-label">Current streak</span></div>
        <div className="tile"><span className="tile-icon tile-icon-teal"><Ic.Clock width="18" height="18" /></span>
          <span className="tile-num">{window.lwFormatDuration(stats.totalMs)}</span><span className="tile-label">Practice time</span></div>
      </section>

      {/* level progress */}
      <section className="dash-card">
        <div className="goal-row">
          <span className="goal-label">Level {stats.level} · {stats.xp} XP</span>
          <span className="goal-count">{levelEnd - stats.xp} XP to level {stats.level + 1}</span>
        </div>
        <div className="goal-track"><div className="goal-fill" style={{ width: levelPct + '%' }} /></div>
      </section>

      {/* this week */}
      <section className="dash-card">
        <div className="dash-head">
          <div>
            <h2 className="dash-title">This week</h2>
            <p className="dash-sub">Answers per day · goal {stats.goal}</p>
          </div>
          <span className={'dash-badge' + (left === 0 ? ' met' : '')}>Today {stats.todayAnswers} / {stats.goal}</span>
        </div>
        <WeekChart days={stats.week} goal={stats.goal} />
      </section>

      {/* words by status */}
      <section className="dash-card">
        <div className="dash-head">
          <div>
            <h2 className="dash-title">Your words</h2>
            <p className="dash-sub">{totalWords} words in your groups</p>
          </div>
        </div>
        {totalWords > 0 && (
          <div className="status-bar" aria-hidden="true">
            {LW_STATUS_META.map((m) => counts[m.id] > 0 && (
              <span key={m.id} className={'status-seg status-' + m.id} style={{ flexGrow: counts[m.id] }} />
            ))}
          </div>
        )}
        <div className="status-legend">
          {LW_STATUS_META.map((m) => (
            <div key={m.id} className="status-item">
              <span className={'status-swatch status-' + m.id} />
              <span className="status-name">{m.label}</span>
              <span className="status-num">{counts[m.id]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CEFR: self-assessed level and target */}
      <section className="dash-card">
        <h2 className="dash-title">{langInfo.name} level</h2>
        <p className="dash-sub">Your level sets the default difficulty of reading texts.</p>
        {(() => {
          const lt = user[window.lwLangField('levelTest', lang)];
          return (
            <div className="lt-link">
              <span>{lt ? 'Last test: ' + lt.level + ' · ' + new Date(lt.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not sure?'}</span>
              <button type="button" className="btn btn-soft sm" onClick={goLevelTest}><Ic.ListCheck width="15" height="15" /> {lt ? 'Retake level test' : 'Take a level test'}</button>
            </div>
          );
        })()}
        <div className="cefr-row">
          <span className="cefr-label">I'm at</span>
          <div className="cefr-pills">
            {window.LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user[cefrKey] === lv ? ' on' : '')}
                onClick={() => updateProfile({ [cefrKey]: lv })}>{lv}</button>
            ))}
          </div>
        </div>
        <div className="cefr-row">
          <span className="cefr-label">Goal</span>
          <div className="cefr-pills">
            {window.LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user[cefrTargetKey] === lv ? ' on' : '')}
                onClick={() => updateProfile({ [cefrTargetKey]: lv })}>{lv}</button>
            ))}
          </div>
        </div>
      </section>

      <BadgesSection badges={badges} />

      {/* nudge */}
      <section className="cta-card">
        <h2 className="cta-title">{left > 0 ? left + (left === 1 ? ' answer' : ' answers') + ' to today\'s goal' : 'Daily goal reached 🎉'}</h2>
        <p className="cta-sub">{left > 0 ? 'Reach it to earn +' + window.LW_XP_GOAL_BONUS + ' XP and keep your streak going.' : 'Come back tomorrow to keep your ' + stats.streak + '-day streak.'}</p>
        <button type="button" className="btn btn-primary lg" onClick={goLearn}><Ic.Learn width="18" height="18" /> {left > 0 ? 'Start learning' : 'Keep practicing'}</button>
      </section>

      <h2 className="section-label">Learning</h2>
      <section className="settings-list">
        <div className="setting-row">
          <span className="setting-label"><Ic.Flag /> Daily goal</span>
          <div className="seg">
            {window.LW_GOAL_OPTIONS.map((g) => (
              <button key={g} type="button" className={'seg-btn' + (stats.goal === g ? ' on' : '')}
                onClick={() => updateProfile({ [window.lwLangField('dailyGoal', lang)]: g })}>{g}</button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label"><Ic.Swap /> Card direction</span>
          <div className="seg">
            <button type="button" className={'seg-btn' + (direction === 'en-ru' ? ' on' : '')} onClick={() => setDirection('en-ru')}>{lang.toUpperCase()} → RU</button>
            <button type="button" className={'seg-btn' + (direction === 'ru-en' ? ' on' : '')} onClick={() => setDirection('ru-en')}>RU → {lang.toUpperCase()}</button>
          </div>
        </div>
        {'speechSynthesis' in window && <VoicePicker key={lang} />}
        <div className="setting-row setting-row-wrap">
          <span className="setting-label"><Ic.Book /> Language you learn</span>
          <div className="seg">
            {langs.map((code) => {
              const l = window.lwLangInfo(code);
              return (
                <button key={code} type="button" className={'seg-btn' + (lang === code ? ' on' : '')}
                  aria-pressed={lang === code} onClick={() => setLang(code)} title={l.name}>{l.flag} {l.name}</button>
              );
            })}
          </div>
        </div>
        {otherLangs.map((l) => (
          <button key={l.code} type="button" className="setting-row" onClick={() => setLang(l.code)}>
            <span className="setting-label"><Ic.Plus /> Also learn {l.name}</span>
            <span className="setting-value">{l.flag} <Ic.ChevronRight width="16" height="16" /></span>
          </button>
        ))}
        {langs.length > 1 && (
          <button type="button" className="setting-row" onClick={() => {
            if (window.confirm('Stop learning ' + langInfo.name + '? Your ' + langInfo.name + ' words and progress are kept and come back if you add it again.')) removeLang(lang);
          }}>
            <span className="setting-label"><Ic.Close /> Stop learning {langInfo.name}</span>
          </button>
        )}
      </section>

      <h2 className="section-label">App</h2>
      <section className="settings-list">
        <button type="button" className="setting-row" onClick={onToggleTheme}>
          <span className="setting-label"><Ic.Moon /> Dark theme</span>
          <span className={'switch' + (theme === 'dark' ? ' on' : '')} aria-hidden="true" />
        </button>
        <button type="button" className="setting-row" onClick={onGeminiKey}>
          <span className="setting-label"><Ic.Key /> Gemini API key</span>
          <span className="setting-value">{window.lwHasGeminiKey() ? 'Connected' : 'Not set'} <Ic.ChevronRight width="16" height="16" /></span>
        </button>
      </section>

      <h2 className="section-label">Account</h2>
      <section className="settings-list">
        <div className="setting-row">
          <span className="setting-label">
            <Ic.Google />
            <span className="setting-stack">
              <span>{authInfo.google ? 'Google account linked' : 'Google account'}</span>
              <span className="setting-sub">{authInfo.google ? authInfo.googleEmail : 'Sign in with Google next time'}</span>
            </span>
          </span>
          {authInfo.google ? (
            authInfo.password && (
              <button type="button" className="btn btn-ghost sm" disabled={googleBusy} onClick={() => googleAction(false)}>Unlink</button>
            )
          ) : (
            <button type="button" className="btn btn-soft sm" disabled={googleBusy} onClick={() => googleAction(true)}>Link</button>
          )}
        </div>
        <button type="button" className="setting-row" onClick={onLogout}>
          <span className="setting-label"><Ic.Logout /> Sign out</span>
        </button>
        <button type="button" className="setting-row setting-danger" onClick={onDeleteAccount}>
          <span className="setting-label"><Ic.Trash /> Delete account</span>
        </button>
      </section>
    </div>
  );
}

/* ---------------- Study view ---------------- */
function StudyView({ groups, words, selected, groupById, onStatsChange, direction, progress: wordProgress, recordAnswer, goLibrary, goCategory }) {
  const pool = useMemo(() => words.filter((w) => selected.includes(w.groupId)), [words, selected]);

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({}); // { [wordId]: 'known' | 'unknown' }

  /* start or resume a study session for this pool of words */
  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    const saved = window.lwLoad(LW_KEYS.studySession, null);
    if (saved && saved.poolKey === poolKey) {
      setProgress(saved.progress || {});
      setQueue(saved.queue || []);
      setCurrent(saved.current ?? null);
    } else {
      const ids = shuffle(pool.map((w) => w.id));
      setProgress({});
      setQueue(ids.slice(1));
      setCurrent(ids[0] || null);
    }
    setFlipped(false);
    // eslint-disable-next-line
  }, [poolKey]);

  /* persist session progress so it survives reloads */
  useEffect(() => {
    if (!pool.length) return;
    window.lwSave(LW_KEYS.studySession, { poolKey, queue, current, progress });
  }, [poolKey, pool.length, queue, current, progress]);

  useEffect(() => { setFlipped(false); }, [direction]);

  const knownCount = useMemo(
    () => Object.values(progress).filter((s) => s === 'known').length,
    [progress]
  );

  useEffect(() => {
    onStatsChange({ knownCount, poolCount: pool.length, groupCount: selected.length });
  }, [onStatsChange, knownCount, pool.length, selected.length]);

  const advance = useCallback((nextQueue) => {
    setFlipped(false);
    const nq = nextQueue.slice();
    const id = nq.shift();
    setCurrent(id || null);
    setQueue(nq);
  }, []);

  const draw = useCallback(() => {
    advance(queue);
  }, [advance, queue]);

  const mark = useCallback((status) => {
    if (!current) return;
    if (status === 'skip') { draw(); return; }
    recordAnswer(current, status === 'known', 'study');
    setProgress((p) => ({ ...p, [current]: status }));
    const nq = status === 'unknown' ? [...queue, current] : queue;
    advance(nq);
  }, [current, queue, advance, draw, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    if (!current) return;
    const shuffled = shuffle([...queue, current]);
    setFlipped(false);
    setCurrent(shuffled[0] || null);
    setQueue(shuffled.slice(1));
  }, [current, queue]);

  const restart = useCallback(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setProgress({});
    setQueue(ids.slice(1));
    setCurrent(ids[0] || null);
    setFlipped(false);
  }, [pool]);

  /* keyboard */
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); mark('known'); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); mark('unknown'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mark]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const allDone = pool.length > 0 && !entry;

  return (
    <div className="study">
      <div className="stage">
        {entry ? (
          <Flashcard entry={entry} group={group} flipped={flipped} direction={direction}
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : allDone ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">All words done!</p>
            <p className="empty-sub">{pool.length} / {pool.length} known</p>
            <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Start over</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Cards width="30" height="30" />
            <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
            <p className="empty-sub">{selected.length === 0 ? 'Pick one or more study groups.' : 'Add words to these groups in the Library.'}</p>
            {selected.length === 0 ? (
              <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
            ) : (
              <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
            )}
          </div>
        )}
      </div>
      {entry && <LeitnerButtons prog={wordProgress[entry.id]} wordId={entry.id} onAnswer={mark} />}
    </div>
  );
}

/* ---------------- Review view (Leitner: every word whose due time has come) ----------------
   Covers all of the user's words, not just the selected categories. The queue is
   fixed when the view opens (sorted by due); Again sends the word to the back of
   this session's queue, Know drops it. Space flips, ← / → answer. */
function ReviewView({ words, groupById, direction, progress, recordAnswer, now, goStudy, goCategory }) {
  const [queue, setQueue] = useState(null); // null until the first build
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [turn, setTurn] = useState(0); // remounts the card, so a re-queued single word animates in again

  const dueIds = useMemo(() => {
    const wordIds = new Set(words.map((w) => w.id));
    return Object.values(progress)
      .filter((p) => wordIds.has(p.wordId) && p.due <= now)
      .sort((a, b) => a.due - b.due)
      .map((p) => p.wordId);
  }, [words, progress, now]);

  /* build the queue on open; refill once it has run dry and more words came due */
  useEffect(() => {
    const dry = queue === null || !queue.some((id) => words.some((w) => w.id === id));
    if (dry && (queue === null || dueIds.length)) setQueue(dueIds);
    // eslint-disable-next-line
  }, [dueIds]);

  useEffect(() => { setFlipped(false); }, [direction]);

  /* first queued word that still exists (words can be deleted mid-session) */
  const current = queue ? queue.find((id) => words.some((w) => w.id === id)) || null : null;

  const mark = useCallback((status) => {
    if (!current) return;
    setFlipped(false);
    setTurn((n) => n + 1);
    const rest = (q) => q.filter((id) => id !== current);
    if (status === 'skip') { setQueue((q) => [...rest(q), current]); return; }
    recordAnswer(current, status === 'known', 'review');
    setDone((n) => n + 1);
    setQueue((q) => (status === 'unknown' ? [...rest(q), current] : rest(q)));
  }, [current, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    setFlipped(false);
    setQueue((q) => shuffle(q));
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); mark('known'); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); mark('unknown'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mark]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;

  /* soonest upcoming review, for the empty state */
  const nextDue = useMemo(() => {
    const wordIds = new Set(words.map((w) => w.id));
    const upcoming = Object.values(progress).filter((p) => wordIds.has(p.wordId) && p.due > now);
    return upcoming.length ? Math.min(...upcoming.map((p) => p.due)) : null;
  }, [words, progress, now]);

  return (
    <div className="study">
      <div className="stage">
        {entry ? (
          <Flashcard key={turn} entry={entry} group={group} flipped={flipped} direction={direction}
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : Object.keys(progress).length === 0 ? (
          <div className="empty-card">
            <Ic.Repeat width="30" height="30" />
            <p className="empty-title">Nothing to review yet</p>
            <p className="empty-sub">Study some words first — they come back here when it's time to repeat them.</p>
            <button className="btn btn-primary" onClick={goStudy}><Ic.Cards /> Start studying</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">All caught up!</p>
            <p className="empty-sub">
              {done > 0 ? done + ' reviewed this session. ' : ''}
              {nextDue ? 'Next review in ' + window.lwFormatInterval(nextDue - now) + '.' : ''}
            </p>
            <button className="btn btn-primary" onClick={goStudy}><Ic.Cards /> Study new words</button>
          </div>
        )}
      </div>
      {entry && <LeitnerButtons prog={progress[entry.id]} wordId={entry.id} onAnswer={mark} />}
    </div>
  );
}

/* ---------------- Choice view (multiple-choice translation quiz) ---------------- */
const CHOICE_OPTIONS = 4;
const CHOICE_ADVANCE_DELAY = 700;

function ChoiceView({ words, selected, groupById, direction, recordAnswer, goLibrary, goCategory }) {
  const pool = useMemo(() => words.filter((w) => selected.includes(w.groupId)), [words, selected]);

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [optionIds, setOptionIds] = useState([]);
  const [pickedId, setPickedId] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const advanceTimer = useRef(null);

  const buildOptions = useCallback((entryId) => {
    const others = shuffle(pool.filter((w) => w.id !== entryId)).slice(0, CHOICE_OPTIONS - 1);
    return shuffle([entryId, ...others.map((w) => w.id)]);
  }, [pool]);

  const startRound = useCallback((id) => {
    setPickedId(null);
    setCurrent(id);
    setOptionIds(id ? buildOptions(id) : []);
  }, [buildOptions]);

  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setCorrectCount(0);
    setAnsweredCount(0);
    setQueue(ids.slice(1));
    startRound(ids[0] || null);
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
    // eslint-disable-next-line
  }, [poolKey]);

  const advance = useCallback(() => {
    setQueue((q) => {
      const nq = q.slice();
      const id = nq.shift();
      startRound(id || null);
      return nq;
    });
  }, [startRound]);

  const pick = useCallback((id) => {
    if (pickedId || !current) return;
    setPickedId(id);
    setAnsweredCount((n) => n + 1);
    if (id === current) setCorrectCount((n) => n + 1);
    recordAnswer(current, id === current, 'choice');
    advanceTimer.current = setTimeout(advance, CHOICE_ADVANCE_DELAY);
  }, [pickedId, current, advance, recordAnswer]);

  const restart = useCallback(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setCorrectCount(0);
    setAnsweredCount(0);
    setQueue(ids.slice(1));
    startRound(ids[0] || null);
  }, [pool, startRound]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const allDone = pool.length > 0 && !entry;
  const askEnglish = direction === 'ru-en'; // prompt shows translation, options are English words

  return (
    <div className="choice">
      {entry ? (
        <div className="choice-card">
          {group && (
            <button type="button" className="choice-tag choice-tag-btn"
              onClick={() => goCategory()} title="Choose study groups">
              <span className="dot" style={{ background: group.color }} />{group.name}
            </button>
          )}
          <div className="choice-prompt-row">
            <div className="choice-prompt">{askEnglish ? entry.tr : entry.word}</div>
            {!askEnglish && <SpeakButton word={entry.word} />}
          </div>
          {!askEnglish && entry.ipa && <div className="choice-ipa">{entry.ipa}</div>}
          <div className="choice-options">
            {optionIds.map((id) => {
              const opt = words.find((w) => w.id === id);
              if (!opt) return null;
              const label = askEnglish ? opt.word : opt.tr;
              let cls = 'choice-opt';
              if (pickedId) {
                if (id === current) cls += ' choice-opt-correct';
                else if (id === pickedId) cls += ' choice-opt-wrong';
              }
              return (
                <button key={id} type="button" className={cls} disabled={!!pickedId} onClick={() => pick(id)}>
                  <span className="choice-opt-label">{label}</span>
                  {askEnglish && <SpeakButton word={opt.word} />}
                </button>
              );
            })}
          </div>
        </div>
      ) : allDone ? (
        <div className="empty-card">
          <Ic.Check width="30" height="30" />
          <p className="empty-title">Round complete!</p>
          <p className="empty-sub">{correctCount} / {answeredCount} correct</p>
          <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Start over</button>
        </div>
      ) : (
        <div className="empty-card">
          <Ic.ListCheck width="30" height="30" />
          <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
          <p className="empty-sub">{selected.length === 0 ? 'Pick one or more study groups.' : 'Add words to these groups in the Library.'}</p>
          {selected.length === 0 ? (
            <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
          ) : (
            <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Fill view (blank-the-word-in-a-sentence cards) ----------------
   Same deck mechanics as Study, but only over words that have an example
   sentence AND that sentence contains a recognisable form of the word (so we can
   actually blank it out). Swipe (or ←/→) like the flashcards: right = known
   (drops from the deck), left = unknown (re-queued, so it comes up again).
   Space flips. */
function FillView({ words, selected, groupById, progress: wordProgress, recordAnswer, goLibrary, goCategory }) {
  /* eligible: has an example whose text contains a form of the word to blank */
  const pool = useMemo(
    () => words.filter((w) => selected.includes(w.groupId)
      && w.example && w.example.trim()
      && window.lwBlankSentence(w.example, w.word)),
    [words, selected]
  );

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({}); // { [wordId]: 'known' | 'unknown' }

  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setProgress({});
    setQueue(ids.slice(1));
    setCurrent(ids[0] || null);
    setFlipped(false);
    // eslint-disable-next-line
  }, [poolKey]);

  const knownCount = useMemo(
    () => Object.values(progress).filter((s) => s === 'known').length,
    [progress]
  );

  const advance = useCallback((nextQueue) => {
    setFlipped(false);
    const nq = nextQueue.slice();
    const id = nq.shift();
    setCurrent(id || null);
    setQueue(nq);
  }, []);

  const draw = useCallback(() => {
    advance(queue);
  }, [advance, queue]);

  /* right = known (drop it); left = unknown (send to the back, so it repeats);
     skip = move on without recording a status */
  const mark = useCallback((status) => {
    if (!current) return;
    if (status === 'skip') { draw(); return; }
    recordAnswer(current, status === 'known', 'fill');
    setProgress((p) => ({ ...p, [current]: status }));
    const nq = status === 'unknown' ? [...queue, current] : queue;
    advance(nq);
  }, [current, queue, advance, draw, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    if (!current) return;
    const shuffled = shuffle([...queue, current]);
    setFlipped(false);
    setCurrent(shuffled[0] || null);
    setQueue(shuffled.slice(1));
  }, [current, queue]);

  const restart = useCallback(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setProgress({});
    setQueue(ids.slice(1));
    setCurrent(ids[0] || null);
    setFlipped(false);
  }, [pool]);

  /* keyboard: space flips, → known, ← unknown */
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); mark('known'); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); mark('unknown'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mark]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const blank = entry ? window.lwBlankSentence(entry.example, entry.word) : null;
  const allDone = pool.length > 0 && !entry;

  return (
    <div className="fill">
      <div className="stage">
        {entry ? (
          <FillCard entry={entry} group={group} flipped={flipped} blank={blank}
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : allDone ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">All sentences done!</p>
            <p className="empty-sub">{knownCount} / {pool.length} known</p>
            <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Start over</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Blank width="30" height="30" />
            <p className="empty-title">{selected.length === 0 ? 'Select a group to begin' : 'No sentences here yet'}</p>
            <p className="empty-sub">
              {selected.length === 0
                ? 'Pick one or more study groups.'
                : 'Add words with example sentences to these groups (the AI fill can write examples for you).'}
            </p>
            {selected.length === 0 ? (
              <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
            ) : (
              <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
            )}
          </div>
        )}
      </div>
      {entry && <LeitnerButtons prog={wordProgress[entry.id]} wordId={entry.id} onAnswer={mark} />}
    </div>
  );
}

/* ---------------- Reading view (AI-generated text from a category) ---------------- */

/* split the highlight phrase into meaningful sub-words (drops filler like "on") */
function readingPhraseTokens(highlight) {
  return String(highlight || '').match(new RegExp('[' + window.LW_LETTERS + '0-9’\']+', 'g')) || [];
}

/* render a sentence, wrapping tokens that match the active highlighted word/phrase in <mark>.
   Supports multi-word phrases (on cloud 9, work out) by matching a run of tokens. */
function ReadingSentenceText({ text, highlight }) {
  if (!highlight) return text;
  const target = readingPhraseTokens(highlight);
  if (target.length === 0) return text;

  /* split keeping delimiters so we can re-join verbatim */
  const parts = String(text).split(new RegExp('([' + window.LW_LETTERS + '0-9’\']+)'));
  /* map word-part indices (odd positions) to their token order */
  const wordIdx = [];
  for (let i = 1; i < parts.length; i += 2) wordIdx.push(i);

  /* mark which parts belong to a match */
  const marked = new Array(parts.length).fill(false);
  for (let k = 0; k <= wordIdx.length - target.length; k++) {
    let ok = true;
    for (let t = 0; t < target.length; t++) {
      if (!readingTokensMatch(parts[wordIdx[k + t]], target[t])) { ok = false; break; }
    }
    if (!ok) continue;
    /* mark the words and any delimiters between them (so "work out" highlights as one) */
    const from = wordIdx[k];
    const to = wordIdx[k + target.length - 1];
    for (let p = from; p <= to; p++) marked[p] = true;
  }

  /* collapse consecutive marked parts into single <mark> spans */
  const out = [];
  let buf = '';
  let bufKey = null;
  const flush = () => {
    if (bufKey !== null) { out.push(<mark key={'m' + bufKey} className="reading-hl">{buf}</mark>); buf = ''; bufKey = null; }
  };
  parts.forEach((part, i) => {
    if (marked[i]) {
      if (bufKey === null) bufKey = i;
      buf += part;
    } else {
      flush();
      out.push(part);
    }
  });
  flush();
  return out;
}

function ReadingView({ groups, words, countByGroup, reading, setReading, startGenerate, defaultLevel, wordIndex, progress, now, addWord, onBack, goLibrary }) {
  const leafGroups = useMemo(
    () => (window.lwLeafGroups ? window.lwLeafGroups(groups) : groups).filter((g) => countByGroup[g.id] > 0),
    [groups, countByGroup]
  );

  const [groupId, setGroupId] = useState('');
  const [levels, setLevels] = useState(() => [LW_CEFR_LEVELS.includes(defaultLevel) ? defaultLevel : defaultLevel === 'A1' ? 'A2' : 'B1']);
  const [topicIds, setTopicIds] = useState([LW_TEXT_TOPICS[0].id]);
  const [keyModal, setKeyModal] = useState(false);

  const toggleLevel = (lv) =>
    setLevels((sel) => (sel.includes(lv) ? sel.filter((x) => x !== lv) : [...sel, lv]));
  const toggleTopic = (id) =>
    setTopicIds((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  /* transient UI state for the text side */
  const [activeWord, setActiveWord] = useState(null);   // word highlighted in the text
  const [openSentence, setOpenSentence] = useState(-1); // index of sentence whose RU is shown
  const [showFullRu, setShowFullRu] = useState(false);  // lightbulb: whole-text translation
  const [sheet, setSheet] = useState(null);              // tapped word: { token, sentence, sentenceTr }

  const cards = reading.cards || [];
  const index = Math.min(reading.index || 0, Math.max(0, cards.length - 1));
  const result = cards[index] || null; // текущая карточка
  /* сторона определяется наличием текстов: пока пачка непустая — показываем
     тексты, как только все прочитаны (пачка пуста) — открываются настройки. */
  const showText = cards.length > 0;
  /* generation status/error live in App (survive tab switches) */
  const state = reading.status === 'loading' ? 'loading' : (reading.error || 'idle');
  const atLast = index === cards.length - 1;

  /* переключение между карточками: сбрасываем UI-состояние показа текста */
  const goToCard = (i) => {
    if (i < 0 || i >= cards.length || i === index) return;
    resetTextUi();
    setReading((r) => ({ ...r, index: i }));
  };

  /* «Дальше»: листаем к следующему тексту пачки (автодогрузки нет — когда
     все тексты прочитаны, пользователь сам запускает новую генерацию). */
  const goNext = () => {
    if (index < cards.length - 1) goToCard(index + 1);
  };

  /* default to the first available category once groups load */
  useEffect(() => {
    if (!groupId && leafGroups.length) setGroupId(leafGroups[0].id);
  }, [leafGroups, groupId]);

  /* перелистывание карточек пачки стрелками клавиатуры, когда открыт текст */
  useEffect(() => {
    if (!showText || !cards.length) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' && index < cards.length - 1) { goToCard(index + 1); }
      else if (e.key === 'ArrowLeft' && index > 0) { goToCard(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showText, cards.length, index]);

  const activeGroup = leafGroups.find((g) => g.id === groupId) || null;
  const groupWords = useMemo(
    () => (activeGroup ? words.filter((w) => w.groupId === activeGroup.id) : []),
    [words, activeGroup]
  );

  const resetTextUi = () => { setActiveWord(null); setOpenSentence(-1); setShowFullRu(false); };

  const runGenerate = () => {
    if (!activeGroup || reading.status === 'loading') return;
    const pool = groupWords.map((w) => w.word).filter(Boolean);
    if (!pool.length) {
      setReading((r) => ({ ...r, error: 'empty' }));
      return;
    }
    /* передаём весь набор выбранных уровней и тем — batch раскидает их
       случайно по текстам пачки (свой случайный срез до 60 слов на каждый). */
    const pickedLevels = levels.length ? levels : ['B1'];
    const chosenTopics = LW_TEXT_TOPICS.filter((t) => topicIds.includes(t.id));
    const topics = chosenTopics.length ? chosenTopics : [LW_TEXT_TOPICS[0]];
    const topicPrompts = topics.map((t) => t.prompt);
    resetTextUi();
    /* fire-and-forget: App owns the promise and the toast on completion */
    startGenerate({ pool, levels: pickedLevels, topicPrompts, lengthWords: LW_TEXT_LENGTHS[1].words });
  };

  const generate = () => {
    if (!activeGroup) return;
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; }
    runGenerate();
  };

  /* "Прочитано": удалить текущий текст из пачки. Когда пачка опустеет,
     showText станет false и автоматически откроются настройки. */
  const markRead = () => {
    resetTextUi();
    setReading((r) => {
      const rest = (r.cards || []).filter((_, i) => i !== index);
      if (!rest.length) return { cards: [], index: 0, status: 'idle', error: null };
      return { ...r, cards: rest, index: Math.min(index, rest.length - 1), status: 'idle', error: null };
    });
  };

  if (leafGroups.length === 0) {
    return (
      <div className="reading">
      <div className="reading-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Reading</button>
        <span className="reading-back-title">AI practice</span>
      </div>
        <div className="empty-card">
          <Ic.Book width="30" height="30" />
          <p className="empty-title">No words yet</p>
          <p className="empty-sub">Add words to a group first, then generate a text from them.</p>
          <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
        </div>
      </div>
    );
  }

  /* show only the words we asked for that actually appear in the generated text */
  const usedSet = result ? new Set(result.used.map((w) => w.toLowerCase())) : null;
  const usedWords = result && result.source
    ? result.source.filter((w) => usedSet.has(w.toLowerCase()))
    : [];
  const sentences = (result && result.sentences) || [];

  const toggleWord = (w) => setActiveWord((cur) => (cur === w ? null : w));

  return (
    <div className="reading">
      <div className="reading-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Reading</button>
        <span className="reading-back-title">AI practice</span>
      </div>
      <div className={'reading-scene' + (showText ? ' is-flipped' : '')}>
        <div className="reading-inner">
          {/* ---------- FRONT: settings ---------- */}
          <div className="reading-face reading-front">
            <div className="reading-controls">
              <label className="field">
                <span className="field-label">Group</span>
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {leafGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({countByGroup[g.id]})</option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span className="field-label">Level (CEFR)</span>
                <div className="chips">
                  {LW_CEFR_LEVELS.map((lv) => (
                    <button key={lv} type="button"
                      className={'chip' + (levels.includes(lv) ? ' chip-on' : '')}
                      onClick={() => toggleLevel(lv)}>{lv}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Topic</span>
                <div className="chips">
                  {LW_TEXT_TOPICS.map((t) => (
                    <button key={t.id} type="button"
                      className={'chip' + (topicIds.includes(t.id) ? ' chip-on' : '')}
                      onClick={() => toggleTopic(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-cta-study"
                disabled={state === 'loading' || !activeGroup || !levels.length || !topicIds.length}
                onClick={generate}>
                {state === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="16" height="16" />}
                {state === 'loading' ? 'Generating...' : 'Generate cards'}
              </button>

              {state === 'bad-key' ? (
                <p className="field-hint">Your Gemini key is invalid.{' '}
                  <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Change key</button>
                </p>
              ) : state !== 'idle' && state !== 'loading' && (
                <p className="field-hint">{LW_READING_ERROR_MSG[state] || LW_READING_ERROR_MSG.error}</p>
              )}
            </div>
          </div>

          {/* ---------- BACK: generated text ---------- */}
          <div className="reading-face reading-back">
            {result && (
              <article className="reading-result">
                <div className="reading-head">
                  <div className="reading-head-main">
                    {result.title && <h2 className="reading-title">{result.title}</h2>}
                    <div className="reading-meta">
                      {result.level && <span className="reading-level">{result.level}</span>}
                      {cards.length > 1 && (
                        <span className="reading-counter">{index + 1} / {cards.length}</span>
                      )}
                    </div>
                  </div>
                  <button className="reading-bulb" type="button" title="Translate the whole text"
                    aria-pressed={showFullRu}
                    onClick={() => { setShowFullRu((v) => !v); setOpenSentence(-1); }}>
                    <Ic.Bulb width="18" height="18" />
                  </button>
                </div>

                <p className="reading-text">
                  {sentences.map((s, i) => (
                    <React.Fragment key={i}>
                      <span
                        className={'reading-sentence' + (openSentence === i ? ' open' : '')}
                        onClick={() => { setOpenSentence((cur) => (cur === i ? -1 : i)); setShowFullRu(false); }}>
                        {activeWord ? <ReadingSentenceText text={s.en} highlight={activeWord} /> : (
                          <TapText text={s.en} wordIndex={wordIndex} progress={progress} now={now}
                            activeToken={sheet && sheet.sentence === s.en ? sheet.token : null}
                            onTap={(tok) => setSheet({ token: tok, sentence: s.en, sentenceTr: s.ru || '' })} />
                        )}
                      </span>
                      {openSentence === i && s.ru && (
                        <span className="reading-sentence-ru">{s.ru}</span>
                      )}
                      {i < sentences.length - 1 ? ' ' : null}
                    </React.Fragment>
                  ))}
                </p>

                {showFullRu && result.textRu && (
                  <p className="reading-text reading-text-ru">{result.textRu}</p>
                )}

                {usedWords.length > 0 && (
                  <div className="reading-words">
                    <span className="field-label">Words from the group (tap to highlight):</span>
                    <div className="reading-word-tags">
                      {usedWords.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={'reading-word-tag used'
                            + (activeWord === w ? ' active' : '')}
                          onClick={() => toggleWord(w)}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {cards.length > 1 && (
                  <div className="reading-nav">
                    <button className="reading-nav-btn" type="button" title="Previous text"
                      disabled={index === 0}
                      onClick={() => goToCard(index - 1)}>
                      <Ic.Arrow style={{ transform: 'scaleX(-1)' }} />
                    </button>
                    <div className="reading-dots">
                      {cards.map((c, i) => (
                        <button key={c.id || i} type="button"
                          className={'reading-dot' + (i === index ? ' on' : '')}
                          title={'Text ' + (i + 1)}
                          aria-current={i === index}
                          onClick={() => goToCard(i)} />
                      ))}
                    </div>
                    <button className="reading-nav-btn" type="button" title="Next text"
                      disabled={atLast}
                      onClick={goNext}>
                      <Ic.Arrow />
                    </button>
                  </div>
                )}

                <div className="reading-actions">
                  <button className="btn btn-primary sm" onClick={markRead} type="button">
                    <Ic.Check width="15" height="15" /> Done reading
                  </button>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      {keyModal && (
        <GeminiKeyModal
          onClose={() => setKeyModal(false)}
          onSaved={(ok) => { if (ok) runGenerate(); }}
        />
      )}
      {sheet && (
        <WordSheet key={sheet.token + '|' + sheet.sentence} token={sheet.token} sentence={sheet.sentence} sentenceTr={sheet.sentenceTr}
          wordIndex={wordIndex} progress={progress} now={now} groups={groups} addWord={addWord} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ---------------- Reading: library home, add text, reader, tappable words ---------------- */
const LW_LEVEL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'A', label: 'A1–A2' },
  { id: 'B', label: 'B1–B2' },
  { id: 'C', label: 'C1+' },
];
const LW_READING_GROUP = '__from_reading__'; // "+ Add to cards" default: the auto-created "From reading" group
const LW_READING_GROUP_NAME = 'From reading';
const LW_COLLOC_GROUP_NAME = 'Collocations'; // where phrases added in Library → Collocations go
const LW_VIDEO_GROUP_NAME = 'From video'; // "+ Add to cards" in Learn → Video
const LW_LOOKUP_CACHE = new Map(); // tapped word + sentence -> Gemini lookup, for this session
const LW_TR_CACHE_MAX = 200;

/* tiny stable hash for cache keys */
function lwHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function lwReadTrCache() { return window.lwLoad(LW_KEYS.trCache, null) || {}; }
function lwWriteTrCache(key, value) {
  const c = lwReadTrCache();
  delete c[key];
  c[key] = value; // re-insert = newest
  const keys = Object.keys(c);
  keys.slice(0, Math.max(0, keys.length - LW_TR_CACHE_MAX)).forEach((k) => { delete c[k]; });
  window.lwSave(LW_KEYS.trCache, c);
}

/* A sentence whose words can be tapped; words already in the user's cards are
   underlined in their status colour. Separators stay plain text. */
function TapText({ text, wordIndex, progress, now, onTap, activeToken }) {
  const parts = window.lwTokenize(text);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const own = window.lwMatchOwnWord(part, wordIndex);
    const status = own ? window.lwWordStatus(progress[own.id], now) : null;
    return (
      <span key={i} role="button" tabIndex={0}
        className={'tw' + (own ? ' tw-known tw-' + status : '') + (activeToken === part ? ' tw-active' : '')}
        onClick={(e) => { e.stopPropagation(); onTap(part); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onTap(part); } }}>
        {part}
      </span>
    );
  });
}

/* Bottom sheet for a tapped word: the user's own card if they have it (instant),
   otherwise a Gemini lookup in the context of the sentence, with "+ Add to cards". */
function WordSheet({ token, sentence, sentenceTr, wordIndex, progress, now, groups, addWord, onClose }) {
  const own = window.lwMatchOwnWord(token, wordIndex);
  const cacheKey = token.toLowerCase() + '|' + sentence;
  const [look, setLook] = useState(() => (LW_LOOKUP_CACHE.has(cacheKey)
    ? { status: 'done', data: LW_LOOKUP_CACHE.get(cacheKey) } : { status: own ? 'own' : 'idle', data: null }));
  const [keyModal, setKeyModal] = useState(false);
  const [manual, setManual] = useState(false);
  const [added, setAdded] = useState(null);
  const [busy, setBusy] = useState(false);
  const leafGroups = window.lwLeafGroups(groups);
  const readingGroup = groups.find((g) => g.name === LW_READING_GROUP_NAME && leafGroups.includes(g));
  const [groupId, setGroupId] = useState(() => {
    const saved = window.lwLoad(LW_KEYS.readerGroup, LW_READING_GROUP);
    return saved === LW_READING_GROUP || leafGroups.some((g) => g.id === saved) ? saved : LW_READING_GROUP;
  });

  const lookup = () => {
    if (own) return;
    if (!window.lwHasGeminiKey()) { setLook({ status: 'no-key', data: null }); return; }
    setLook({ status: 'loading', data: null });
    window.lwAiLookupWord(token, sentence)
      .then((data) => { LW_LOOKUP_CACHE.set(cacheKey, data); setLook({ status: 'done', data }); })
      .catch((e) => setLook({ status: (e && e.code) || 'error', data: null }));
  };
  useEffect(() => { if (look.status === 'idle') lookup(); /* eslint-disable-next-line */ }, []);

  const d = look.data;
  const chooseGroup = (id) => { setGroupId(id); window.lwSave(LW_KEYS.readerGroup, id); };
  const add = async () => {
    if (!d || busy) return;
    setBusy(true);
    try {
      const w = await addWord({ word: d.lemma, ipa: d.ipa, tr: d.tr, pos: d.pos, example: sentence, exampleTr: d.sentenceTr || sentenceTr || '' }, groupId);
      setAdded(w);
    } catch (e) {
      setLook((l) => ({ ...l, status: 'add-error' }));
    }
    setBusy(false);
  };
  const ruSentence = (d && d.sentenceTr) || sentenceTr;
  const errMsg = LW_IMPORT_ERROR_MSG[look.status] || (look.status === 'add-error' ? 'Could not save the word.' : LW_IMPORT_ERROR_MSG.error);

  if (manual) {
    return (
      <Modal title="New word" onClose={onClose}>
        <WordForm initial={{ id: window.lwUid(), word: token.toLowerCase(), example: sentence, exampleTr: ruSentence || '' }} groups={groups}
          onSave={(w) => { addWord(w, w.groupId).then(onClose, () => setManual(false)); }} onCancel={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title={own ? own.word : d ? d.lemma : token} sheet onClose={onClose}>
      <div className="wsheet">
        <div className="wsheet-head">
          <SpeakButton word={own ? own.word : d ? d.lemma : token} />
          <span className="wsheet-meta">
            {own ? [own.ipa, own.pos].filter(Boolean).join(' · ') : d ? [d.ipa, d.pos].filter(Boolean).join(' · ') : ''}
          </span>
          {own && <StatusBadge status={window.lwWordStatus(progress[own.id], now)} />}
        </div>

        {own ? (
          <p className="wsheet-tr">{own.tr}</p>
        ) : look.status === 'loading' ? (
          <p className="wsheet-loading"><span className="spinner" /> Looking it up…</p>
        ) : d ? (
          <p className="wsheet-tr">{d.tr}</p>
        ) : look.status === 'no-key' ? (
          <p className="field-hint">Add a Gemini key to translate words you don't have yet.</p>
        ) : (
          <p className="field-hint" style={{ color: 'var(--error)' }}>{errMsg}</p>
        )}

        <PronunciationCheck target={own ? own.word : d ? d.lemma : token} />

        <div className="wsheet-sentence">
          <p className="wsheet-en"><ReadingSentenceText text={sentence} highlight={token} /></p>
          {ruSentence && <p className="wsheet-ru">{ruSentence}</p>}
        </div>

        {own ? (
          <p className="wsheet-note"><Ic.Check width="16" height="16" /> Already in your cards</p>
        ) : added ? (
          <p className="wsheet-note"><Ic.Check width="16" height="16" /> Added “{added.word}” to your cards</p>
        ) : d ? (
          <div className="wsheet-add">
            <select className="input input-sm" value={groupId} onChange={(e) => chooseGroup(e.target.value)} aria-label="Group">
              <option value={LW_READING_GROUP}>{readingGroup ? LW_READING_GROUP_NAME : LW_READING_GROUP_NAME + ' (new group)'}</option>
              {leafGroups.filter((g) => g !== readingGroup).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={add}>
              {busy ? <span className="spinner" /> : <Ic.Plus width="16" height="16" />} Add to cards
            </button>
          </div>
        ) : look.status === 'no-key' ? (
          <div className="wsheet-add">
            <button type="button" className="btn btn-primary" onClick={() => setKeyModal(true)}><Ic.Key width="16" height="16" /> Add Gemini key</button>
            <button type="button" className="btn btn-soft" onClick={() => setManual(true)}>Add manually</button>
          </div>
        ) : look.status !== 'loading' && (
          <div className="wsheet-add">
            <button type="button" className="btn btn-soft" onClick={lookup}>Try again</button>
            <button type="button" className="btn btn-soft" onClick={() => setManual(true)}>Add manually</button>
          </div>
        )}
      </div>
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(false)} onSaved={(ok) => { if (ok) lookup(); }} />}
    </Modal>
  );
}

/* cover placeholder: gradient by level + the title's initials */
function TextCover({ text }) {
  const band = (text.level || 'B')[0];
  const initials = (text.title || '?').split(/\s+/).filter((w) => new RegExp('[' + window.LW_LETTERS + ']').test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <span className={'tcover tcover-' + band}>{initials}</span>;
}

function lwReadMinutes(words) { return Math.max(1, Math.round(words / 200)); }

function TextCard({ text, prog, canDelete, onOpen, onDelete }) {
  const mins = lwReadMinutes(text.wordCount || 0);
  return (
    <article className="tcard" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <TextCover text={text} />
      <div className="tcard-main">
        <div className="tcard-tags">
          <span className="reading-level">{text.level}</span>
          {text.shared && <span className="tcard-tag">Library</span>}
        </div>
        <h3 className="tcard-title">{text.title}</h3>
        {text.author && <p className="tcard-author">{text.author}</p>}
        <p className="tcard-meta">
          {(text.chapters || []).length > 1 ? text.chapters.length + ' chapters · ' : ''}
          {mins >= 60 ? '~' + Math.round(mins / 60) + 'h' : '~' + mins + ' min'}
          {prog ? ' · ' + (prog.pct || 0) + '% read' : ''}
        </p>
        {prog && <span className="mastery-track"><span className="mastery-fill tcard-fill" style={{ width: (prog.pct || 0) + '%' }} /></span>}
      </div>
      {canDelete && (
        <button type="button" className="icon-btn sm danger tcard-del" aria-label="Delete text"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}><Ic.Trash /></button>
      )}
    </article>
  );
}

function ReadingHome({ texts, progressByText, userId, isAdmin, aiReady, onOpen, onOpenAi, onAdd, onDelete }) {
  const [level, setLevel] = useState('all');
  const matchLevel = (t) => level === 'all' || (t.level || '')[0] === level || (level === 'C' && (t.level || '')[0] === 'C');
  const byRecent = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const books = texts.filter((t) => t.shared && matchLevel(t)).sort((a, b) => a.title.localeCompare(b.title));
  const mine = texts.filter((t) => !t.shared && t.userId === userId && matchLevel(t)).sort(byRecent);
  const last = Object.values(progressByText)
    .filter((p) => texts.some((t) => t.id === p.textId) && (p.pct || 0) < 100)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const lastText = last && texts.find((t) => t.id === last.textId);
  const canDelete = (t) => t.userId === userId || isAdmin;

  return (
    <div className="rhome">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Reading</h1>
          <p className="lib-sub">Tap any word to translate it and add it to your cards.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onAdd}><Ic.Plus /> Add text</button>
      </div>

      {lastText && (
        <section className="continue-card" onClick={() => onOpen(lastText.id)} role="button" tabIndex={0}>
          <TextCover text={lastText} />
          <div className="continue-main">
            <span className="wotd-kicker">Continue reading</span>
            <h2 className="continue-title">{lastText.title}</h2>
            <p className="continue-sub">
              {(lastText.chapters[last.chapter] && lastText.chapters[last.chapter].title) || 'Chapter ' + (last.chapter + 1)} · {last.pct || 0}%
            </p>
            <span className="goal-track"><span className="goal-fill" style={{ width: (last.pct || 0) + '%', display: 'block' }} /></span>
          </div>
          <Ic.ChevronRight className="continue-arrow" />
        </section>
      )}

      <section className="ai-card" onClick={onOpenAi} role="button" tabIndex={0}>
        <span className="tile-icon tile-icon-blue"><Ic.Bulb width="18" height="18" /></span>
        <div className="ai-card-main">
          <h2 className="dash-title">AI practice</h2>
          <p className="dash-sub">Short texts written by Gemini from the words of a group.</p>
        </div>
        {aiReady > 0 ? <span className="dash-badge">{aiReady} ready</span> : <Ic.ChevronRight />}
      </section>

      <div className="status-chips">
        {LW_LEVEL_FILTERS.map((f) => (
          <button key={f.id} type="button" className={'chip' + (level === f.id ? ' chip-on' : '')} onClick={() => setLevel(f.id)}>{f.label}</button>
        ))}
      </div>

      <h2 className="section-label">Books</h2>
      {books.length ? (
        <div className="tcards">{books.map((t) => (
          <TextCard key={t.id} text={t} prog={progressByText[t.id]} canDelete={isAdmin} onOpen={() => onOpen(t.id)} onDelete={() => onDelete(t)} />
        ))}</div>
      ) : (
        <p className="row-empty">{isAdmin ? 'No books yet — add a public-domain book with “Add text” → “Publish for everyone”.' : 'No books at this level yet.'}</p>
      )}

      <h2 className="section-label">My texts</h2>
      {mine.length ? (
        <div className="tcards">{mine.map((t) => (
          <TextCard key={t.id} text={t} prog={progressByText[t.id]} canDelete={canDelete(t)} onOpen={() => onOpen(t.id)} onDelete={() => onDelete(t)} />
        ))}</div>
      ) : (
        <p className="row-empty">Paste an article or upload a .txt file with “Add text”.</p>
      )}
    </div>
  );
}

/* Add a text: paste or .txt upload, split into chapters, optionally publish (admins). */
function AddTextModal({ isAdmin, onSave, onClose }) {
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [level, setLevel] = useState('B1');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const isGutenberg = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(raw);
  const clean = useMemo(() => (isGutenberg ? window.lwCleanGutenberg(raw) : raw.trim()), [raw, isGutenberg]);
  const chapters = useMemo(() => (clean ? window.lwSplitChapters(clean, { dropFrontMatter: isGutenberg }) : []), [clean, isGutenberg]);
  const wordCount = chapters.reduce((n, c) => n + c.paragraphs.reduce((m, p) => m + window.lwWordCount(p), 0), 0);

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((t) => {
      setRaw(t);
      /* Gutenberg files carry "Title:" / "Author:" lines in their header */
      const tm = t.match(/^Title:\s*(.+)$/m);
      const am = t.match(/^Author:\s*(.+)$/m);
      if (tm && !title) setTitle(tm[1].trim());
      else if (!title) setTitle(file.name.replace(/\.txt$/i, ''));
      if (am && !author) setAuthor(am[1].trim());
    });
  };

  const save = async () => {
    if (!title.trim() || !chapters.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ title: title.trim(), author: author.trim(), level, shared: isAdmin && shared, source: isGutenberg ? 'gutenberg' : 'user', wordCount }, chapters);
      onClose();
    } catch (e) {
      setError('Could not save the text: ' + ((e && e.message) || e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add text" onClose={busy ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim() || !chapters.length}>
          {busy ? <><span className="spinner" /> Saving…</> : 'Save'}
        </button>
      </>}>
      <div className="form">
        <label className="field">
          <span className="field-label-row">
            <span className="field-label">Text</span>
            <button type="button" className="btn btn-soft sm" onClick={() => fileRef.current && fileRef.current.click()}><Ic.Plus width="15" height="15" /> Upload .txt</button>
          </span>
          <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onFile} />
          <textarea className="input" rows={7} value={raw} placeholder="Paste an article, a story or a book chapter…" onChange={(e) => setRaw(e.target.value)} />
        </label>
        {chapters.length > 0 && (
          <p className="field-hint">
            {isGutenberg ? 'Project Gutenberg header and licence removed. ' : ''}
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · {wordCount.toLocaleString('en-US')} words
            {chapters.length > 1 ? ': ' + chapters.slice(0, 3).map((c) => c.title).join(', ') + (chapters.length > 3 ? '…' : '') : ''}
          </p>
        )}
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Alice's Adventures in Wonderland" />
          </label>
          <label className="field">
            <span className="field-label">Author <span className="opt">(optional)</span></span>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Level</span>
          <div className="cefr-pills">
            {window.LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (level === lv ? ' on' : '')} onClick={() => setLevel(lv)}>{lv}</button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <label className="check-row">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            <span><strong>Publish for everyone</strong> — shows in Books for all users. Only public-domain texts.</span>
          </label>
        )}
        {error && <p className="field-hint" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Modal>
  );
}

/* The reader: one page (~250 words) of a chapter at a time. Words are tappable,
   paragraphs can be read aloud and translated; position syncs to reading_progress. */
function ReaderView({ text, prog, uid, wordIndex, progress, now, groups, addWord, onBack }) {
  const chapters = text.chapters || [];
  const [at, setAt] = useState(() => ({
    chapter: Math.min(Math.max(0, (prog && prog.chapter) || 0), Math.max(0, chapters.length - 1)),
    page: (prog && prog.page) || 0,
  }));
  const [chapter, setChapter] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const cache = useRef({});
  const [tr, setTr] = useState({}); // paragraph key -> { status, ru: [] }
  const [speaking, setSpeaking] = useState(null); // { para, sent }
  const [sheet, setSheet] = useState(null); // { token, sentence, sentenceTr }
  const [practicePara, setPracticePara] = useState(-1); // paragraph open for "Read aloud"

  /* load the chapter (kept in memory while the reader is open) */
  useEffect(() => {
    let alive = true;
    setChapter(cache.current[at.chapter] || null);
    setLoadError(false);
    if (cache.current[at.chapter]) return;
    window.lwGetChapter(text.id, at.chapter)
      .then((c) => { if (!alive) return; cache.current[at.chapter] = c; setChapter(c); if (!c) setLoadError(true); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [text.id, at.chapter]);

  const pages = useMemo(() => (chapter ? window.lwPaginate(chapter.paragraphs) : []), [chapter]);
  const page = Math.min(at.page, Math.max(0, pages.length - 1));
  const paragraphs = pages[page] || [];
  const sentences = useMemo(() => paragraphs.map((p) => window.lwSplitSentences(p)), [paragraphs]);
  const paraKey = (p) => text.id + '|' + at.chapter + '|' + lwHash(p);

  /* remember where we are (debounced); pct is over the whole text by word count */
  useEffect(() => {
    if (!pages.length) return;
    const t = setTimeout(() => {
      const before = chapters.slice(0, at.chapter).reduce((n, c) => n + (c.words || 0), 0);
      const inChapter = ((chapters[at.chapter] && chapters[at.chapter].words) || 0) * ((page + 1) / pages.length);
      const pct = Math.min(100, Math.round(((before + inChapter) / Math.max(1, text.wordCount || 1)) * 100));
      window.lwSaveReadingProgress(uid, text.id, { chapter: at.chapter, page, pct }).catch((e) => console.error('reading progress', e));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [at.chapter, page, pages.length]);

  /* stop speech when leaving the page */
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, [at.chapter, page]);
  useEffect(() => { window.scrollTo(0, 0); setSpeaking(null); setPracticePara(-1); }, [at.chapter, page]);

  const lastPage = page >= pages.length - 1;
  const goNext = () => {
    if (!pages.length) return;
    if (!lastPage) setAt({ chapter: at.chapter, page: page + 1 });
    else if (at.chapter < chapters.length - 1) setAt({ chapter: at.chapter + 1, page: 0 });
  };
  const goPrev = () => {
    if (page > 0) setAt({ chapter: at.chapter, page: page - 1 });
    else if (at.chapter > 0) setAt({ chapter: at.chapter - 1, page: 1e6 }); // clamps to the last page
  };
  useEffect(() => {
    const h = (e) => {
      if (sheet || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const speak = (pi) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speaking && speaking.para === pi) { setSpeaking(null); return; }
    const list = sentences[pi];
    list.forEach((s, si) => {
      const u = window.lwUtterance(s, 0.9); // chosen voice, a bit slower for reading along
      u.onstart = () => setSpeaking({ para: pi, sent: si });
      if (si === list.length - 1) u.onend = () => setSpeaking((cur) => (cur && cur.para === pi && cur.sent === si ? null : cur));
      window.speechSynthesis.speak(u);
    });
  };

  const translate = (pi) => {
    const key = paraKey(paragraphs[pi]);
    const cur = tr[key];
    if (cur && cur.status === 'done') { setTr((t) => ({ ...t, [key]: { ...cur, open: !cur.open } })); return; }
    const cached = lwReadTrCache()[key];
    if (cached) { setTr((t) => ({ ...t, [key]: { status: 'done', ru: cached, open: true } })); return; }
    if (!window.lwHasGeminiKey()) { setTr((t) => ({ ...t, [key]: { status: 'no-key', open: true } })); return; }
    setTr((t) => ({ ...t, [key]: { status: 'loading', open: true } }));
    window.lwAiTranslateSentences(sentences[pi])
      .then((ru) => { lwWriteTrCache(key, ru); setTr((t) => ({ ...t, [key]: { status: 'done', ru, open: true } })); })
      .catch((e) => setTr((t) => ({ ...t, [key]: { status: (e && e.code) || 'error', open: true } })));
  };

  const tap = (pi, si, token) => {
    const key = paraKey(paragraphs[pi]);
    const ru = (tr[key] && tr[key].ru) || lwReadTrCache()[key];
    setSheet({ token, sentence: sentences[pi][si], sentenceTr: ru ? ru[si] : '' });
  };

  /* how many of the user's words appear on this page */
  const known = useMemo(() => {
    const ids = new Set();
    paragraphs.forEach((p) => window.lwTokenize(p).forEach((tok, i) => {
      if (i % 2) { const w = window.lwMatchOwnWord(tok, wordIndex); if (w) ids.add(w.id); }
    }));
    return ids.size;
  }, [paragraphs, wordIndex]);

  const chMeta = chapters[at.chapter] || {};
  return (
    <div className="reader">
      <header className="reader-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to Reading"><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /></button>
        <div className="reader-titles">
          <h1 className="reader-title">{text.title}</h1>
          {chapters.length > 1 ? (
            <select className="reader-chapter" value={at.chapter} onChange={(e) => setAt({ chapter: +e.target.value, page: 0 })} aria-label="Chapter">
              {chapters.map((c, i) => <option key={i} value={i}>{c.title || 'Chapter ' + (i + 1)}</option>)}
            </select>
          ) : text.author ? <span className="reader-author">{text.author}</span> : null}
        </div>
      </header>
      <div className="reader-progress">
        <span>{pages.length ? 'Page ' + (page + 1) + ' of ' + pages.length : 'Loading…'}</span>
        <span className="goal-track"><span className="goal-fill" style={{ display: 'block', width: (pages.length ? ((page + 1) / pages.length) * 100 : 0) + '%' }} /></span>
        <span className="reader-known" title="Words from your cards on this page">In your cards: {known}</span>
      </div>

      <article className="reader-page">
        {loadError ? (
          <p className="row-empty">Could not load this chapter. Check your connection and try again.</p>
        ) : !chapter ? (
          <p className="row-empty"><span className="spinner" /> Loading…</p>
        ) : (
          <>
            {page === 0 && chMeta.title && <h2 className="reader-chapter-title">{chMeta.title}</h2>}
            {paragraphs.map((p, pi) => {
              const key = paraKey(p);
              const t = tr[key];
              return (
                <div key={pi + key} className="rpara">
                  <p className="rpara-text">
                    {sentences[pi].map((s, si) => (
                      <React.Fragment key={si}>
                        <span className={'rsent' + (speaking && speaking.para === pi && speaking.sent === si ? ' speaking' : '')}>
                          <TapText text={s} wordIndex={wordIndex} progress={progress} now={now}
                            activeToken={sheet && sheet.sentence === s ? sheet.token : null}
                            onTap={(tok) => tap(pi, si, tok)} />
                        </span>{' '}
                      </React.Fragment>
                    ))}
                  </p>
                  <div className="rpara-tools">
                    <button type="button" className="rtool" onClick={() => speak(pi)} aria-pressed={!!(speaking && speaking.para === pi)}>
                      {speaking && speaking.para === pi ? <Ic.Pause width="15" height="15" /> : <Ic.Play width="15" height="15" />} Listen
                    </button>
                    <button type="button" className="rtool" onClick={() => translate(pi)} aria-pressed={!!(t && t.open)}>
                      {t && t.status === 'loading' ? <span className="spinner" /> : <Ic.Translate width="15" height="15" />} Translate
                    </button>
                    {window.lwCanRecognize() && (
                      <button type="button" className="rtool" onClick={() => setPracticePara((cur) => (cur === pi ? -1 : pi))} aria-pressed={practicePara === pi}>
                        <Ic.Mic width="15" height="15" /> Read aloud
                      </button>
                    )}
                  </div>
                  {practicePara === pi && (
                    <div className="rpara-practice">
                      <p className="field-hint">Read the paragraph out loud, then tap Stop. Words we didn't hear are marked.</p>
                      <PronunciationCheck target={p} label="Start reading" passage />
                    </div>
                  )}
                  {t && t.open && t.status === 'done' && (
                    <div className="rpara-ru">{t.ru.map((r, i) => <p key={i}>{r}</p>)}</div>
                  )}
                  {t && t.open && t.status !== 'done' && t.status !== 'loading' && (
                    <p className="field-hint">{t.status === 'no-key' ? 'Add a Gemini key in Profile to translate.' : LW_IMPORT_ERROR_MSG[t.status] || LW_IMPORT_ERROR_MSG.error}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </article>

      <nav className="reader-nav">
        <button type="button" className="btn btn-soft" onClick={goPrev} disabled={at.chapter === 0 && page === 0}>
          <Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Previous
        </button>
        <button type="button" className="btn btn-primary" onClick={goNext} disabled={!pages.length || (lastPage && at.chapter >= chapters.length - 1)}>
          {lastPage && at.chapter < chapters.length - 1 ? 'Next chapter' : 'Next'} <Ic.Arrow />
        </button>
      </nav>

      {sheet && (
        <WordSheet key={sheet.token + '|' + sheet.sentence} token={sheet.token} sentence={sheet.sentence} sentenceTr={sheet.sentenceTr}
          wordIndex={wordIndex} progress={progress} now={now} groups={groups} addWord={addWord} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ---------------- Category view ---------------- */
function CategoryView({ groups, selected, setSelected, countByGroup, goStudy, ctaLabel = 'Start studying' }) {
  const leafGroups = (window.lwLeafGroups ? window.lwLeafGroups(groups) : groups)
    .filter((g) => countByGroup[g.id] > 0);
  const toggle = (id) => {
    setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };
  const allOn = selected.length === leafGroups.length && leafGroups.length > 0;
  const toggleAll = () => {
    setSelected(allOn ? [] : leafGroups.map((g) => g.id));
  };
  const hasWords = selected.some((id) => countByGroup[id] > 0);

  return (
    <div className="category">
      <div className="selector">
        <div className="chips">
          <button className={'chip chip-all' + (allOn ? ' chip-on' : '')} onClick={toggleAll} type="button">
            All
          </button>
          {leafGroups.map((g) => (
            <GroupChip key={g.id} group={g} groups={groups} count={countByGroup[g.id] || 0}
              active={selected.includes(g.id)} onToggle={() => toggle(g.id)} />
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-cta-study" disabled={!hasWords} onClick={goStudy}>
        {ctaLabel}
      </button>
    </div>
  );
}

/* ---------------- Admin view ---------------- */
const LW_ROLES = ['user', 'premium', 'admin'];

function AdminView({ currentUid }) {
  const [tab, setTab] = useState('users'); // 'users' | 'data'
  const [users, setUsers] = useState(null); // null = loading
  const [allData, setAllData] = useState(null); // null = loading, {groups, words}
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const loadUsers = useCallback(() => {
    setError('');
    window.lwAdminFetchUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users.'));
  }, []);

  const loadAllData = useCallback(() => {
    setError('');
    window.lwAdminFetchAllData()
      .then(setAllData)
      .catch(() => setError('Could not load words and groups.'));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === 'data' && !allData) loadAllData(); }, [tab, allData, loadAllData]);

  const changeRole = async (uid, role) => {
    setSavingId(uid);
    try {
      await window.lwAdminSetRole(uid, role);
      setUsers((list) => list.map((u) => (u.id === uid ? { ...u, role } : u)));
    } catch (e) {
      setError('Could not change the role.');
    } finally {
      setSavingId(null);
    }
  };

  const reload = tab === 'users' ? loadUsers : loadAllData;

  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h1 className="lib-title">Admin</h1>
          <p className="lib-sub">{tab === 'users' ? 'Users and roles' : 'All words and groups'}</p>
        </div>
        <div className="lib-head-actions">
          <div className="seg">
            <button className={'seg-btn' + (tab === 'users' ? ' on' : '')} onClick={() => setTab('users')} type="button">Users</button>
            <button className={'seg-btn' + (tab === 'data' ? ' on' : '')} onClick={() => setTab('data')} type="button">All words and groups</button>
          </div>
          <button className="btn btn-soft" onClick={reload} type="button"><Ic.Shuffle /> Refresh</button>
        </div>
      </div>
      {error && <p className="field-hint" style={{ color: 'var(--error)' }}>{error}</p>}
      {tab === 'users' ? (
        users === null ? (
          <p className="row-empty">Loading…</p>
        ) : (
          <div className="groups-list">
            {users.map((u) => (
              <section className="grp" key={u.id}>
                <header className="grp-head">
                  <div className="grp-toggle" style={{ flex: 1 }}>
                    <span className="grp-name">{u.username || u.id}</span>
                    <span className="grp-count">{u.wordCount} words · {u.groupCount} groups</span>
                  </div>
                  <div className="grp-tools">
                    <select className="input sm" value={u.role || 'user'} disabled={u.id === currentUid || savingId === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px' }}>
                      {LW_ROLES.map((r) => (
                        <option key={r} value={r}>{LW_ROLE_LABEL[r] || r}</option>
                      ))}
                    </select>
                  </div>
                </header>
              </section>
            ))}
            {users.length === 0 && <p className="row-empty">No users yet.</p>}
          </div>
        )
      ) : (
        <AdminAllDataView data={allData} onChanged={loadAllData} />
      )}
    </div>
  );
}

function AdminAllDataView({ data, onChanged }) {
  const [wordModal, setWordModal] = useState(null); // {initial}
  const [groupModal, setGroupModal] = useState(null); // {initial}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const words = data ? data.words : [];
  const wordsByGroup = useMemo(() => {
    const m = {};
    words.forEach((w) => { (m[w.groupId] = m[w.groupId] || []).push(w); });
    return m;
  }, [words]);

  if (!data) return <p className="row-empty">Loading…</p>;
  const { groups } = data;
  const ownerLabel = (item) => item.username || item.userId || '—';

  const saveWord = (w) => {
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, userId: wordModal.initial.userId, username: wordModal.initial.username, shared: wordModal.initial.shared,
      lang: window.lwDocLang(groups.find((g) => g.id === w.groupId) || wordModal.initial) });
    setWordModal(null);
    onChanged();
  };
  const saveGroup = (g) => {
    window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...g, userId: groupModal.initial.userId, username: groupModal.initial.username, shared: groupModal.initial.shared,
      lang: window.lwDocLang(groups.find((x) => x.id === (g.parentId || g.id)) || groupModal.initial) });
    setGroupModal(null);
    onChanged();
  };
  const doDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'word') window.lwDeleteDoc(window.LW_COLLECTIONS.words, confirm.id);
    if (confirm.kind === 'group') {
      const subGroupIds = groups.filter((sg) => sg.parentId === confirm.id).map((sg) => sg.id);
      [confirm.id, ...subGroupIds].forEach((id) => {
        window.lwDeleteDoc(window.LW_COLLECTIONS.groups, id);
        window.lwDeleteWordsByGroup(id);
      });
    }
    setConfirm(null);
    onChanged();
  };

  /* admins see every language here: writes keep each doc's own (legacy docs: English) */
  const makeWordShared = (w) => {
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, shared: true, lang: window.lwDocLang(w) });
    onChanged();
  };
  const makeGroupShared = (g) => {
    const subGroupIds = groups.filter((sg) => sg.parentId === g.id).map((sg) => sg.id);
    [g, ...groups.filter((sg) => subGroupIds.includes(sg.id))].forEach((grp) => {
      window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...grp, shared: true, lang: window.lwDocLang(grp) });
    });
    [g.id, ...subGroupIds].forEach((groupId) => {
      (wordsByGroup[groupId] || []).forEach((w) => {
        window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, shared: true, lang: window.lwDocLang(w) });
      });
    });
    onChanged();
  };

  if (groups.length === 0) return <p className="row-empty">No groups yet.</p>;

  return (
    <div className="groups-list">
      {groups.map((g) => {
        const open = openGroups.includes(g.id);
        return (
        <section className="grp" key={g.id}>
          <header className="grp-head">
            <button className="grp-toggle" onClick={() => toggleOpen(g.id)}>
              <Ic.Chevron style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
              <span className="grp-name">{g.name}</span>
              <span className="grp-count">{(wordsByGroup[g.id] || []).length} words · added by {ownerLabel(g)}</span>
            </button>
            <div className="grp-tools">
              {!g.shared && <button className="btn btn-soft sm" onClick={() => makeGroupShared(g)} type="button">Make shared</button>}
              <button className="icon-btn sm" onClick={() => setGroupModal({ initial: g })} aria-label="Edit"><Ic.Edit /></button>
              <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'group', id: g.id, label: g.name })} aria-label="Delete"><Ic.Trash /></button>
            </div>
          </header>
          {open && (
          <div className="word-rows">
            {(wordsByGroup[g.id] || []).map((w) => (
              <div className="wrow" key={w.id}>
                <div className="wrow-main">
                  <div className="wrow-top">
                    <span className="wrow-word">{w.word}</span>
                    {w.tr && <span className="wrow-tr">{w.tr}</span>}
                  </div>
                </div>
                <span className="grp-count">added by {ownerLabel(w)}</span>
                <div className="wrow-tools">
                  {!w.shared && <button className="btn btn-soft sm" onClick={() => makeWordShared(w)} type="button">Make shared</button>}
                  <button className="icon-btn sm" onClick={() => setWordModal({ initial: w })} aria-label="Edit"><Ic.Edit /></button>
                  <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} aria-label="Delete"><Ic.Trash /></button>
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
        );
      })}

      {wordModal && (
        <Modal title="Edit word" onClose={() => setWordModal(null)}>
          <WordForm initial={wordModal.initial} groups={groups} onSave={saveWord} onCancel={() => setWordModal(null)} />
        </Modal>
      )}
      {groupModal && (
        <Modal title="Edit group" onClose={() => setGroupModal(null)}>
          <GroupForm initial={groupModal.initial} onSave={saveGroup} onCancel={() => setGroupModal(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title={'Delete ' + confirm.kind} onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={doDelete}>Delete</button>
          </>}>
          <p className="confirm-text">
            Delete <strong>{confirm.label}</strong>{confirm.kind === 'group' ? ' and all its words' : ''}? This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Library: Words view pieces ---------------- */
const LW_STATUS_LABEL = { new: 'New', learning: 'Learning', review: 'To review', mastered: 'Mastered' };
const LW_LIB_STATUSES = ['all', 'new', 'learning', 'review', 'mastered'];
const LW_LIB_SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'az', label: 'A–Z' },
  { id: 'due', label: 'Next review' },
];

function StatusBadge({ status }) {
  return <span className={'st-badge st-badge-' + status}><span className={'status-swatch status-' + status} />{LW_STATUS_LABEL[status]}</span>;
}

/* Mastery = how far up the Leitner boxes the word is (box / 5); new words are 0%. */
function WordCard({ word, group, prog, now, canEdit, onEdit, onDelete, clip, onClip }) {
  const status = window.lwWordStatus(prog, now);
  const pct = prog ? Math.round(((prog.box || 0) / window.LW_MASTERED_BOX) * 100) : 0;
  return (
    <article className="wcard">
      <div className="wcard-top">
        <StatusBadge status={status} />
        {group && <span className="wcard-group"><span className="grp-dot" style={{ background: group.color }} />{group.name}</span>}
        {clip && <button type="button" className="wcard-clip" onClick={onClip} aria-label="Watch the video clip"><Ic.Play width="12" height="12" /> Clip</button>}
        <SpeakButton word={word.word} />
      </div>
      <div className="wcard-head">
        <span className="wcard-word">{word.word}</span>
        {word.ipa && <span className="wcard-ipa">{word.ipa}</span>}
        {word.pos && <span className="wcard-pos">{word.pos}</span>}
      </div>
      <div className="wcard-tr">{word.tr}</div>
      <div className="wcard-foot">
        <span className="wcard-mastery-label">Mastery</span>
        <span className="mastery-track"><span className={'mastery-fill status-' + status} style={{ width: pct + '%' }} /></span>
        <span className="wcard-pct">{pct}%</span>
        {canEdit && (
          <span className="wrow-tools">
            <button className="icon-btn sm" onClick={onEdit} aria-label="Edit"><Ic.Edit /></button>
            <button className="icon-btn sm danger" onClick={onDelete} aria-label="Delete"><Ic.Trash /></button>
          </span>
        )}
      </div>
    </article>
  );
}

function WordOfTheDay({ word, onPractice }) {
  return (
    <section className="wotd">
      <span className="wotd-kicker">Word of the day</span>
      <div className="wotd-head">
        <h2 className="wotd-word">{word.word}</h2>
        <SpeakButton word={word.word} />
      </div>
      {(word.ipa || word.pos) && <p className="wotd-ipa">{word.ipa}{word.ipa && word.pos ? ' · ' : ''}{word.pos}</p>}
      <p className="wotd-tr">{word.tr}</p>
      {word.example && <p className="wotd-ex">“{word.example}”</p>}
      <button type="button" className="btn btn-primary" onClick={onPractice}><Ic.Learn width="16" height="16" /> Practice now</button>
      <Ic.Sparkle className="wotd-art" aria-hidden="true" />
    </section>
  );
}

/* one word as a flashcard with Again / Know — answers count like in Learn */
function PracticeCardModal({ word, group, prog, direction, recordAnswer, onClose }) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(null); // 'known' | 'unknown'
  const answer = (status) => {
    if (status === 'skip') { onClose(); return; }
    if (status !== 'known' && status !== 'unknown') return;
    recordAnswer(word.id, status === 'known', 'study');
    setAnswered(status);
  };
  return (
    <Modal title="Practice" onClose={onClose}>
      <div className="practice">
        {answered ? (
          <div className="practice-done">
            <Ic.Check width="28" height="28" />
            <p className="empty-title">{answered === 'known' ? 'Nice!' : 'It will come back soon'}</p>
            <p className="empty-sub">{answered === 'known' ? 'Answer saved to your progress.' : 'You\'ll see it again in Review in 10 minutes.'}</p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="stage practice-stage">
              <Flashcard entry={word} group={group} flipped={flipped} direction={direction}
                onFlip={() => setFlipped((f) => !f)} onSwipe={answer} onShuffle={() => {}} />
            </div>
            <LeitnerButtons prog={prog} wordId={word.id} onAnswer={answer} />
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Library view ---------------- */
const LW_LIB_PAGE = 50; // word cards shown per "Show more"
function LibraryView({ groups, words, userId, username, isAdmin, progress, now, direction, recordAnswer, goImport,
  collocations, saveCollocation, pushToast, clips }) {
  /* a card's clip (Learn → Video), for the ▶ on word cards */
  const clipByWord = useMemo(() => {
    const m = {};
    (clips || []).forEach((c) => { const w = window.lwFindCardForClip(c, words); if (w && !m[w.id]) m[w.id] = c; });
    return m;
  }, [clips, words]);
  const [clipOpen, setClipOpen] = useState(null);
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?, parentGroup?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);
  const [query, setQuery] = useState('');
  /* Words view filters; remembered on this device */
  const [lib, setLib] = useState(() => ({
    view: 'words', status: 'all', groupId: '', sort: 'recent', collocOwner: 'all', collocSort: 'az',
    ...(window.lwLoad(LW_KEYS.library, null) || {}),
  }));
  const setLibField = (k, v) => { setLib((l) => ({ ...l, [k]: v })); setLimit(LW_LIB_PAGE); };
  useEffect(() => { window.lwSave(LW_KEYS.library, lib); }, [lib]);
  const [limit, setLimit] = useState(LW_LIB_PAGE);
  const [practice, setPractice] = useState(null); // word being practised from the word of the day
  const [tagState, setTagState] = useState({ busy: false, done: 0, error: null });
  const [keyModal, setKeyModal] = useState(false);
  const [collocForm, setCollocForm] = useState(null); // { initial? } — create / edit form
  const [collocOpen, setCollocOpen] = useState(null); // id of the entry shown in the sheet
  const [collocDelete, setCollocDelete] = useState(null); // entry awaiting delete confirmation
  const wordsById = useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  const canEditColloc = (e) => (e.shared ? isAdmin : e.userId === userId);
  const submitColloc = (entry, phrases, newPhrases) => {
    setCollocForm(null);
    saveCollocation(entry, phrases, newPhrases)
      .then((doc) => setCollocOpen(doc.id))
      .catch((e) => pushToast({ kind: 'error', title: 'Could not save the collocation', msg: (e && e.message) || String(e) }));
  };

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const topGroups = groups.filter((g) => !g.parentId);
  const subGroupsOf = (id) => groups.filter((g) => g.parentId === id);
  const groupById = (id) => groups.find((g) => g.id === id);

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? words.filter((w) => w.word.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q)))
    : null;

  const canEdit = (item) => item.userId === userId || isAdmin;

  /* ---- Words view: group + search + status filters, sort, paging ---- */
  const statusOf = (w) => window.lwWordStatus(progress[w.id], now);
  const groupScope = lib.groupId ? [lib.groupId, ...subGroupsOf(lib.groupId).map((g) => g.id)] : null;
  const scoped = words.filter((w) => (!groupScope || groupScope.includes(w.groupId))
    && (!q || w.word.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q)) || (w.pos && w.pos.includes(q))));
  const statusCounts = { all: scoped.length, new: 0, learning: 0, review: 0, mastered: 0 };
  scoped.forEach((w) => { statusCounts[statusOf(w)]++; });
  const dueKey = (w) => {
    const p = progress[w.id];
    if (!p) return now + 1e12; // new: after everything scheduled
    if (p.box >= window.LW_MASTERED_BOX && p.due > now) return now + 2e12; // mastered and not due: last
    return p.due;
  };
  const filtered = scoped.filter((w) => lib.status === 'all' || statusOf(w) === lib.status).sort(
    lib.sort === 'az' ? (a, b) => a.word.localeCompare(b.word)
      : lib.sort === 'due' ? (a, b) => dueKey(a) - dueKey(b)
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.word.localeCompare(b.word));
  const mastered = words.filter((w) => statusOf(w) === 'mastered').length;
  const filtersOn = lib.status !== 'all' || !!lib.groupId || !!q;

  /* word of the day: chosen once per day and remembered, so it doesn't change while you study */
  const today = window.lwLocalDate(now);
  const wotd = useMemo(() => {
    const saved = window.lwLoad(LW_KEYS.wotd, null);
    const keep = saved && saved.date === today && words.find((w) => w.id === saved.wordId);
    if (keep) return keep;
    const w = window.lwWordOfTheDay(words, progress, today, now);
    if (w) window.lwSave(LW_KEYS.wotd, { date: today, wordId: w.id });
    return w;
    // eslint-disable-next-line
  }, [words, today]);

  /* tag parts of speech for words without one (only words this user may edit) */
  const untagged = words.filter((w) => !w.pos && canEdit(w));
  const tagPos = async () => {
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; }
    const todo = untagged.slice();
    setTagState({ busy: true, done: 0, error: null });
    try {
      for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50);
        const tags = await window.lwAiTagPos(batch.map((w) => w.word));
        const byWord = {};
        tags.forEach((t) => { byWord[t.word.toLowerCase()] = t.pos; });
        await Promise.all(batch.filter((w) => byWord[w.word.toLowerCase()])
          .map((w) => window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, pos: byWord[w.word.toLowerCase()] })));
        setTagState({ busy: true, done: Math.min(i + 50, todo.length), error: null });
      }
      setTagState({ busy: false, done: todo.length, error: null });
    } catch (e) {
      setTagState((t) => ({ ...t, busy: false, error: (e && e.code) || 'error' }));
    }
  };

  const saveWord = (w) => {
    // Существующее слово определяем по наличию в списке, а не по w.id — форма
    // всегда генерирует id, в т.ч. для новых слов, где userId/username ещё нет.
    const existing = words.find((x) => x.id === w.id);
    const shared = existing ? existing.shared : isAdmin;
    // legacy-документы могут не иметь userId/username — тогда назначаем владельцем
    // текущего пользователя, иначе слово выпадет из выборки where('userId','==',uid).
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, userId: (existing && existing.userId) || userId, username: (existing && existing.username) || username, shared })
      .catch((e) => { console.error('saveWord failed', e); alert('Could not save the word: ' + (e && e.message || e)); });
    setWordModal(null);
  };
  const saveGroup = (g) => {
    const existing = groups.find((x) => x.id === g.id);
    const shared = existing ? existing.shared : isAdmin;
    window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...g, userId: (existing && existing.userId) || userId, username: (existing && existing.username) || username, shared })
      .catch((e) => { console.error('saveGroup failed', e); alert('Could not save the group: ' + (e && e.message || e)); });
    if (!openGroups.includes(g.id)) setOpenGroups((o) => [...o, g.id]);
    if (g.parentId && !openGroups.includes(g.parentId)) setOpenGroups((o) => [...o, g.parentId]);
    setGroupModal(null);
  };
  const doDelete = () => {
    if (!confirm) return;
    let deletedWordIds = [];
    if (confirm.kind === 'word') {
      window.lwDeleteDoc(window.LW_COLLECTIONS.words, confirm.id);
      deletedWordIds = [confirm.id];
    }
    if (confirm.kind === 'group') {
      const ids = [confirm.id, ...subGroupsOf(confirm.id).map((sg) => sg.id)];
      ids.forEach((id) => {
        window.lwDeleteDoc(window.LW_COLLECTIONS.groups, id);
        window.lwDeleteWordsByGroup(id, isAdmin ? null : userId);
      });
      deletedWordIds = words.filter((w) => ids.includes(w.groupId)).map((w) => w.id);
    }
    /* drop this user's progress for the deleted words (others' progress on a
       deleted shared word is left as orphans that the app ignores) */
    const withProgress = deletedWordIds.filter((id) => progress[id]);
    if (withProgress.length) {
      window.lwDeleteProgressForWords(userId, withProgress)
        .catch((e) => console.error('delete progress failed', e));
    }
    setConfirm(null);
  };

  const groupLabel = (g) => {
    const parent = g.parentId ? groupById(g.parentId) : null;
    return parent ? parent.name + ' / ' + g.name : g.name;
  };
  const orderedGroups = topGroups.flatMap((g) => [g, ...subGroupsOf(g.id)]);
  const hasLeafGroup = window.lwLeafGroups(groups).length > 0;

  const renderWords = (items, hue, showEmptyHint = true, showGroup = false) => (
    <div className="word-rows">
      {items.length === 0 && showEmptyHint && <div className="row-empty">No words yet — add the first one.</div>}
      {items.map((w) => {
        const g = showGroup ? groupById(w.groupId) : null;
        return (
          <div className="wrow" key={w.id}>
            <div className="wrow-thumb">{w.photo ? <img className="card-photo-img" src={w.photo} alt="" /> : <PhotoFill word={w.word} hue={showGroup ? (g ? g.color : hue) : hue} />}</div>
            <div className="wrow-main">
              <div className="wrow-top"><span className="wrow-word">{w.word}</span><span className="wrow-ipa">{w.ipa}</span></div>
              <div className="wrow-tr">{w.tr}</div>
              {showGroup && g && <div className="wrow-group">{g.name}</div>}
            </div>
            {canEdit(w) && (
              <div className="wrow-tools">
                <button className="icon-btn sm" onClick={() => setWordModal({ mode: 'edit', initial: w })} aria-label="Edit"><Ic.Edit /></button>
                <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} aria-label="Delete"><Ic.Trash /></button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="library">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Library</h1>
          <p className="lib-sub">{words.length} words · {mastered} mastered · {topGroups.length} {topGroups.length === 1 ? 'group' : 'groups'}</p>
        </div>
        <div className="seg lib-views">
          <button type="button" className={'seg-btn' + (lib.view === 'words' ? ' on' : '')} onClick={() => setLibField('view', 'words')}>Words</button>
          <button type="button" className={'seg-btn' + (lib.view === 'groups' ? ' on' : '')} onClick={() => setLibField('view', 'groups')}>Groups</button>
          <button type="button" className={'seg-btn' + (lib.view === 'colloc' ? ' on' : '')} onClick={() => setLibField('view', 'colloc')}>Collocations</button>
        </div>
      </div>
      <div className="lib-head">
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder={lib.view === 'colloc' ? 'Search collocations…' : 'Search words or translations…'}
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(LW_LIB_PAGE); }} />
        </div>
        <div className="lib-head-actions">
          {lib.view !== 'colloc' && <button className="btn btn-soft" onClick={goImport}><Ic.Plus /> Import</button>}
          {lib.view === 'colloc' ? (
            <button className="btn btn-primary lib-add-word" onClick={() => setCollocForm({})}><Ic.Plus /> New collocation</button>
          ) : lib.view === 'groups' ? (
            <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
          ) : hasLeafGroup && (
            <button className="btn btn-primary lib-add-word" onClick={() => setWordModal({ mode: 'new' })}><Ic.Plus /> Add word</button>
          )}
        </div>
      </div>

      {lib.view === 'colloc' ? (
        <CollocCatalog entries={collocations} wordsById={wordsById} userId={userId} query={q}
          owner={lib.collocOwner} sort={lib.collocSort} setLibField={setLibField} limit={limit} setLimit={setLimit}
          onOpen={(e) => setCollocOpen(e.id)} onNew={() => setCollocForm({})} />
      ) : lib.view === 'words' ? (
        <div className="words-pane">
          {wotd && !filtersOn && <WordOfTheDay word={wotd} onPractice={() => setPractice(wotd)} />}

          <div className="lib-filters">
            <div className="status-chips">
              {LW_LIB_STATUSES.map((st) => (
                <button key={st} type="button" className={'chip' + (lib.status === st ? ' chip-on' : '')}
                  onClick={() => setLibField('status', st)}>
                  {st === 'all' ? 'All' : LW_STATUS_LABEL[st]} <span className="chip-count">{statusCounts[st]}</span>
                </button>
              ))}
            </div>
            <div className="lib-selects">
              <select className="input input-sm" value={lib.groupId} onChange={(e) => setLibField('groupId', e.target.value)} aria-label="Group">
                <option value="">All groups</option>
                {orderedGroups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
              </select>
              <select className="input input-sm" value={lib.sort} onChange={(e) => setLibField('sort', e.target.value)} aria-label="Sort">
                {LW_LIB_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {untagged.length > 0 && (
            <div className="tag-pos">
              <span>{tagState.busy ? 'Tagging parts of speech… ' + tagState.done + ' / ' + untagged.length
                : untagged.length + (untagged.length === 1 ? ' word has' : ' words have') + ' no part of speech.'}</span>
              <button type="button" className="btn btn-soft sm" disabled={tagState.busy} onClick={tagPos}>
                {tagState.busy ? <span className="spinner" /> : <Ic.Bulb width="15" height="15" />} Tag with AI
              </button>
              {tagState.error && <span className="tag-pos-error">{LW_IMPORT_ERROR_MSG[tagState.error] || LW_IMPORT_ERROR_MSG.error}</span>}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-card lib-empty">
              <Ic.Search width="26" height="26" />
              <p className="empty-title">{words.length === 0 ? 'No words yet' : 'No words match'}</p>
              <p className="empty-sub">{words.length === 0 ? 'Add your first word or import a list.' : 'Try another filter or search.'}</p>
              {words.length === 0 ? (
                <button className="btn btn-primary" onClick={goImport}><Ic.Plus /> Import words</button>
              ) : (
                <button className="btn btn-soft" onClick={() => { setQuery(''); setLib((l) => ({ ...l, status: 'all', groupId: '' })); }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="wcards">
              {filtered.slice(0, limit).map((w) => (
                <WordCard key={w.id} word={w} group={groupById(w.groupId)} prog={progress[w.id]} now={now}
                  clip={clipByWord[w.id]} onClip={() => setClipOpen(clipByWord[w.id])}
                  canEdit={canEdit(w)} onEdit={() => setWordModal({ mode: 'edit', initial: w })}
                  onDelete={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} />
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <button type="button" className="btn btn-soft lib-more" onClick={() => setLimit((n) => n + LW_LIB_PAGE)}>
              Show more ({filtered.length - limit})
            </button>
          )}
          {hasLeafGroup && (
            <button type="button" className="fab" onClick={() => setWordModal({ mode: 'new' })} aria-label="Add word"><Ic.Plus width="24" height="24" /></button>
          )}
        </div>
      ) : searchResults ? (
        <div className="search-results">
          {searchResults.length === 0
            ? <div className="row-empty">No words match "{query.trim()}".</div>
            : renderWords(searchResults, null, false, true)}
        </div>
      ) : (
      <div className="groups-list">
        {topGroups.map((g) => {
          const items = words.filter((w) => w.groupId === g.id);
          const subGroups = subGroupsOf(g.id);
          const subWordCount = subGroups.reduce((sum, sg) => sum + words.filter((w) => w.groupId === sg.id).length, 0);
          const open = openGroups.includes(g.id);
          return (
            <section className="grp" key={g.id}>
              <header className="grp-head">
                <button className="grp-toggle" onClick={() => toggleOpen(g.id)}>
                  <Ic.Chevron style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                  <span className="grp-dot" style={{ background: g.color }} />
                  <span className="grp-name">{g.name}</span>
                  <span className="grp-count">{items.length + subWordCount}</span>
                </button>
                <div className="grp-tools">
                  <ActionsMenu items={[
                    ...(subGroups.length === 0 ? [
                      { label: 'Word', icon: <Ic.Plus width="15" height="15" />, onClick: () => setWordModal({ mode: 'new', groupId: g.id }) },
                    ] : []),
                    ...(items.length === 0 ? [
                      { label: 'Subgroup', icon: <Ic.Plus width="15" height="15" />, onClick: () => setGroupModal({ mode: 'new', parentGroup: g }) },
                    ] : []),
                    ...(canEdit(g) ? [
                      { label: 'Edit group', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: g }) },
                      { label: 'Delete group', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: g.id, label: g.name }) },
                    ] : []),
                  ]} />
                </div>
              </header>
              {open && (
                <div className="grp-body">
                  {renderWords(items, g.color, subGroups.length === 0)}
                  {subGroups.map((sg) => {
                    const subItems = words.filter((w) => w.groupId === sg.id);
                    const subOpen = openGroups.includes(sg.id);
                    return (
                      <section className="grp grp-sub" key={sg.id}>
                        <header className="grp-head">
                          <button className="grp-toggle" onClick={() => toggleOpen(sg.id)}>
                            <Ic.Chevron style={{ transform: subOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                            <span className="grp-dot" style={{ background: sg.color }} />
                            <span className="grp-name">{sg.name}</span>
                            <span className="grp-count">{subItems.length}</span>
                          </button>
                          <div className="grp-tools">
                            <ActionsMenu items={[
                              { label: 'Word', icon: <Ic.Plus width="15" height="15" />, onClick: () => setWordModal({ mode: 'new', groupId: sg.id }) },
                              ...(canEdit(sg) ? [
                                { label: 'Edit subgroup', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: sg }) },
                                { label: 'Delete subgroup', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: sg.id, label: sg.name }) },
                              ] : []),
                            ]} />
                          </div>
                        </header>
                        {subOpen && renderWords(subItems, sg.color)}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      )}

      {collocOpen && collocations.some((e) => e.id === collocOpen) && (() => {
        const entry = collocations.find((e) => e.id === collocOpen);
        return (
          <CollocSheet entry={entry} wordsById={wordsById} canEdit={canEditColloc(entry)}
            onEdit={() => { setCollocOpen(null); setCollocForm({ initial: entry }); }}
            onDelete={() => { setCollocOpen(null); setCollocDelete(entry); }}
            onClose={() => setCollocOpen(null)} />
        );
      })()}
      {collocForm && (
        <Modal title={collocForm.initial ? 'Edit collocation' : 'New collocation'} onClose={() => setCollocForm(null)}>
          <CollocForm initial={collocForm.initial} words={words} entries={collocations} isAdmin={isAdmin} userId={userId}
            onSave={submitColloc} onCancel={() => setCollocForm(null)}
            onOpenExisting={(e) => { setCollocForm(null); setCollocOpen(e.id); }} />
        </Modal>
      )}
      {collocDelete && (
        <Modal title="Delete collocation" onClose={() => setCollocDelete(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setCollocDelete(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const e = collocDelete;
              setCollocDelete(null);
              window.lwDeleteDoc(window.LW_COLLECTIONS.collocations, e.id)
                .catch((err) => pushToast({ kind: 'error', title: 'Could not delete', msg: (err && err.message) || String(err) }));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete collocations for <strong>{collocDelete.word}</strong>{collocDelete.shared ? ' for everyone' : ''}? The phrase cards stay in your words.</p>
        </Modal>
      )}
      {clipOpen && <ClipModal clip={clipOpen} onClose={() => setClipOpen(null)} />}
      {practice && (
        <PracticeCardModal word={practice} group={groupById(practice.groupId)} prog={progress[practice.id]}
          direction={direction} recordAnswer={recordAnswer} onClose={() => setPractice(null)} />
      )}
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(false)} onSaved={(ok) => { if (ok) tagPos(); }} />}
      {wordModal && (
        <Modal title={wordModal.mode === 'edit' ? 'Edit word' : 'New word'} onClose={() => setWordModal(null)}>
          <WordForm initial={wordModal.initial} groups={groups} defaultGroupId={wordModal.groupId}
            onSave={saveWord} onCancel={() => setWordModal(null)} />
        </Modal>
      )}
      {groupModal && (
        <Modal title={groupModal.mode === 'edit' ? 'Edit group' : (groupModal.parentGroup ? 'New subgroup' : 'New group')} onClose={() => setGroupModal(null)}>
          <GroupForm initial={groupModal.initial} parentGroup={groupModal.parentGroup} onSave={saveGroup} onCancel={() => setGroupModal(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title={'Delete ' + confirm.kind} onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={doDelete}>Delete</button>
          </>}>
          <p className="confirm-text">
            Delete <strong>{confirm.label}</strong>{confirm.kind === 'group' ? ' and all its words' : ''}? This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Grammar: lesson list, lesson, test, editor ---------------- */
const LW_LESSON_STATUS = {
  locked: { label: 'Locked' },
  new: { label: 'New' },
  studied: { label: 'Studied' },
  completed: { label: 'Completed' },
};

function GrammarScreen({ nav, setGrammar, lessons, progressBy, isAdmin, userLevel, recordAnswer,
  saveLesson, moveLesson, saveProgress, finishTest, deleteLesson }) {
  const topics = useMemo(() => window.lwLessonTopics(lessons), [lessons]);
  const [attempt, setAttempt] = useState(0); // bumps on "Retake test" to restart the quiz
  const topicOf = (l) => topics.find((t) => t.lessons.some((x) => x.id === l.id)) || { lessons: [l] };
  const statusOf = (l) => window.lwLessonStatus(l, topicOf(l).lessons, progressBy, isAdmin);
  const lesson = nav.lessonId && lessons.find((l) => l.id === nav.lessonId);
  const home = () => setGrammar({ view: 'home' });
  /* a locked lesson (e.g. a saved link) sends the user back to the list */
  const blocked = !!lesson && nav.view !== 'edit' && statusOf(lesson) === 'locked';
  useEffect(() => { if (blocked) home(); }, [blocked]); // eslint-disable-line

  if (nav.view === 'edit' && isAdmin) {
    return (
      <div className="grammar">
        <div className="ls-back-row">
          <button type="button" className="btn btn-ghost sm" onClick={() => (lesson ? setGrammar({ view: 'lesson', lessonId: lesson.id }) : home())}>
            <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Back
          </button>
        </div>
        <h1 className="lib-title">{lesson ? 'Edit lesson' : 'New lesson'}</h1>
        <div className="ls-editor">
          <LessonForm key={lesson ? lesson.id : 'new'} initial={lesson || null} topics={topics.map((t) => t.topic)}
            onSave={saveLesson} onCancel={() => (lesson ? setGrammar({ view: 'lesson', lessonId: lesson.id }) : home())}
            onDelete={lesson ? () => { if (window.confirm('Delete “' + lesson.title + '”? This can\'t be undone.')) deleteLesson(lesson); } : null} />
        </div>
      </div>
    );
  }
  if (lesson && !blocked && (nav.view === 'lesson' || nav.view === 'quiz')) {
    const status = statusOf(lesson);
    const list = topicOf(lesson).lessons;
    const next = list[list.findIndex((l) => l.id === lesson.id) + 1] || null;
    if (nav.view === 'quiz') {
      return (
        <LessonQuiz key={lesson.id + ':' + attempt} lesson={lesson} recordAnswer={recordAnswer}
          finishTest={(score) => finishTest(lesson.id, score)} next={next} onRetake={() => setAttempt((a) => a + 1)}
          onReview={() => setGrammar({ view: 'lesson', lessonId: lesson.id })}
          onNext={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onHome={home} />
      );
    }
    return (
      <LessonView lesson={lesson} prog={progressBy[lesson.id] || {}} status={status} isAdmin={isAdmin}
        position={list.findIndex((l) => l.id === lesson.id) + 1} total={list.length}
        onBack={home} onEdit={() => setGrammar({ view: 'edit', lessonId: lesson.id })}
        onToggleSave={() => saveProgress(lesson.id, { saved: !(progressBy[lesson.id] || {}).saved })}
        onPublish={(pub) => saveLesson({ ...lesson }, pub)}
        onStartTest={() => {
          if (!(progressBy[lesson.id] || {}).studiedAt) saveProgress(lesson.id, { studiedAt: Date.now() });
          setGrammar({ view: 'quiz', lessonId: lesson.id });
        }} />
    );
  }
  return (
    <GrammarHome topics={topics} progressBy={progressBy} isAdmin={isAdmin} userLevel={userLevel} statusOf={statusOf}
      onOpen={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onNew={() => setGrammar({ view: 'edit' })}
      onMove={moveLesson} onToggleSave={(l) => saveProgress(l.id, { saved: !(progressBy[l.id] || {}).saved })} />
  );
}

function GrammarHome({ topics, progressBy, isAdmin, userLevel, statusOf, onOpen, onNew, onMove, onToggleSave }) {
  const [f, setF] = useState(() => ({ level: 'all', saved: false, ...(window.lwLoad(LW_KEYS.grammar, null) || {}) }));
  useEffect(() => { window.lwSave(LW_KEYS.grammar, f); }, [f]);
  const levels = [...new Set(topics.flatMap((t) => t.lessons.map((l) => l.level)).filter(Boolean))].sort();
  const all = topics.flatMap((t) => t.lessons);
  const done = all.filter((l) => statusOf(l) === 'completed').length;
  const show = (l) => (f.level === 'all' || l.level === f.level) && (!f.saved || (progressBy[l.id] || {}).saved);

  return (
    <div className="grammar">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Grammar</h1>
          <p className="lib-sub">{all.length} {all.length === 1 ? 'lesson' : 'lessons'} · {done} completed{userLevel ? ' · your level ' + userLevel : ''}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New lesson</button>}
      </div>

      {all.length > 0 && (
        <div className="status-chips gr-filters">
          <button type="button" className={'chip' + (f.level === 'all' && !f.saved ? ' chip-on' : '')} onClick={() => setF({ level: 'all', saved: false })}>All</button>
          {levels.map((lv) => (
            <button key={lv} type="button" className={'chip' + (f.level === lv ? ' chip-on' : '')}
              onClick={() => setF((x) => ({ ...x, level: x.level === lv ? 'all' : lv }))}>{lv}</button>
          ))}
          <button type="button" className={'chip' + (f.saved ? ' chip-on' : '')} onClick={() => setF((x) => ({ ...x, saved: !x.saved }))}>
            <Ic.Bookmark width="14" height="14" /> Saved
          </button>
        </div>
      )}

      {all.length === 0 && (
        <div className="empty-card lib-empty">
          <Ic.Grammar width="28" height="28" />
          <p className="empty-title">No lessons yet</p>
          <p className="empty-sub">{isAdmin ? 'Create the first lesson — by hand or with AI.' : 'Lessons will appear here soon.'}</p>
          {isAdmin && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New lesson</button>}
        </div>
      )}

      {topics.map((t) => {
        const visible = t.lessons.filter(show);
        if (!visible.length) return null;
        const doneN = t.lessons.filter((l) => statusOf(l) === 'completed').length;
        const pct = Math.round((doneN / t.lessons.length) * 100);
        return (
          <section className="gr-topic" key={t.topic}>
            <div className="gr-topic-head">
              <h2 className="gr-topic-title">{t.topic}</h2>
              <span className="gr-topic-count">Completed {doneN} of {t.lessons.length}</span>
            </div>
            <div className="goal-track gr-topic-track"><div className="goal-fill" style={{ width: pct + '%' }} /></div>
            <div className="gr-list">
              {visible.map((l) => {
                const st = statusOf(l);
                const p = progressBy[l.id] || {};
                const i = t.lessons.indexOf(l);
                const prev = i > 0 ? t.lessons[i - 1] : null;
                return (
                  <div className={'gr-item gr-' + st} key={l.id}>
                    <button type="button" className="gr-item-main" disabled={st === 'locked'} onClick={() => onOpen(l)}
                      title={st === 'locked' && prev ? 'Complete “' + prev.title + '” first' : undefined}>
                      <span className="gr-num">{st === 'completed' ? <Ic.Check width="16" height="16" /> : st === 'locked' ? <Ic.Lock width="15" height="15" /> : i + 1}</span>
                      <span className="gr-item-text">
                        <span className="gr-item-title">{l.title}</span>
                        <span className="gr-item-meta">
                          {l.level && <span className="gr-level">{l.level}</span>}
                          <span>{l.minutes || 10} min</span>
                          <span>{(l.quiz || []).length} tasks</span>
                          {p.best != null && <span>Best {p.best}/{window.LW_LESSON_TASKS}</span>}
                          {isAdmin && !l.published && <span className="gr-draft">Draft</span>}
                        </span>
                        {st === 'locked' && prev && <span className="gr-lock-hint">Complete “{prev.title}” first</span>}
                      </span>
                      <span className={'gr-status gr-status-' + st}>{LW_LESSON_STATUS[st].label}</span>
                    </button>
                    <div className="gr-item-tools">
                      {st !== 'locked' && (
                        <button type="button" className={'icon-btn sm' + (p.saved ? ' on' : '')} aria-label={p.saved ? 'Remove bookmark' : 'Save lesson'}
                          aria-pressed={!!p.saved} onClick={() => onToggleSave(l)}><Ic.Bookmark width="16" height="16" /></button>
                      )}
                      {isAdmin && f.level === 'all' && !f.saved && (
                        <>
                          <button type="button" className="icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => onMove(t.lessons, i, -1)}><Ic.ArrowUp width="16" height="16" /></button>
                          <button type="button" className="icon-btn sm" aria-label="Move down" disabled={i === t.lessons.length - 1} onClick={() => onMove(t.lessons, i, 1)}><Ic.ArrowDown width="16" height="16" /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonView({ lesson, prog, status, isAdmin, position, total, onBack, onEdit, onToggleSave, onPublish, onStartTest }) {
  useEffect(() => { window.scrollTo(0, 0); }, [lesson.id]);
  return (
    <div className="grammar lesson">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}>
          <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> {lesson.topic || 'Grammar'}
        </button>
        <span className="ls-pos">Lesson {position} of {total}</span>
      </div>
      <div className="ls-head">
        <div className="ls-badges">
          {lesson.level && <span className="ls-badge ls-badge-level">{lesson.level}</span>}
          <span className="ls-badge"><Ic.Clock width="14" height="14" /> {lesson.minutes || 10} min</span>
          <span className="ls-badge">{window.LW_LESSON_TASKS} tasks</span>
          {isAdmin && !lesson.published && <span className="ls-badge gr-draft">Draft</span>}
          <button type="button" className={'icon-btn sm ls-save' + (prog.saved ? ' on' : '')} aria-pressed={!!prog.saved}
            aria-label={prog.saved ? 'Remove bookmark' : 'Save lesson'} onClick={onToggleSave}><Ic.Bookmark width="17" height="17" /></button>
        </div>
        <h1 className="ls-title">{lesson.title}</h1>
        {status === 'completed' && <p className="ls-done"><Ic.Check width="16" height="16" /> Completed · best {prog.best}/{window.LW_LESSON_TASKS}</p>}
        {isAdmin && (
          <div className="ls-admin">
            <button type="button" className="btn btn-soft sm" onClick={onEdit}><Ic.Edit width="15" height="15" /> Edit</button>
            <button type="button" className="btn btn-soft sm" onClick={() => onPublish(!lesson.published)}>{lesson.published ? 'Unpublish' : 'Publish'}</button>
          </div>
        )}
      </div>

      <LessonBody lesson={lesson} />

      <section className="ls-cta">
        <span className="ls-cta-icon"><Ic.ListCheck width="24" height="24" /></span>
        <h3 className="ls-cta-title">{status === 'completed' ? 'Lesson completed' : 'Ready to test yourself?'}</h3>
        <p className="ls-cta-sub">
          {status === 'completed'
            ? 'You can retake the test any time to refresh the rule.'
            : 'Answer all ' + window.LW_LESSON_TASKS + ' tasks correctly to complete the lesson' + (position < total ? ' and unlock the next one.' : '.')}
        </p>
        <button type="button" className="btn btn-primary ls-cta-btn" onClick={onStartTest}>
          {status === 'completed' ? 'Retake test' : status === 'studied' ? 'Start test' : "I've studied this — start test"} <Ic.Arrow width="16" height="16" />
        </button>
        {prog.attempts > 0 && status !== 'completed' && <p className="ls-cta-note">Last attempt: {prog.last}/{window.LW_LESSON_TASKS}</p>}
      </section>
    </div>
  );
}

/* The test: tasks and options shuffled per attempt; feedback after each answer;
   10/10 completes the lesson. Every answer counts toward XP and the daily goal. */
function LessonQuiz({ lesson, recordAnswer, finishTest, next, onRetake, onReview, onNext, onHome }) {
  const [tasks] = useState(() => shuffle(lesson.quiz || []).map((t) => {
    if (t.type !== 'choice') return t;
    const order = shuffle([0, 1, 2, 3]);
    return { ...t, options: order.map((i) => t.options[i]), answer: order.indexOf(t.answer) };
  }));
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState(null); // choice index or typed text, once answered
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState([]); // { task, given, ok }
  const [finished, setFinished] = useState(null); // { score, firstPass }
  const inputRef = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); if (inputRef.current) inputRef.current.focus(); }, [idx]);

  const task = tasks[idx];
  const answer = (value) => {
    if (given != null || !task) return;
    const ok = task.type === 'choice' ? value === task.answer : window.lwCheckFill(value, task.answers);
    if (task.type === 'fill' && !String(value).trim()) return;
    setGiven(value);
    setResults((r) => [...r, { task, given: value, ok }]);
    recordAnswer(null, ok, 'lesson');
  };
  const goNext = () => {
    if (idx + 1 < tasks.length) { setIdx(idx + 1); setGiven(null); setTyped(''); return; }
    const score = results.filter((r) => r.ok).length;
    setFinished({ score, firstPass: finishTest(score) });
  };

  if (finished) {
    const passed = finished.score >= window.LW_LESSON_TASKS;
    const wrong = results.filter((r) => !r.ok);
    return (
      <div className="grammar quiz">
        <div className={'quiz-result' + (passed ? ' pass' : ' fail')}>
          <span className="quiz-result-icon">{passed ? <Ic.DoubleCheck width="30" height="30" /> : <Ic.Repeat width="28" height="28" />}</span>
          <p className="quiz-score">{finished.score}/{tasks.length}</p>
          <h2 className="quiz-result-title">{passed ? 'Lesson completed!' : 'Not passed yet'}</h2>
          <p className="quiz-result-sub">
            {passed
              ? (finished.firstPass ? '+' + window.LW_XP_LESSON_BONUS + ' XP bonus. ' : '') + (next ? 'The next lesson is unlocked.' : 'You finished this topic.')
              : 'You need ' + tasks.length + ' of ' + tasks.length + ' to complete the lesson. Review the mistakes and try again.'}
          </p>
          <div className="quiz-result-btns">
            {passed ? (
              <>
                <button className="btn btn-soft" onClick={onHome}>All lessons</button>
                {next && <button className="btn btn-primary" onClick={() => onNext(next)}>Next lesson <Ic.Arrow width="16" height="16" /></button>}
              </>
            ) : (
              <>
                <button className="btn btn-soft" onClick={onReview}>Review lesson</button>
                <button className="btn btn-primary" onClick={onRetake}>Retake test</button>
              </>
            )}
          </div>
        </div>
        {wrong.length > 0 && (
          <section className="quiz-mistakes">
            <h3 className="csheet-h">Your mistakes</h3>
            {wrong.map((r, i) => (
              <div className="ls-card quiz-mistake" key={i}>
                <p className="quiz-q">{r.task.q}</p>
                <p className="quiz-your"><Ic.Close width="14" height="14" /> {r.task.type === 'choice' ? r.task.options[r.given] : r.given}</p>
                <p className="quiz-right"><Ic.Check width="14" height="14" /> {r.task.type === 'choice' ? r.task.options[r.task.answer] : r.task.answers[0]}</p>
                {r.task.why && <p className="quiz-why">{r.task.why}</p>}
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }
  if (!task) return null;

  const ok = given != null && (results[results.length - 1] || {}).ok;
  const right = task.type === 'choice' ? task.options[task.answer] : task.answers[0];
  return (
    <div className="grammar quiz">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onReview}>
          <Ic.Close width="15" height="15" /> Quit test
        </button>
        <span className="ls-pos">{lesson.title}</span>
      </div>
      <div className="colloc-head">
        <span className="colloc-kicker">Task {idx + 1} of {tasks.length}</span>
        <span className="colloc-count">{results.filter((r) => r.ok).length} correct</span>
      </div>
      <div className="colloc-segs">
        {tasks.map((_, i) => {
          const r = results[i];
          return <span key={i} className={'colloc-seg' + (r ? (r.ok ? ' on' : ' bad') : i === idx ? ' cur' : '')} />;
        })}
      </div>
      <div className="ls-card quiz-card">
        <p className="quiz-type">{task.type === 'choice' ? 'Choose the right option' : 'Fill in the gap'}</p>
        <p className="quiz-q quiz-q-big">{task.q}</p>
        {task.type === 'choice' ? (
          <div className="quiz-options">
            {task.options.map((o, i) => {
              const cls = given == null ? '' : i === task.answer ? ' right' : i === given ? ' wrong' : ' dim';
              return (
                <button key={i} type="button" className={'quiz-option' + cls} disabled={given != null} onClick={() => answer(i)}>
                  <span className="quiz-letter">{'ABCD'[i]}</span>{o}
                </button>
              );
            })}
          </div>
        ) : (
          <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); answer(typed); }}>
            <input ref={inputRef} className={'input quiz-input' + (given == null ? '' : ok ? ' right' : ' wrong')} value={typed}
              disabled={given != null} placeholder="Type your answer" autoComplete="off" autoCapitalize="off" spellCheck="false"
              onChange={(e) => setTyped(e.target.value)} />
            {given == null && <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Check</button>}
          </form>
        )}
        {given != null && (
          <div className={'quiz-feedback' + (ok ? ' ok' : ' bad')} role="status">
            <p className="quiz-feedback-title">{ok ? 'Correct!' : 'Not quite — the answer is “' + right + '”'}</p>
            {task.why && <p className="quiz-why">{task.why}</p>}
          </div>
        )}
      </div>
      {given != null && (
        <button type="button" className="btn btn-primary quiz-next" onClick={goNext} autoFocus>
          {idx + 1 < tasks.length ? 'Next' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </div>
  );
}

/* ---------------- Video clips: Learn → Video, admin editor, Library clip window ---------------- */
const LW_VIDEO_SESSION = 10;
const LW_VIDEO_RATES = [1, 0.75, 0.5];

/* the quote as a subtitle: the word or phrase highlighted, or hidden */
function ClipQuote({ clip, masked, plain }) {
  const q = window.lwSplitQuote(clip.quote);
  return (
    <span className={plain ? 'clip-quote' : 'yt-sub'}>
      “{q.before}{masked ? <span className="clip-gap">___</span> : <mark>{q.target}</mark>}{q.after}”
    </span>
  );
}

/* a typed answer matches the phrase said in the clip or its dictionary form,
   word by word, any form of each word (got the hang of it = get the hang of it) */
function lwVideoAnswerOk(input, clip) {
  const toks = (x) => String(x || '').toLowerCase().replace(/[’]/g, "'").match(/[\p{L}\p{N}']+/gu) || [];
  const got = toks(input);
  if (!got.length) return false;
  return [window.lwSplitQuote(clip.quote).target, clip.word].some((t) => {
    const want = toks(t);
    return want.length === got.length && want.every((w, i) => w === got[i] || window.readingTokensMatch(w, got[i]));
  });
}
const lwPlainQuote = (q) => String(q || '').replace(/\[\[|\]\]/g, '');

function VideoView({ clips, words, progress, now, online, recordAnswer, addWord, isAdmin, uid, lang, pushToast }) {
  const [manage, setManage] = useState(false);
  const [mode, setMode] = useState(() => (window.lwLoad(LW_KEYS.videoMode, 'flip') === 'type' ? 'type' : 'flip'));
  useEffect(() => { window.lwSave(LW_KEYS.videoMode, mode); }, [mode]);
  const [rate, setRate] = useState(1);
  const [broken, setBroken] = useState([]); // clips whose video failed to load this session
  const [session, setSession] = useState(null); // { ids, idx, done, stats: { right, wrong, xp } }
  const blank = { flipped: false, hint: false, typed: '', answered: null, added: false };
  const [st, setSt] = useState(blank); // the current clip's card state
  const apiRef = useRef(null);
  const cardOf = (c) => window.lwFindCardForClip(c, words);
  const playable = clips.filter((c) => !broken.includes(c.id));

  const start = (exclude = []) => {
    const ids = window.lwClipPick(playable, cardOf, progress, Date.now(), LW_VIDEO_SESSION, exclude).map((c) => c.id);
    setSession(ids.length ? { ids, idx: 0, done: false, stats: { right: 0, wrong: 0, xp: 0 } } : null);
    setSt(blank);
  };
  useEffect(() => { if (!session && playable.length) start(); }, [playable.length]); // eslint-disable-line

  const clip = session && !session.done ? clips.find((c) => c.id === session.ids[session.idx]) : null;
  const next = () => {
    setSt(blank);
    setSession((s) => {
      let idx = s.idx + 1;
      while (idx < s.ids.length && !clips.some((c) => c.id === s.ids[idx] && !broken.includes(c.id))) idx++;
      return idx >= s.ids.length ? { ...s, idx, done: true } : { ...s, idx };
    });
  };
  /* the clip was deleted meanwhile */
  useEffect(() => { if (session && !session.done && !clip) next(); }); // eslint-disable-line

  if (manage && isAdmin) return <ClipsAdmin clips={clips} lang={lang} uid={uid} pushToast={pushToast} onBack={() => setManage(false)} />;

  const adminBtn = isAdmin && (
    <button type="button" className="btn btn-soft sm" onClick={() => setManage(true)}><Ic.Edit width="15" height="15" /> Manage clips ({clips.length})</button>
  );
  if (!online) {
    return (
      <div className="empty-card video-empty">
        <Ic.CloudOff width="28" height="28" />
        <p className="empty-title">You're offline</p>
        <p className="empty-sub">Video clips need an internet connection.</p>
      </div>
    );
  }
  if (!clips.length) {
    return (
      <div className="empty-card video-empty">
        <Ic.Play width="28" height="28" />
        <p className="empty-title">No video clips yet</p>
        <p className="empty-sub">{isAdmin ? 'Add clips from YouTube: a short fragment and the phrase said in it.' : 'Clips will appear here soon.'}</p>
        {adminBtn}
      </div>
    );
  }
  if (session && session.done) {
    const x = session.stats;
    return (
      <div className="colloc-done empty-card">
        <Ic.DoubleCheck width="30" height="30" />
        <p className="empty-title">Session complete</p>
        <div className="colloc-done-stats">
          <span><strong>{x.right}</strong> known</span>
          <span><strong>{x.wrong}</strong> to repeat</span>
          <span><strong>+{x.xp}</strong> XP</span>
        </div>
        <div className="colloc-done-btns">
          <button className="btn btn-primary" onClick={() => start(session.ids)}>Next {LW_VIDEO_SESSION} clips</button>
        </div>
        {adminBtn}
      </div>
    );
  }
  if (!clip) return null;

  const card = cardOf(clip);
  const q = window.lwSplitQuote(clip.quote);
  const answer = (known) => {
    recordAnswer(card ? card.id : null, known, 'video'); // no card: XP and the daily goal only
    setSession((s) => ({ ...s, stats: { ...s.stats, right: s.stats.right + (known ? 1 : 0), wrong: s.stats.wrong + (known ? 0 : 1),
      xp: s.stats.xp + (known ? window.LW_XP_CORRECT : window.LW_XP_WRONG) } }));
    if (card && mode === 'flip') next();
    else setSt((x) => ({ ...x, answered: known ? 'known' : 'unknown', flipped: true }));
  };
  const check = () => { if (st.typed.trim()) answer(lwVideoAnswerOk(st.typed, clip)); };
  const add = () => {
    addWord({ word: clip.word, tr: clip.wordTr || '', ipa: clip.ipa || '', pos: clip.pos || '', example: lwPlainQuote(clip.quote), exampleTr: clip.quoteTr || '' })
      .then(() => setSt((x) => ({ ...x, added: true })))
      .catch((e) => pushToast({ kind: 'error', title: 'Could not add the card', msg: (e && e.message) || String(e) }));
  };
  const revealed = st.flipped || st.answered;

  return (
    <div className="video">
      <div className="colloc-head">
        <span className="colloc-kicker"><Ic.Play width="14" height="14" /> Clip {session.idx + 1} / {session.ids.length}</span>
        <div className="seg video-mode">
          <button type="button" className={'seg-btn' + (mode === 'flip' ? ' on' : '')} onClick={() => { setMode('flip'); setSt(blank); }}>Flip</button>
          <button type="button" className={'seg-btn' + (mode === 'type' ? ' on' : '')} onClick={() => { setMode('type'); setSt(blank); }}>Type</button>
        </div>
      </div>
      <div className="colloc-segs">
        {session.ids.map((id, i) => <span key={id} className={'colloc-seg' + (i < session.idx ? ' on' : i === session.idx ? ' cur' : '')} />)}
      </div>

      <YouTubeClip key={clip.id} videoId={clip.videoId} start={clip.start} end={clip.end} rate={rate} apiRef={apiRef}
        overlay={revealed ? <ClipQuote clip={clip} /> : null}
        onError={() => setBroken((b) => (b.includes(clip.id) ? b : [...b, clip.id]))} />

      <div className="video-tools">
        <button type="button" className="btn btn-soft sm" onClick={() => apiRef.current && apiRef.current.replay()}><Ic.Repeat width="15" height="15" /> Replay</button>
        <div className="seg">
          {LW_VIDEO_RATES.map((r) => (
            <button key={r} type="button" className={'seg-btn' + (rate === r ? ' on' : '')} onClick={() => setRate(r)}>{r}×</button>
          ))}
        </div>
        {!revealed && <span className="video-masked"><Ic.Close width="13" height="13" /> Subtitles hidden</span>}
        {broken.includes(clip.id) && <button type="button" className="btn btn-primary sm" onClick={next}>Skip</button>}
      </div>

      <section className="ls-card video-card">
        <p className="quiz-type">{clip.scene ? clip.scene + ' · ' : ''}{clip.pos || (/\s/.test(clip.word) ? 'phrase' : 'word')}</p>
        {mode === 'flip' ? (
          <>
            <h2 className="video-word">{clip.word}</h2>
            {clip.ipa && <p className="video-ipa">/{clip.ipa}/</p>}
            {!revealed ? (
              st.hint ? (
                <p className="video-quote"><ClipQuote clip={clip} masked plain /></p>
              ) : (
                <div className="video-mask">
                  <span className="video-dots">[ • • • • • • • • • • ]</span>
                  <span className="video-mask-sub">Listen to the clip — what is said around it?</span>
                  <button type="button" className="btn btn-ghost sm" onClick={() => setSt((x) => ({ ...x, hint: true }))}><Ic.Bulb width="15" height="15" /> Show hint</button>
                </div>
              )
            ) : (
              <>
                <p className="video-tr">{clip.wordTr}</p>
                <SpeakButton word={clip.word} />
                <div className="video-quote-box">
                  <ClipQuote clip={clip} plain />
                  {clip.quoteTr && <span className="video-quote-tr">{clip.quoteTr}</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="video-tr video-tr-hint">{clip.wordTr}</p>
            <p className="video-quote"><ClipQuote clip={clip} masked={!st.answered} plain /></p>
            {!st.answered ? (
              <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); check(); }}>
                <input className="input quiz-input" value={st.typed} placeholder="Type the missing words" autoComplete="off" autoCapitalize="off" spellCheck="false"
                  onChange={(e) => setSt((x) => ({ ...x, typed: e.target.value }))} />
                <button type="submit" className="btn btn-primary" disabled={!st.typed.trim()}>Check</button>
              </form>
            ) : (
              <div className={'quiz-feedback' + (st.answered === 'known' ? ' ok' : ' bad')} role="status">
                <p className="quiz-feedback-title">{st.answered === 'known' ? 'Correct!' : 'Not quite — it is “' + q.target + '”'}</p>
                {clip.quoteTr && <p className="quiz-why">{clip.quoteTr}</p>}
              </div>
            )}
          </>
        )}
      </section>

      {mode === 'flip' && !st.flipped && (
        <div className="colloc-btns">
          <button type="button" className="btn btn-soft" onClick={() => apiRef.current && apiRef.current.replay()}><Ic.Repeat width="16" height="16" /> Replay</button>
          <button type="button" className="btn btn-primary" onClick={() => setSt((x) => ({ ...x, flipped: true }))}>Flip card <Ic.Arrow width="16" height="16" /></button>
        </div>
      )}
      {mode === 'flip' && st.flipped && !st.answered && (
        <LeitnerButtons prog={card ? progress[card.id] : null} wordId={card ? card.id : clip.id} onAnswer={(a) => answer(a === 'known')} />
      )}
      {st.answered && (
        <div className="video-after">
          {card ? (
            <span className="video-note"><Ic.Check width="15" height="15" /> Saved to your card “{card.word}”</span>
          ) : st.added ? (
            <span className="video-note"><Ic.Check width="15" height="15" /> Added to “From video”</span>
          ) : (
            <button type="button" className="btn btn-soft" onClick={add}><Ic.Plus width="16" height="16" /> Add to cards</button>
          )}
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>Next <Ic.Arrow width="16" height="16" /></button>
        </div>
      )}
      {isAdmin && <div className="video-admin">{adminBtn}</div>}
    </div>
  );
}

/* Library: a word's clip in a window */
function ClipModal({ clip, onClose }) {
  return (
    <Modal title={clip.word} onClose={onClose}>
      <div className="clip-modal">
        <YouTubeClip videoId={clip.videoId} start={clip.start} end={clip.end} overlay={<ClipQuote clip={clip} />} />
        {clip.wordTr && <p className="video-tr">{clip.wordTr}</p>}
        {clip.quoteTr && <p className="video-quote-tr">{clip.quoteTr}</p>}
      </div>
    </Modal>
  );
}

function ClipsAdmin({ clips, lang, uid, pushToast, onBack }) {
  const info = window.lwLangInfo(lang);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = clips.filter((c) => !q || c.word.toLowerCase().includes(q) || (c.scene || '').toLowerCase().includes(q) || c.quote.toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const fail = (title) => (e) => pushToast({ kind: 'error', title, msg: (e && e.message) || String(e) });
  const save = (c) => {
    const t = Date.now();
    window.lwSetDoc(window.LW_COLLECTIONS.clips, {
      ...c, id: c.id || window.lwUid() + window.lwUid(), lang, key: c.word.toLowerCase(),
      userId: c.userId || uid, shared: true, createdAt: c.createdAt || t, updatedAt: t,
    }).catch(fail('Could not save the clip'));
    setForm(null);
  };
  return (
    <div className="grammar">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Video</button>
      </div>
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Video clips</h1>
          <p className="lib-sub">{info.name} · {clips.length} {clips.length === 1 ? 'clip' : 'clips'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({})}><Ic.Plus /> New clip</button>
      </div>
      {clips.length > 0 && (
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder="Search clips…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="gr-list">
        {list.map((c) => (
          <div className="gr-item clip-item" key={c.id}>
            <button type="button" className="gr-item-main" onClick={() => setForm(c)}>
              <img className="clip-thumb" src={'https://i.ytimg.com/vi/' + c.videoId + '/mqdefault.jpg'} alt="" loading="lazy" />
              <span className="gr-item-text">
                <span className="gr-item-title">{c.word}</span>
                <span className="gr-item-meta">{c.scene && <span>{c.scene}</span>}<span>{lwFormatTime(c.start)}–{lwFormatTime(c.end)}</span><span>{Math.round(c.end - c.start)} s</span></span>
              </span>
            </button>
            <div className="gr-item-tools">
              <button type="button" className="icon-btn sm danger" aria-label="Delete" onClick={() => setConfirm(c)}><Ic.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      {form && (
        <Modal title={form.id ? 'Edit clip' : 'New clip'} onClose={() => setForm(null)}>
          <ClipForm initial={form} onSave={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Delete clip" onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const c = confirm;
              setConfirm(null);
              window.lwDeleteDoc(window.LW_COLLECTIONS.clips, c.id).catch(fail('Could not delete the clip'));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete the clip for <strong>{confirm.word}</strong>? Cards made from it stay.</p>
        </Modal>
      )}
    </div>
  );
}

const LW_CLIP_MAX = 60; // seconds
function ClipForm({ initial, onSave, onCancel }) {
  const [url, setUrl] = useState(initial.videoId ? 'https://youtu.be/' + initial.videoId : '');
  const [startTxt, setStartTxt] = useState(initial.videoId ? lwFormatTime(initial.start) : '');
  const [endTxt, setEndTxt] = useState(initial.videoId ? lwFormatTime(initial.end) : '');
  const [f, setF] = useState(() => ({ quote: '', word: '', wordTr: '', ipa: '', pos: '', quoteTr: '', scene: '', ...initial }));
  const [wordTouched, setWordTouched] = useState(!!initial.id);
  const [preview, setPreview] = useState(false);
  const [tried, setTried] = useState(false);
  const pickRef = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const yt = window.lwParseYouTube(url);
  const startS = window.lwParseTime(startTxt);
  const endS = window.lwParseTime(endTxt);
  const marks = (f.quote.match(/\[\[(.+?)\]\]/g) || []).length;
  /* a new link with ?t= sets the start */
  const onUrl = (v) => {
    setUrl(v);
    const p = window.lwParseYouTube(v);
    if (p && p.t != null && !startTxt) setStartTxt(lwFormatTime(p.t));
  };
  const onQuote = (v) => {
    set('quote', v);
    const m = v.match(/\[\[(.+?)\]\]/);
    if (m && !wordTouched) set('word', m[1].trim());
  };
  const now = (setter) => { const t = pickRef.current ? pickRef.current.time() : 0; setter(lwFormatTime(Math.round(t * 10) / 10)); };

  const errors = [];
  if (!yt) errors.push('Paste a YouTube link.');
  if (startS == null || endS == null) errors.push('Set the start and the end (e.g. 0:04 and 0:09).');
  else if (endS <= startS) errors.push('The end must be after the start.');
  else if (endS - startS > LW_CLIP_MAX) errors.push('A clip can be at most ' + LW_CLIP_MAX + ' seconds.');
  if (marks !== 1) errors.push('Mark the word or phrase in the quote with [[double brackets]] — exactly once.');
  if (!f.word.trim()) errors.push('Enter the word or phrase.');
  if (!f.wordTr.trim()) errors.push('Enter its translation.');
  const clip = yt && startS != null && endS != null ? { ...f, videoId: yt.videoId, start: startS, end: endS } : null;

  const submit = () => {
    setTried(true);
    if (errors.length) return;
    onSave({ ...clip, quote: f.quote.trim(), word: f.word.trim(), wordTr: f.wordTr.trim(), ipa: f.ipa.trim().replace(/^\/|\/$/g, ''),
      quoteTr: f.quoteTr.trim(), scene: f.scene.trim() });
  };

  if (preview && clip && !errors.length) {
    return (
      <div className="form clip-form">
        <div className="lf-preview-bar">
          <span className="lf-preview-label">Preview</span>
          <button type="button" className="btn btn-soft sm" onClick={() => setPreview(false)}><Ic.Edit width="15" height="15" /> Back to editor</button>
        </div>
        <YouTubeClip key={'p' + clip.videoId + clip.start + clip.end} videoId={clip.videoId} start={clip.start} end={clip.end} overlay={<ClipQuote clip={clip} />} />
        <div className="ls-card video-card">
          <h2 className="video-word">{clip.word}</h2>
          {clip.ipa && <p className="video-ipa">/{clip.ipa}/</p>}
          <p className="video-tr">{clip.wordTr}</p>
          <div className="video-quote-box"><ClipQuote clip={clip} plain />{clip.quoteTr && <span className="video-quote-tr">{clip.quoteTr}</span>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="form clip-form">
      <label className="field">
        <span className="field-label">YouTube link</span>
        <input className="input" value={url} autoFocus={!initial.id} placeholder="https://www.youtube.com/watch?v=…&t=42s" onChange={(e) => onUrl(e.target.value)} />
        {url && !yt && <span className="field-hint">This doesn't look like a YouTube link.</span>}
      </label>
      {yt && (
        <>
          <YouTubeClip key={'f' + yt.videoId} videoId={yt.videoId} free apiRef={pickRef} />
          <p className="field-hint">Play the video, pause at the right moment and press “Set start” / “Set end”.</p>
          <div className="form-grid clip-times">
            <label className="field">
              <span className="field-label">Start</span>
              <div className="lf-row">
                <input className="input input-sm" value={startTxt} placeholder="0:04" onChange={(e) => setStartTxt(e.target.value)} />
                <button type="button" className="btn btn-soft sm" onClick={() => now(setStartTxt)}>Set start</button>
              </div>
            </label>
            <label className="field">
              <span className="field-label">End{startS != null && endS != null && endS > startS ? ' · ' + Math.round((endS - startS) * 10) / 10 + ' s' : ''}</span>
              <div className="lf-row">
                <input className="input input-sm" value={endTxt} placeholder="0:09" onChange={(e) => setEndTxt(e.target.value)} />
                <button type="button" className="btn btn-soft sm" onClick={() => now(setEndTxt)}>Set end</button>
              </div>
            </label>
          </div>
        </>
      )}
      <label className="field">
        <span className="field-label">Quote from the clip</span>
        <input className="input" value={f.quote} placeholder="Once you [[get the hang of it]], everything becomes much easier." onChange={(e) => onQuote(e.target.value)} />
        <span className="field-hint">Mark the word or phrase with [[double brackets]] — it is hidden in the hint and highlighted after flipping.</span>
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Word or phrase (dictionary form)</span>
          <input className="input" value={f.word} placeholder="get the hang of it" onChange={(e) => { setWordTouched(true); set('word', e.target.value); }} />
        </label>
        <label className="field">
          <span className="field-label">Translation</span>
          <input className="input" value={f.wordTr} placeholder="наловчиться" onChange={(e) => set('wordTr', e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Transcription</span>
          <input className="input mono" value={f.ipa} placeholder="ɡet ðə hæŋ əv ɪt" onChange={(e) => set('ipa', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Part of speech</span>
          <select className="input" value={f.pos || ''} onChange={(e) => set('pos', e.target.value)}>
            <option value="">—</option>
            {window.LW_POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Quote translation</span>
        <input className="input" value={f.quoteTr} placeholder="Как только наловчишься, всё станет гораздо проще." onChange={(e) => set('quoteTr', e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Scene (optional)</span>
        <input className="input" value={f.scene} placeholder="Cafe talk" onChange={(e) => set('scene', e.target.value)} />
      </label>
      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-soft" onClick={() => { setTried(true); if (!errors.length) setPreview(true); }}>Preview</button>
        <button type="button" className="btn btn-primary" onClick={submit}>{initial.id ? 'Save changes' : 'Add clip'}</button>
      </div>
    </div>
  );
}

/* ---------------- Collocations: catalog (Library), entry sheet, game (Learn) ---------------- */
const LW_COLLOC_OWNERS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'shared', label: 'Shared' },
];
const LW_COLLOC_SORTS = [
  { id: 'az', label: 'A–Z' },
  { id: 'recent', label: 'Recent' },
];
const lwCollocAuthor = (e) => (e.shared ? 'Admin' : 'You');

function CollocCatalog({ entries, wordsById, userId, query, owner, sort, setLibField, limit, setLimit, onOpen, onNew }) {
  const liveCards = (e) => window.lwCollocLive(e, wordsById).map((p) => wordsById[p.wordId]);
  const ownerOk = (e, o) => o === 'all' || (o === 'mine' ? e.userId === userId : !!e.shared);
  const matches = (e) => !query || e.word.includes(query)
    || liveCards(e).some((w) => w.word.toLowerCase().includes(query) || (w.tr || '').toLowerCase().includes(query));
  const counts = {};
  LW_COLLOC_OWNERS.forEach((o) => { counts[o.id] = entries.filter((e) => ownerOk(e, o.id) && matches(e)).length; });
  const list = entries.filter((e) => ownerOk(e, owner) && matches(e)).sort(sort === 'recent'
    ? (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    : (a, b) => a.word.localeCompare(b.word));

  return (
    <div className="colloc-pane">
      <div className="lib-filters">
        <div className="status-chips">
          {LW_COLLOC_OWNERS.map((o) => (
            <button key={o.id} type="button" className={'chip' + (owner === o.id ? ' chip-on' : '')}
              onClick={() => setLibField('collocOwner', o.id)}>
              {o.label} <span className="chip-count">{counts[o.id]}</span>
            </button>
          ))}
        </div>
        <div className="lib-selects">
          <select className="input input-sm" value={sort} onChange={(e) => setLibField('collocSort', e.target.value)} aria-label="Sort">
            {LW_COLLOC_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-card lib-empty">
          <Ic.Link width="26" height="26" />
          <p className="empty-title">{entries.length === 0 ? 'No collocations yet' : 'Nothing matches'}</p>
          <p className="empty-sub">{entries.length === 0
            ? 'Collect phrase cards around a word — “heavy rain”, “heavy traffic” — and practise them in Learn → Phrases.'
            : 'Try another filter or search.'}</p>
          {entries.length === 0 && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New collocation</button>}
        </div>
      ) : (
        <div className="ccards">
          {list.slice(0, limit).map((e) => {
            const cards = liveCards(e);
            return (
              <button type="button" className="ccard" key={e.id} onClick={() => onOpen(e)}>
                <span className="ccard-top">
                  <span className="ccard-word">{e.word}</span>
                  {e.pattern && <span className="ccard-pattern">{e.pattern}</span>}
                  <span className={'ccard-author' + (e.shared ? ' admin' : '')}>{lwCollocAuthor(e)}</span>
                </span>
                <span className="ccard-phrases">{cards.map((w) => w.word).join(' · ') || '—'}</span>
                <span className="ccard-foot">
                  <span>{cards.length} {cards.length === 1 ? 'phrase' : 'phrases'} · {(e.wrong || []).length} wrong</span>
                  {cards.length < 2 && <span className="ccard-warn">Needs phrases</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {list.length > limit && (
        <button type="button" className="btn btn-soft lib-more" onClick={() => setLimit((n) => n + LW_LIB_PAGE)}>
          Show more ({list.length - limit})
        </button>
      )}
      <button type="button" className="fab" onClick={onNew} aria-label="New collocation"><Ic.Plus width="24" height="24" /></button>
    </div>
  );
}

function CollocSheet({ entry, wordsById, canEdit, onEdit, onDelete, onClose }) {
  const live = window.lwCollocLive(entry, wordsById);
  const meta = [entry.pattern, entry.pos].filter(Boolean).join(' · ');
  return (
    <Modal title={entry.word} sheet onClose={onClose}
      footer={canEdit ? <>
        <button className="btn btn-ghost danger-text" onClick={onDelete}><Ic.Trash width="16" height="16" /> Delete</button>
        <button className="btn btn-primary" onClick={onEdit}><Ic.Edit width="16" height="16" /> Edit</button>
      </> : null}>
      <div className="csheet">
        <div className="csheet-meta">
          {meta && <span>{meta}</span>}
          <span className={'ccard-author' + (entry.shared ? ' admin' : '')}>Created by {lwCollocAuthor(entry)}</span>
        </div>
        {live.length < 2 && <p className="ccard-warn csheet-warn">Needs at least 2 phrases to appear in the game.</p>}
        <div className="csheet-list">
          {live.map((p) => {
            const w = wordsById[p.wordId];
            return (
              <div className="csheet-item" key={p.wordId}>
                <div className="csheet-row">
                  <span className="csheet-phrase">{w.word}</span>
                  <span className="csheet-chip">{p.partner}</span>
                  <SpeakButton word={w.word} />
                </div>
                {w.ipa && <div className="csheet-ipa">{w.ipa}</div>}
                <div className="csheet-tr">{w.tr}</div>
                {w.example && <div className="csheet-ex">{w.example}{w.exampleTr && <span className="csheet-ex-tr">{w.exampleTr}</span>}</div>}
              </div>
            );
          })}
        </div>
        {(entry.wrong || []).length > 0 && (
          <div className="csheet-mist">
            <h4 className="csheet-h">Common mistakes</h4>
            {entry.wrong.map((m, i) => (
              <div className="csheet-mist-row" key={i}>
                <span className="csheet-bad"><Ic.Close width="14" height="14" /> {m.partner}</span>
                <span className="colloc-arrow">→</span>
                <span className="csheet-good">{m.fix}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* Game. A session is 5 entries; a round shows the entry's word in the middle and
   up to 8 chips around it (right partners + wrong ones). Answers go to the
   phrase cards' Leitner progress: a right chip is Know for its card; a wrong
   chip is Again for every right phrase not found yet; Hint is Again for the
   hinted phrase. Each card is answered at most once per round. */
const LW_COLLOC_SESSION = 5;
/* chip slots in % of the board: sides first, then top and bottom rows */
const LW_COLLOC_SLOTS = [[22, 30], [78, 30], [22, 70], [78, 70], [27, 8], [73, 8], [27, 92], [73, 92]];

function lwBuildCollocRound(entry, progress, wordsById) {
  const phrases = window.lwCollocRoundPhrases(entry, progress, wordsById, Date.now(), 5);
  const wrongs = shuffle(entry.wrong || []).slice(0, Math.min(3, 8 - phrases.length));
  const chips = shuffle([
    ...phrases.map((p) => ({ id: 'p' + p.wordId, ok: true, wordId: p.wordId, text: p.partner })),
    ...wrongs.map((w, i) => ({ id: 'w' + i, ok: false, text: w.partner, fix: w.fix })),
  ]).map((c, i) => ({ ...c, x: LW_COLLOC_SLOTS[i][0], y: LW_COLLOC_SLOTS[i][1] }));
  return { entryId: entry.id, chips, found: [], wrong: [], hinted: [], answered: [], card: null, msg: null };
}

function CollocView({ entries, words, progress, now, recordAnswer, goCatalog, goStudy }) {
  const wordsById = useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  const [session, setSession] = useState(null); // { ids, idx, done, stats: { found, mistakes, xp } }
  const [round, setRound] = useState(null);
  const playable = entries.filter((e) => window.lwCollocPlayable(e, wordsById));
  const byId = (id) => entries.find((e) => e.id === id);

  const start = (exclude = []) => {
    const ids = window.lwCollocPick(entries, progress, wordsById, Date.now(), LW_COLLOC_SESSION, exclude).map((e) => e.id);
    if (!ids.length) { setSession(null); setRound(null); return; }
    setSession({ ids, idx: 0, done: false, stats: { found: 0, mistakes: 0, xp: 0 } });
    setRound(lwBuildCollocRound(byId(ids[0]), progress, wordsById));
  };
  /* start once entries and words have loaded */
  useEffect(() => { if (!session && playable.length) start(); }, [playable.length, session]); // eslint-disable-line

  const goNext = () => {
    const s = session;
    let idx = s.idx + 1;
    while (idx < s.ids.length && !(byId(s.ids[idx]) && window.lwCollocPlayable(byId(s.ids[idx]), wordsById))) idx++;
    if (idx >= s.ids.length) { setSession({ ...s, idx, done: true }); setRound(null); return; }
    setSession({ ...s, idx });
    setRound(lwBuildCollocRound(byId(s.ids[idx]), progress, wordsById));
  };
  /* the entry was deleted mid-round */
  const entry = round && byId(round.entryId);
  useEffect(() => { if (round && !entry) goNext(); }); // eslint-disable-line

  const answer = (wordId, known) => {
    recordAnswer(wordId, known, 'colloc');
    const xp = known ? window.LW_XP_CORRECT : window.LW_XP_WRONG;
    setSession((s) => ({ ...s, stats: { ...s.stats, xp: s.stats.xp + xp } }));
  };
  const okChips = round ? round.chips.filter((c) => c.ok) : [];
  const pendingIds = () => okChips.filter((c) => !round.found.includes(c.id) && !round.answered.includes(c.wordId)).map((c) => c.wordId);

  const tap = (chip) => {
    if (round.card || round.found.includes(chip.id) || round.wrong.includes(chip.id)) return;
    if (chip.ok) {
      const first = !round.answered.includes(chip.wordId);
      if (first) answer(chip.wordId, true);
      setRound((r) => ({ ...r, found: [...r.found, chip.id], answered: first ? [...r.answered, chip.wordId] : r.answered, card: chip.wordId, msg: null }));
      setSession((s) => ({ ...s, stats: { ...s.stats, found: s.stats.found + 1 } }));
    } else {
      const pending = pendingIds();
      pending.forEach((id) => answer(id, false));
      setRound((r) => ({ ...r, wrong: [...r.wrong, chip.id], answered: [...r.answered, ...pending], msg: chip.fix }));
      setSession((s) => ({ ...s, stats: { ...s.stats, mistakes: s.stats.mistakes + 1 } }));
    }
  };
  const hint = () => {
    const c = okChips.find((x) => !round.found.includes(x.id) && !round.hinted.includes(x.id));
    if (!c) return;
    const first = !round.answered.includes(c.wordId);
    if (first) answer(c.wordId, false);
    setRound((r) => ({ ...r, hinted: [...r.hinted, c.id], answered: first ? [...r.answered, c.wordId] : r.answered }));
  };
  const closeCard = () => {
    const allFound = okChips.every((c) => round.found.includes(c.id));
    if (allFound) goNext();
    else setRound((r) => ({ ...r, card: null }));
  };

  if (!session || (!round && !session.done)) {
    return (
      <div className="empty-card colloc-empty">
        <Ic.Link width="28" height="28" />
        <p className="empty-title">{entries.length === 0 ? 'No collocations yet' : 'Nothing to play yet'}</p>
        <p className="empty-sub">{entries.length === 0
          ? 'Create some in Library → Collocations: pick a word and the phrase cards that go with it.'
          : 'A collocation needs at least 2 phrases and 1 wrong partner to appear here.'}</p>
        <button className="btn btn-primary" onClick={goCatalog}>Open Collocations</button>
      </div>
    );
  }

  if (session.done) {
    const st = session.stats;
    return (
      <div className="colloc-done empty-card">
        <Ic.DoubleCheck width="30" height="30" />
        <p className="empty-title">Session complete</p>
        <div className="colloc-done-stats">
          <span><strong>{st.found}</strong> found</span>
          <span><strong>{st.mistakes}</strong> {st.mistakes === 1 ? 'mistake' : 'mistakes'}</span>
          <span><strong>+{st.xp}</strong> XP</span>
        </div>
        <div className="colloc-done-btns">
          <button className="btn btn-soft" onClick={goStudy}>Back to Cards</button>
          <button className="btn btn-primary" onClick={() => start(session.ids)}>Next {LW_COLLOC_SESSION}</button>
        </div>
      </div>
    );
  }
  if (!entry) return null;

  const cardWord = round.card && wordsById[round.card];
  const foundN = okChips.filter((c) => round.found.includes(c.id)).length;
  return (
    <div className="colloc">
      <div className="colloc-head">
        <span className="colloc-kicker"><Ic.Sparkle width="16" height="16" /> Collocations · Word {session.idx + 1}/{session.ids.length}</span>
        <span className="colloc-count">{foundN}/{okChips.length} found</span>
      </div>
      <div className="colloc-segs">
        {okChips.map((c, i) => <span key={c.id} className={'colloc-seg' + (i < foundN ? ' on' : '')} />)}
      </div>
      <h2 className="colloc-title">Which words go with <em>{entry.word}</em>?</h2>
      <p className="colloc-sub">Tap every word that makes a natural phrase{entry.pattern ? ' (' + entry.pattern + ')' : ''}.</p>

      <div className="cboard">
        <svg className="cboard-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="36" ry="38" className="cboard-orbit" />
          {round.chips.map((c) => (
            <line key={c.id} x1="50" y1="50" x2={c.x} y2={c.y} className={round.found.includes(c.id) ? 'on' : ''} />
          ))}
        </svg>
        <div className="cboard-center">
          <SpeakButton word={entry.word} />
          <span className="cboard-word">{entry.word}</span>
          {entry.pos && <span className="cboard-pos">{entry.pos}</span>}
        </div>
        {round.chips.map((c) => {
          const state = round.found.includes(c.id) ? ' ok' : round.wrong.includes(c.id) ? ' bad' : round.hinted.includes(c.id) ? ' hint' : '';
          return (
            <button key={c.id} type="button" className={'cchip' + state} style={{ left: c.x + '%', top: c.y + '%' }}
              onClick={() => tap(c)} disabled={!!round.card && !state}>
              {state === ' ok' ? <Ic.Check width="14" height="14" /> : state === ' bad' ? <Ic.Close width="14" height="14" /> : <span className="cchip-dot" />}
              {c.text}
            </button>
          );
        })}
      </div>

      {round.msg && !cardWord && (
        <p className="colloc-msg" role="status"><Ic.Close width="15" height="15" /><span>Not quite — we say <strong>{round.msg}</strong>.</span></p>
      )}

      {cardWord ? (
        <div className="cphrase" role="status">
          <div className="cphrase-head">
            <span className="cphrase-title">Great match!</span>
          </div>
          <div className="cphrase-box">
            <div className="cphrase-row">
              <span className="cphrase-phrase">{cardWord.word}</span>
              <SpeakButton word={cardWord.word} />
              {cardWord.ipa && <span className="cphrase-ipa">{cardWord.ipa}</span>}
            </div>
            <div className="cphrase-tr">{cardWord.tr}</div>
          </div>
          {entry.pattern && <span className="cphrase-pattern"><Ic.Sparkle width="14" height="14" /> {entry.pattern}</span>}
          {cardWord.example && (
            <div className="cphrase-ex">
              <span>{cardWord.example}</span>
              {cardWord.exampleTr && <span className="cphrase-ex-tr">{cardWord.exampleTr}</span>}
            </div>
          )}
          <button className="btn btn-primary cphrase-next" onClick={closeCard} autoFocus>
            Continue <Ic.Arrow width="16" height="16" />
          </button>
        </div>
      ) : (
        <div className="colloc-btns">
          <button type="button" className="btn btn-soft" onClick={hint}><Ic.Bulb width="16" height="16" /> Hint</button>
          <button type="button" className="btn btn-soft" onClick={goNext}><Ic.Repeat width="16" height="16" /> Skip</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Group form ---------------- */
const LW_PALETTE = ['#005da7', '#2F9E8F', '#5B6CE8', '#C9913B', '#B7409B', '#3E8ED0', '#5BA02E', '#D6453E'];
function GroupForm({ initial, parentGroup, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [color, setColor] = useState(initial ? initial.color : (parentGroup ? parentGroup.color : LW_PALETTE[0]));
  const canSave = name.trim();
  const submit = () => {
    if (!canSave) return;
    const parentId = initial ? initial.parentId : (parentGroup ? parentGroup.id : undefined);
    onSave({
      id: initial ? initial.id : window.lwUid(),
      name: name.trim(),
      color,
      ...(parentId ? { parentId } : {}),
    });
  };
  return (
    <div className="form">
      {parentGroup && (
        <p className="field-hint">
          Subgroup of <strong>{parentGroup.name}</strong>
        </p>
      )}
      <label className="field">
        <span className="field-label">Group name</span>
        <input className="input" value={name} autoFocus placeholder="e.g. Phrasal verbs"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </label>
      <div className="field">
        <span className="field-label">Color</span>
        <div className="swatches">
          {LW_PALETTE.map((c) => (
            <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')}
              style={{ background: c }} onClick={() => setColor(c)} aria-label={c}>
              {c === color && <Ic.Check />}
            </button>
          ))}
        </div>
      </div>
      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>{initial ? 'Save changes' : 'Create group'}</button>
      </div>
    </div>
  );
}

/* ---------------- Language select (first launch) ----------------
   One language or several; the first picked is studied first. */
function LanguageSelectView({ onSelect }) {
  const [picked, setPicked] = useState([]);
  const toggle = (code) => setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  return (
    <div className="lang-select">
      <div className="lang-select-card">
        <p className="lang-select-title">Which languages are you learning?</p>
        <p className="lang-select-sub">Pick one or both. You can switch between them or add one later in Profile.</p>
        <div className="lang-select-grid">
          {LW_LANGUAGES.map((l) => (
            <button key={l.code} className={'lang-opt' + (picked.includes(l.code) ? ' on' : '')} type="button"
              aria-pressed={picked.includes(l.code)} onClick={() => toggle(l.code)}>
              {picked.includes(l.code) && <span className="lang-opt-check"><Ic.Check width="14" height="14" /></span>}
              <span className="lang-opt-flag">{l.flag}</span>
              <span className="lang-opt-name">{l.name}</span>
              <span className="lang-opt-native">{l.native}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary lg lang-select-go" disabled={!picked.length} onClick={() => onSelect(picked)}>
          Continue
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { App, GroupForm });
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
