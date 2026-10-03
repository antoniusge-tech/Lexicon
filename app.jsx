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
];
const LW_TABS = [
  { id: 'learn', label: 'Learn', icon: Ic.Learn },
  { id: 'reading', label: 'Reading', icon: Ic.Book },
  { id: 'library', label: 'Library', icon: Ic.Library },
  { id: 'profile', label: 'Profile', icon: Ic.Person },
];
const LW_SCREENS = ['learn', 'reading', 'library', 'profile', 'import', 'admin'];
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

function App() {
  const [theme, setTheme] = useState(() => window.lwLoad(LW_KEYS.theme, 'light'));
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = signed out
  const [userDoc, setUserDoc] = useState(undefined); // undefined = loading, null = no profile yet (new Google user)
  const [online, setOnline] = useState(() => navigator.onLine);
  const [authInfo, setAuthInfo] = useState(() => window.lwAuthInfo()); // sign-in methods (password / Google)
  const [groups, setGroups] = useState([]);
  const [words, setWords] = useState([]);
  const [progress, setProgress] = useState({}); // { [wordId]: Leitner progress doc }
  const [activity, setActivity] = useState({}); // { 'YYYY-MM-DD': daily activity doc }
  const [now, setNow] = useState(() => Date.now()); // ticks each minute so due counts stay fresh
  /* where the user is: a screen (tab) + the Learn sub-mode; both survive reloads */
  const [nav, setNav] = useState(() => {
    const saved = window.lwLoad(LW_KEYS.nav, null) || {};
    return {
      tab: LW_SCREENS.includes(saved.tab) ? saved.tab : 'learn',
      learnMode: LW_LEARN_MODES.some((m) => m.id === saved.learnMode) ? saved.learnMode : 'cards',
    };
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false); // group picker sheet on Learn
  const [selected, setSelected] = useState(() => window.lwLoad(LW_KEYS.selected, null) || []);
  const [direction, setDirection] = useState(() => window.lwLoad(LW_KEYS.direction, 'en-ru'));
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
  const [reading, setReading] = useState(() => {
    const saved = window.lwLoad(window.LW_KEYS.reading, null);
    const cards = saved && Array.isArray(saved.cards) ? saved.cards : [];
    const index = saved && Number.isInteger(saved.index) ? saved.index : 0;
    return {
      cards,
      index: cards.length ? Math.min(index, cards.length - 1) : 0,
      status: 'idle',
      error: null,
    };
  });
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

  /* Kick off text generation. Runs the promise at the App level so it outlives
     ReadingView unmounting; on completion it updates `reading` and raises a
     bottom-right toast so the user knows they can return to the reading tab. */
  const startReadingGeneration = useCallback((params) => {
    const { pool, levels, topicPrompts, lengthWords } = params;
    const myGen = ++genIdRef.current;
    setReading((r) => ({ ...r, cards: [], index: 0, status: 'loading', error: null }));
    window.lwAiGenerateBatch(pool, levels, topicPrompts, lengthWords, window.LW_READING_BATCH)
      .then((cards) => {
        if (genIdRef.current !== myGen) return; // superseded by a newer request
        setReading((r) => ({ ...r, cards, index: 0, status: 'idle', error: null }));
        pushToast({
          kind: 'success',
          title: 'Texts ready (' + cards.length + ')',
          msg: 'Open the Reading tab and swipe through the cards.',
          action: { label: 'Open', view: 'reading' },
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
          action: { label: 'Settings', view: 'reading' },
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

  const lang = userDoc ? userDoc.lang : null;
  /* write some of the user's own profile fields (lang, dailyGoal, cefr, avatar) */
  const updateProfile = useCallback((fields) => {
    if (!authUser) return Promise.resolve();
    return window.lwUpdateUser(authUser.uid, fields).catch((e) => {
      console.error('updateProfile failed', e);
      pushToast({ kind: 'error', title: 'Could not save your profile', msg: (e && e.message) || String(e) });
    });
  }, [authUser, pushToast]);
  const setLang = useCallback((l) => { updateProfile({ lang: l }); }, [updateProfile]);

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
    if (!authUser) { setProgress({}); setActivity({}); return; }
    const unsubProgress = window.lwWatchUserCollection(window.LW_COLLECTIONS.progress, authUser.uid,
      (items) => setProgress(Object.fromEntries(items.map((p) => [p.wordId, p]))));
    const unsubActivity = window.lwWatchUserCollection(window.LW_COLLECTIONS.activity, authUser.uid,
      (items) => setActivity(Object.fromEntries(items.map((a) => [a.date, a]))));
    return () => { unsubProgress(); unsubActivity(); };
  }, [authUser]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const dailyGoal = (userDoc && userDoc.dailyGoal) || window.LW_DEFAULT_DAILY_GOAL;

  /* Record one answer from Study / Choice / Fill / Review: next Leitner box for
     the word plus today's XP. A +50 bonus lands once, on the answer that reaches
     the daily goal. Snapshots apply local writes immediately, so rapid answers
     already see the updated progress/activity. */
  const lastAnswerAt = useRef(0); // for practice time (activity.ms)
  const recordAnswer = useCallback((wordId, known, mode) => {
    if (!authUser) return;
    const t = Date.now();
    const ms = window.lwPracticeMs(lastAnswerAt.current, t);
    lastAnswerAt.current = t;
    const date = window.lwLocalDate(t);
    const today = activity[date] || {};
    const goalBonus = !today.goalMet && (today.answers || 0) + 1 >= dailyGoal ? window.LW_XP_GOAL_BONUS : 0;
    window.lwRecordAnswer({
      uid: authUser.uid,
      progress: window.lwNextProgress(progress[wordId] || null, wordId, known, mode, t),
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
  }, [authUser, activity, progress, dailyGoal, pushToast]);

  /* persistence (local-only settings) */
  useEffect(() => { document.documentElement.dataset.theme = theme; window.lwSave(LW_KEYS.theme, theme); }, [theme]);
  useEffect(() => { window.lwSave(LW_KEYS.selected, selected); }, [selected]);
  useEffect(() => { window.lwSave(LW_KEYS.direction, direction); }, [direction]);
  useEffect(() => { window.lwSave(LW_KEYS.nav, nav); }, [nav]);
  /* персистим пачку карточек чтения (без эфемерных status/error) */
  useEffect(() => {
    window.lwSave(LW_KEYS.reading, { cards: reading.cards, index: reading.index });
  }, [reading.cards, reading.index]);

  /* default selection: everything, once groups load (only if user never picked) */
  const hasSavedSelection = useRef(window.lwLoad(LW_KEYS.selected, null) != null);
  useEffect(() => {
    if (!hasSavedSelection.current && groups.length) {
      setSelected(groups.filter((g) => !g.parentId).map((g) => g.id));
    }
  }, [groups]);

  /* keep selection valid if a group is deleted (skip until groups have loaded) */
  useEffect(() => {
    if (!groups.length) return;
    setSelected((sel) => sel.filter((id) => groups.some((g) => g.id === id)));
  }, [groups]);

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const countByGroup = useMemo(() => {
    const m = {};
    groups.forEach((g) => { m[g.id] = 0; });
    words.forEach((w) => { if (m[w.groupId] != null) m[w.groupId]++; });
    return m;
  }, [groups, words]);

  /* streak / goal / XP / review queue size for the footer (dashboard comes in stage 3).
     Progress for words that no longer exist (e.g. a shared word an admin deleted) is ignored. */
  const stats = useMemo(() => {
    const today = activity[window.lwLocalDate(now)] || {};
    const xp = window.lwTotalXp(activity);
    const wordIds = new Set(words.map((w) => w.id));
    const dueCount = Object.values(progress).filter((p) => wordIds.has(p.wordId) && p.due <= now).length;
    const statusCounts = window.lwStatusCounts(progress, words, now);
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
  }, [activity, progress, words, now, dailyGoal]);

  const scopedGroups = groups;
  const scopedWords = words;
  const scopedSelected = selected;
  const scopedCountByGroup = countByGroup;

  /* Navigate by name. Accepts screens ('reading', 'library', ...), Learn modes
     ('cards', 'review', 'choice', 'fill'; legacy 'study' = cards) and 'category'
     (opens the group picker on Learn) — toast actions use these names. */
  const goTo = useCallback((name) => {
    setDrawerOpen(false);
    if (name === 'study') name = 'cards';
    if (name === 'category') { setNav((n) => ({ ...n, tab: 'learn' })); setGroupsOpen(true); return; }
    if (LW_LEARN_MODES.some((m) => m.id === name)) { setNav({ tab: 'learn', learnMode: name }); return; }
    if (LW_SCREENS.includes(name)) setNav((n) => ({ ...n, tab: name }));
  }, []);

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
    return <LanguageSelectView onSelect={setLang} />;
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
        user={userDoc} isAdmin={isAdmin} wordCount={scopedWords.length}
        theme={theme} onToggleTheme={toggleTheme}
        onGeminiKey={() => { setDrawerOpen(false); setGeminiKeyOpen(true); }} />
      <div className="app-main">
        <AppBar onMenu={() => setDrawerOpen(true)} level={stats.level} xp={stats.xp} onLevel={() => goTo('profile')} />
        {!online && (
          <div className="offline-bar" role="status">
            <Ic.CloudOff width="16" height="16" /> Offline — answers will sync when you're back.
          </div>
        )}
        <main className={'content content-' + tab}>
          {tab === 'learn' ? (
            <LearnView mode={learnMode} setMode={(m) => goTo(m)} stats={stats} studyStats={studyStats}
              selectedCount={scopedSelected.length} onPickGroups={() => setGroupsOpen(true)}>
              {learnMode === 'review' ? (
                <ReviewView {...learnProps} now={now} goStudy={() => goTo('cards')} />
              ) : learnMode === 'choice' ? (
                <ChoiceView {...learnProps} selected={scopedSelected} />
              ) : learnMode === 'fill' ? (
                <FillView {...learnProps} selected={scopedSelected} />
              ) : (
                <StudyView {...learnProps} groups={scopedGroups} selected={scopedSelected} onStatsChange={setStudyStats} />
              )}
            </LearnView>
          ) : tab === 'reading' ? (
            <ReadingView groups={scopedGroups} words={scopedWords} countByGroup={scopedCountByGroup}
              reading={reading} setReading={setReading}
              startGenerate={startReadingGeneration}
              defaultLevel={userDoc.cefr}
              goLibrary={() => goTo('library')} />
          ) : tab === 'library' ? (
            <LibraryView groups={scopedGroups} words={scopedWords} userId={authUser.uid} username={userDoc.username} isAdmin={isAdmin}
              progress={progress} now={now} direction={direction} recordAnswer={recordAnswer}
              goImport={() => goTo('import')} />
          ) : tab === 'import' ? (
            <ImportView groups={scopedGroups} importState={importState} setImportState={setImportState}
              startAiFill={startImportAiFill} onImport={importWords}
              goLibrary={() => goTo('library')} />
          ) : tab === 'admin' && isAdmin ? (
            <AdminView currentUid={authUser.uid} />
          ) : (
            <ProfileView user={userDoc} stats={stats} updateProfile={updateProfile}
              authInfo={authInfo} refreshAuthInfo={() => setAuthInfo(window.lwAuthInfo())}
              pushToast={pushToast} goLearn={() => goTo('cards')}
              theme={theme} onToggleTheme={toggleTheme}
              direction={direction} setDirection={setDirection}
              lang={lang} setLang={setLang}
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

function NavDrawer({ open, onClose, tab, learnMode, goTo, stats, user, isAdmin, wordCount, theme, onToggleTheme, onGeminiKey }) {
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
            <span className="drawer-sub">English lab</span>
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

        <nav className="drawer-nav">
          {item('cards', Ic.Learn, 'Learn', learnOn)}
          {item('review', Ic.Repeat, 'Review', tab === 'learn' && learnMode === 'review',
            stats.dueCount > 0 && <span className="nav-badge nav-badge-hot">{stats.dueCount}</span>)}
          {item('reading', Ic.Book, 'Reading', tab === 'reading')}
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
        <div className="mode-pills" role="tablist">
          {LW_LEARN_MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
              className={'mode-pill' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)}>
              {m.label}
              {m.id === 'review' && stats.dueCount > 0 && <span className="mode-pill-count">{stats.dueCount}</span>}
            </button>
          ))}
        </div>
        {mode !== 'review' && (
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

/* ---------------- Profile: who you are, your progress (dashboard), settings ---------------- */
const LW_STATUS_META = [
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'review', label: 'To review' },
  { id: 'mastered', label: 'Mastered' },
];

function ProfileView({ user, stats, updateProfile, authInfo, refreshAuthInfo, pushToast, goLearn,
  theme, onToggleTheme, direction, setDirection, lang, setLang, onGeminiKey, onLogout, onDeleteAccount }) {
  const fileRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  /* lwLevel: level n starts at 50·(n−1)² XP */
  const levelStart = 50 * (stats.level - 1) ** 2;
  const levelEnd = 50 * stats.level ** 2;
  const levelPct = Math.round(((stats.xp - levelStart) / (levelEnd - levelStart)) * 100);
  const langInfo = LW_LANGUAGES.find((l) => l.code === lang);
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
          {langInfo ? langInfo.flag + ' Learning ' + langInfo.name : 'Learning'}
          {user.cefr ? ' · ' + user.cefr : ''}{user.cefrTarget ? ' → ' + user.cefrTarget : ''}
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
        <h2 className="dash-title">English level</h2>
        <p className="dash-sub">Your level sets the default difficulty of reading texts.</p>
        <div className="cefr-row">
          <span className="cefr-label">I'm at</span>
          <div className="cefr-pills">
            {window.LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user.cefr === lv ? ' on' : '')}
                onClick={() => updateProfile({ cefr: lv })}>{lv}</button>
            ))}
          </div>
        </div>
        <div className="cefr-row">
          <span className="cefr-label">Goal</span>
          <div className="cefr-pills">
            {window.LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user.cefrTarget === lv ? ' on' : '')}
                onClick={() => updateProfile({ cefrTarget: lv })}>{lv}</button>
            ))}
          </div>
        </div>
      </section>

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
                onClick={() => updateProfile({ dailyGoal: g })}>{g}</button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label"><Ic.Swap /> Card direction</span>
          <div className="seg">
            <button type="button" className={'seg-btn' + (direction === 'en-ru' ? ' on' : '')} onClick={() => setDirection('en-ru')}>EN → RU</button>
            <button type="button" className={'seg-btn' + (direction === 'ru-en' ? ' on' : '')} onClick={() => setDirection('ru-en')}>RU → EN</button>
          </div>
        </div>
        <div className="setting-row setting-row-wrap">
          <span className="setting-label"><Ic.Book /> Language you learn</span>
          <div className="seg">
            {LW_LANGUAGES.map((l) => (
              <button key={l.code} type="button" className={'seg-btn' + (lang === l.code ? ' on' : '')}
                onClick={() => setLang(l.code)} title={l.name}>{l.flag} {l.code.toUpperCase()}</button>
            ))}
          </div>
        </div>
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

/* reduce a token to a rough stem so grader↔graders, plan↔planning etc. match
   regardless of which form is stored in the category vs. printed in the text */
function readingStem(token) {
  let w = String(token || '').toLowerCase().replace(/[’']/g, '');
  if (!w) return '';
  /* strip common inflectional endings */
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ied')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 2 && w.endsWith('s')) w = w.slice(0, -1);
  /* undo consonant doubling (dig→digging, plan→planning) */
  if (w.length > 2 && /([bcdfghjklmnpqrstvwxz])\1$/.test(w)) w = w.slice(0, -1);
  /* drop a trailing silent-e artefact so care/caring, spade/spaded align */
  return w;
}

/* two tokens match if they share a stem (either direction of inflection) */
function readingTokensMatch(a, b) {
  const la = String(a).toLowerCase().replace(/[’']/g, '');
  const lb = String(b).toLowerCase().replace(/[’']/g, '');
  if (la === lb) return true;
  const sa = readingStem(a);
  const sb = readingStem(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  /* handle silent-e: spade→spaded stems to "spad", base is "spade" */
  return sa === sb.replace(/e$/, '') || sb === sa.replace(/e$/, '');
}

/* split the highlight phrase into meaningful sub-words (drops filler like "on") */
function readingPhraseTokens(highlight) {
  return String(highlight || '').match(/[A-Za-z0-9’']+/g) || [];
}

/* render a sentence, wrapping tokens that match the active highlighted word/phrase in <mark>.
   Supports multi-word phrases (on cloud 9, work out) by matching a run of tokens. */
function ReadingSentenceText({ text, highlight }) {
  if (!highlight) return text;
  const target = readingPhraseTokens(highlight);
  if (target.length === 0) return text;

  /* split keeping delimiters so we can re-join verbatim */
  const parts = String(text).split(/([A-Za-z0-9’']+)/);
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

function ReadingView({ groups, words, countByGroup, reading, setReading, startGenerate, defaultLevel, goLibrary }) {
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
                        <ReadingSentenceText text={s.en} highlight={activeWord} />
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
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, userId: wordModal.initial.userId, username: wordModal.initial.username, shared: wordModal.initial.shared });
    setWordModal(null);
    onChanged();
  };
  const saveGroup = (g) => {
    window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...g, userId: groupModal.initial.userId, username: groupModal.initial.username, shared: groupModal.initial.shared });
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

  const makeWordShared = (w) => {
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, shared: true });
    onChanged();
  };
  const makeGroupShared = (g) => {
    const subGroupIds = groups.filter((sg) => sg.parentId === g.id).map((sg) => sg.id);
    [g, ...groups.filter((sg) => subGroupIds.includes(sg.id))].forEach((grp) => {
      window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...grp, shared: true });
    });
    [g.id, ...subGroupIds].forEach((groupId) => {
      (wordsByGroup[groupId] || []).forEach((w) => {
        window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, shared: true });
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
function WordCard({ word, group, prog, now, canEdit, onEdit, onDelete }) {
  const status = window.lwWordStatus(prog, now);
  const pct = prog ? Math.round(((prog.box || 0) / window.LW_MASTERED_BOX) * 100) : 0;
  return (
    <article className="wcard">
      <div className="wcard-top">
        <StatusBadge status={status} />
        {group && <span className="wcard-group"><span className="grp-dot" style={{ background: group.color }} />{group.name}</span>}
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
function LibraryView({ groups, words, userId, username, isAdmin, progress, now, direction, recordAnswer, goImport }) {
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?, parentGroup?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);
  const [query, setQuery] = useState('');
  /* Words view filters; remembered on this device */
  const [lib, setLib] = useState(() => ({ view: 'words', status: 'all', groupId: '', sort: 'recent', ...(window.lwLoad(LW_KEYS.library, null) || {}) }));
  const setLibField = (k, v) => { setLib((l) => ({ ...l, [k]: v })); setLimit(LW_LIB_PAGE); };
  useEffect(() => { window.lwSave(LW_KEYS.library, lib); }, [lib]);
  const [limit, setLimit] = useState(LW_LIB_PAGE);
  const [practice, setPractice] = useState(null); // word being practised from the word of the day
  const [tagState, setTagState] = useState({ busy: false, done: 0, error: null });
  const [keyModal, setKeyModal] = useState(false);

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
        </div>
      </div>
      <div className="lib-head">
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder="Search words or translations…"
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(LW_LIB_PAGE); }} />
        </div>
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={goImport}><Ic.Plus /> Import</button>
          {lib.view === 'groups' ? (
            <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
          ) : hasLeafGroup && (
            <button className="btn btn-primary lib-add-word" onClick={() => setWordModal({ mode: 'new' })}><Ic.Plus /> Add word</button>
          )}
        </div>
      </div>

      {lib.view === 'words' ? (
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

/* ---------------- Language select (first launch) ---------------- */
function LanguageSelectView({ onSelect }) {
  return (
    <div className="lang-select">
      <div className="lang-select-card">
        <p className="lang-select-title">Which language are you learning?</p>
        <p className="lang-select-sub">You can change this later in Profile.</p>
        <div className="lang-select-grid">
          {LW_LANGUAGES.map((l) => (
            <button key={l.code} className="lang-opt" onClick={() => onSelect(l.code)} type="button">
              <span className="lang-opt-flag">{l.flag}</span>
              <span className="lang-opt-name">{l.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App, GroupForm });
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
