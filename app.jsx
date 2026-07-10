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

const LW_VIEW_ORDER = ['study', 'choice', 'reading', 'category', 'library'];

/* Human-readable reading-generation errors, keyed by the .code set in data.jsx.
   Reused by the reading tab's inline hints and by the toast messages. */
const LW_READING_ERROR_MSG = {
  quota: 'Дневной лимит Gemini исчерпан. Попробуйте позже.',
  'bad-key': 'Ключ Gemini недействителен. Обновите ключ в настройках.',
  refusal: 'Модель не смогла составить текст. Попробуйте ещё раз.',
  overload: 'Модель Gemini сейчас перегружена. Попробуйте через минуту.',
  empty: 'В этой категории пока нет слов.',
  error: 'Ошибка AI-сервиса. Попробуйте позже.',
};

function App() {
  const [theme, setTheme] = useState(() => window.lwLoad(LW_KEYS.theme, 'light'));
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = signed out
  const [userDoc, setUserDoc] = useState(null);
  const [groups, setGroups] = useState([]);
  const [words, setWords] = useState([]);
  const [view, setView] = useState('study');
  const [selected, setSelected] = useState(() => window.lwLoad(LW_KEYS.selected, null) || []);
  const [direction, setDirection] = useState(() => window.lwLoad(LW_KEYS.direction, 'en-ru'));
  const [studyStats, setStudyStats] = useState({ knownCount: 0, poolCount: 0, groupCount: 0 });
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [geminiKeyOpen, setGeminiKeyOpen] = useState(false);
  /* Reading practice state lives here so it survives switching tabs.
     status/error live here too (not inside ReadingView) so that a generation
     started on the reading tab keeps running — and stays visible — even after
     the user navigates away and comes back. */
  const [reading, setReading] = useState({ result: null, flipped: false, status: 'idle', error: null });
  const [toasts, setToasts] = useState([]);
  /* monotonically increasing id: lets us ignore a stale response when the user
     kicks off a newer generation ("Другой текст") before the previous resolves. */
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
  const startReadingGeneration = useCallback(({ picked, level, topicPrompt, lengthWords }) => {
    const myGen = ++genIdRef.current;
    setReading((r) => ({ ...r, result: null, flipped: false, status: 'loading', error: null }));
    window.lwAiGenerateText(picked, level, topicPrompt, lengthWords)
      .then((r) => {
        if (genIdRef.current !== myGen) return; // superseded by a newer request
        setReading({ result: { ...r, source: picked }, flipped: true, status: 'idle', error: null });
        pushToast({
          kind: 'success',
          title: 'Текст готов',
          msg: 'Откройте вкладку «Чтение», чтобы прочитать его.',
          action: { label: 'Открыть', view: 'reading' },
        });
      })
      .catch((e) => {
        if (genIdRef.current !== myGen) return;
        const code = (e && e.code) || 'error';
        setReading((r) => ({ ...r, status: 'idle', error: code }));
        pushToast({
          kind: 'error',
          title: 'Не удалось сгенерировать текст',
          msg: LW_READING_ERROR_MSG[code] || LW_READING_ERROR_MSG.error,
          action: { label: 'К настройкам', view: 'reading' },
        });
      });
  }, [pushToast]);

  /* auth state */
  useEffect(() => window.lwWatchAuth(setAuthUser), []);

  /* user profile (role, lang) */
  useEffect(() => {
    if (!authUser) { setUserDoc(null); return; }
    return window.lwWatchUserDoc(authUser.uid, setUserDoc);
  }, [authUser]);

  const lang = userDoc ? userDoc.lang : null;
  const setLang = useCallback((l) => {
    if (!authUser || !userDoc) return;
    window.lwSetDoc(window.LW_COLLECTIONS.users, { ...userDoc, id: authUser.uid, lang: l });
  }, [authUser, userDoc]);

  /* live sync with this user's Firestore data */
  useEffect(() => {
    if (!authUser) { setGroups([]); setWords([]); return; }
    const unsubGroups = window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.groups, authUser.uid, setGroups);
    const unsubWords = window.lwWatchUserAndSharedCollection(window.LW_COLLECTIONS.words, authUser.uid, setWords);
    return () => { unsubGroups(); unsubWords(); };
  }, [authUser]);

  /* persistence (local-only settings) */
  useEffect(() => { document.documentElement.dataset.theme = theme; window.lwSave(LW_KEYS.theme, theme); }, [theme]);
  useEffect(() => { window.lwSave(LW_KEYS.selected, selected); }, [selected]);
  useEffect(() => { window.lwSave(LW_KEYS.direction, direction); }, [direction]);

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

  const scopedGroups = groups;
  const scopedWords = words;
  const scopedSelected = selected;
  const scopedCountByGroup = countByGroup;

  /* horizontal swipe between Library / Category / Study */
  const swipeRef = useRef(null);
  const onSwipeStart = (e) => {
    if (e.target.closest('.card-scene, .chip, .btn, .input, button, .grp-toggle')) return;
    swipeRef.current = { startX: e.clientX, startY: e.clientY };
  };
  const onSwipeEnd = (e) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = LW_VIEW_ORDER.indexOf(view);
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < LW_VIEW_ORDER.length) setView(LW_VIEW_ORDER[nextIdx]);
  };

  if (authUser === undefined) {
    return null; /* firebase auth still initializing */
  }
  if (authUser === null) {
    return <AuthView />;
  }
  if (!userDoc) {
    return null; /* user profile still loading */
  }
  if (!lang) {
    return <LanguageSelectView onSelect={setLang} />;
  }

  return (
    <div className="app">
      <TopBar view={view} setView={setView} theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        direction={direction} setDirection={setDirection}
        lang={lang} setLang={setLang}
        username={userDoc.username} role={userDoc.role} onLogout={() => window.lwLogout()}
        onGeminiKey={() => setGeminiKeyOpen(true)}
        onDeleteAccount={() => setDeleteAccountOpen(true)} />
      <main className="content" onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd}>
        {view === 'study' ? (
          <StudyView groups={scopedGroups} words={scopedWords} selected={scopedSelected}
            groupById={groupById} onStatsChange={setStudyStats}
            direction={direction}
            goLibrary={() => setView('library')} goCategory={() => setView('category')} />
        ) : view === 'choice' ? (
          <ChoiceView words={scopedWords} selected={scopedSelected} groupById={groupById}
            direction={direction}
            goLibrary={() => setView('library')} goCategory={() => setView('category')} />
        ) : view === 'reading' ? (
          <ReadingView groups={scopedGroups} words={scopedWords} countByGroup={scopedCountByGroup}
            reading={reading} setReading={setReading}
            startGenerate={startReadingGeneration}
            goLibrary={() => setView('library')} />
        ) : view === 'library' ? (
          <LibraryView groups={scopedGroups} words={scopedWords} userId={authUser.uid} username={userDoc.username} isAdmin={userDoc.role === 'admin'} />
        ) : view === 'admin' ? (
          <AdminView currentUid={authUser.uid} />
        ) : (
          <CategoryView groups={scopedGroups} selected={scopedSelected} setSelected={setSelected}
            countByGroup={scopedCountByGroup} goStudy={() => setView('study')} />
        )}
      </main>
      {view === 'study' && studyStats.poolCount > 0 && (
        <footer className="appfooter">
          {studyStats.knownCount} / {studyStats.poolCount} known · {studyStats.poolCount} words · {studyStats.groupCount} {studyStats.groupCount === 1 ? 'group' : 'groups'}
          <ViewDots view={view} setView={setView} />
        </footer>
      )}
      {view === 'choice' && (
        <footer className="appfooter">
          {scopedWords.filter((w) => scopedSelected.includes(w.groupId)).length} words · {scopedSelected.length} {scopedSelected.length === 1 ? 'group' : 'groups'}
          <ViewDots view={view} setView={setView} />
        </footer>
      )}
      {view === 'reading' && (
        <footer className="appfooter">
          AI reading practice
          <ViewDots view={view} setView={setView} />
        </footer>
      )}
      {view === 'category' && (
        <footer className="appfooter">
          {scopedSelected.length} {scopedSelected.length === 1 ? 'group' : 'groups'} selected
          <ViewDots view={view} setView={setView} />
        </footer>
      )}
      {view === 'library' && (
        <footer className="appfooter">
          {scopedWords.length} words across {scopedGroups.filter((g) => !g.parentId).length} groups
          <ViewDots view={view} setView={setView} />
        </footer>
      )}
      {deleteAccountOpen && <DeleteAccountModal onClose={() => setDeleteAccountOpen(false)} />}
      {geminiKeyOpen && <GeminiKeyModal onClose={() => setGeminiKeyOpen(false)} />}
      <ToastStack toasts={toasts}
        onDismiss={dismissToast}
        onAction={(action) => { if (action && action.view) setView(action.view); }} />
    </div>
  );
}

/* ---------------- Delete account confirmation ---------------- */
function DeleteAccountModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await window.lwDeleteAccount(password);
      try {
        localStorage.removeItem(LW_KEYS.studySession);
        localStorage.removeItem(LW_KEYS.selected);
      } catch (e) { /* ignore */ }
      /* onAuthStateChanged in App unmounts the signed-in UI from here */
    } catch (err) {
      const code = err && err.code;
      setError(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'Неверный пароль.'
        : 'Не удалось удалить аккаунт. Попробуйте ещё раз.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Удалить аккаунт" onClose={busy ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Отмена</button>
        <button className="btn btn-danger" onClick={submit} disabled={!password || busy}>
          {busy ? 'Удаление…' : 'Удалить навсегда'}
        </button>
      </>}>
      <p className="confirm-text">
        Будут безвозвратно удалены <strong>все ваши слова, группы и профиль</strong>.
        Отменить это действие невозможно. Для подтверждения введите пароль.
      </p>
      <label className="field">
        <span className="field-label">Пароль</span>
        <input className="input" type="password" value={password} autoFocus autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </label>
      {error && <p className="field-hint" style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</p>}
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
      <button type="button" className="toast-close" aria-label="Закрыть" onClick={close}>
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

/* ---------------- View position dots (swipe hint) ---------------- */
function ViewDots({ view, setView }) {
  const idx = LW_VIEW_ORDER.indexOf(view);
  return (
    <div className="view-dots">
      {LW_VIEW_ORDER.map((v, i) => (
        <button key={v} className={'view-dot' + (i === idx ? ' on' : '')} aria-label={v} onClick={() => setView(v)} type="button" />
      ))}
    </div>
  );
}

/* ---------------- Top bar ---------------- */
const LW_ROLE_LABEL = { admin: 'Admin', premium: 'Premium', user: 'User' };

function TopBar({ view, setView, theme, onToggleTheme, direction, setDirection, lang, setLang, username, role, onLogout, onGeminiKey, onDeleteAccount }) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const ref = useRef(null);
  const currentLang = LW_LANGUAGES.find((l) => l.code === lang);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (v) => { setView(v); setOpen(false); setLangOpen(false); };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-name">Lexicon</span>
      </div>
      <div className="menu-wrap" ref={ref}>
        <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          <Ic.Menu />
        </button>
        {open && (
          <div className="menu-dropdown">
            <button className={'menu-item' + (view === 'study' ? ' on' : '')} onClick={() => go('study')}>
              <Ic.Cards /> Study
            </button>
            <button className={'menu-item' + (view === 'choice' ? ' on' : '')} onClick={() => go('choice')}>
              <Ic.ListCheck /> Choice
            </button>
            <button className={'menu-item' + (view === 'reading' ? ' on' : '')} onClick={() => go('reading')}>
              <Ic.Book /> Reading
            </button>
            <button className={'menu-item' + (view === 'category' ? ' on' : '')} onClick={() => go('category')}>
              <Ic.Tag /> Category
            </button>
            <button className={'menu-item' + (view === 'library' ? ' on' : '')} onClick={() => go('library')}>
              <Ic.Library /> Library
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => setDirection(direction === 'en-ru' ? 'ru-en' : 'en-ru')} type="button">
              <Ic.Swap /> {direction === 'en-ru' ? 'EN → RU' : 'RU → EN'}
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => setLangOpen((o) => !o)} type="button">
              <span>{currentLang ? currentLang.flag : '🌐'}</span> {currentLang ? currentLang.name : 'Language'}
            </button>
            {langOpen && (
              <div className="menu-sub">
                {LW_LANGUAGES.filter((l) => l.code !== lang).map((l) => (
                  <button key={l.code} className="menu-item"
                    onClick={() => { setLang(l.code); setLangOpen(false); setOpen(false); }} type="button">
                    <span>{l.flag}</span> {l.name}
                  </button>
                ))}
              </div>
            )}
            <div className="menu-sep" />
            <button className="menu-item" onClick={onToggleTheme}>
              {theme === 'light' ? <Ic.Moon /> : <Ic.Sun />}
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { onGeminiKey(); setOpen(false); }} type="button">
              <Ic.Bulb /> Ключ Gemini (AI)
            </button>
            {role === 'admin' && (
              <>
                <div className="menu-sep" />
                <button className={'menu-item' + (view === 'admin' ? ' on' : '')} onClick={() => go('admin')} type="button">
                  <Ic.Tag /> Admin
                </button>
              </>
            )}
            <div className="menu-sep" />
            <div className="menu-item" style={{ cursor: 'default' }}>
              {username}{role && role !== 'user' ? ` · ${LW_ROLE_LABEL[role] || role}` : ''}
            </div>
            <button className="menu-item" onClick={() => { onLogout(); setOpen(false); }} type="button">
              Выйти
            </button>
            <button className="menu-item" style={{ color: 'var(--danger)' }}
              onClick={() => { onDeleteAccount(); setOpen(false); }} type="button">
              Удалить аккаунт
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------------- Study view ---------------- */
function StudyView({ groups, words, selected, groupById, onStatsChange, direction, goLibrary, goCategory }) {
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
    setProgress((p) => ({ ...p, [current]: status }));
    const nq = status === 'unknown' ? [...queue, current] : queue;
    advance(nq);
  }, [current, queue, advance, draw]);

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
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck} />
        ) : allDone ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">Все слова изучены!</p>
            <p className="empty-sub">{pool.length} / {pool.length} known</p>
            <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Начать заново</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Cards width="30" height="30" />
            <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
            <p className="empty-sub">{selected.length === 0 ? 'Pick one or more groups in Category.' : 'Add words to these groups in the Library.'}</p>
            {selected.length === 0 ? (
              <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose categories</button>
            ) : (
              <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Choice view (multiple-choice translation quiz) ---------------- */
const CHOICE_OPTIONS = 4;
const CHOICE_ADVANCE_DELAY = 700;

function ChoiceView({ words, selected, groupById, direction, goLibrary, goCategory }) {
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
    advanceTimer.current = setTimeout(advance, CHOICE_ADVANCE_DELAY);
  }, [pickedId, current, advance]);

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
            <div className="choice-tag"><span className="dot" style={{ background: group.color }} />{group.name}</div>
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
          <p className="empty-title">Раунд завершён!</p>
          <p className="empty-sub">{correctCount} / {answeredCount} correct</p>
          <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Начать заново</button>
        </div>
      ) : (
        <div className="empty-card">
          <Ic.ListCheck width="30" height="30" />
          <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
          <p className="empty-sub">{selected.length === 0 ? 'Pick one or more groups in Category.' : 'Add words to these groups in the Library.'}</p>
          {selected.length === 0 ? (
            <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose categories</button>
          ) : (
            <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Reading view (AI-generated text from a category) ---------------- */
const READING_WORD_COUNTS = [15, 25, 40, 60];

/* split a base word into forms we highlight (plural/verb endings) */
function readingWordForms(word) {
  const w = String(word || '').toLowerCase().trim();
  if (!w) return [];
  const forms = new Set([w]);
  forms.add(w + 's');
  forms.add(w + 'es');
  forms.add(w + 'ed');
  forms.add(w + 'ing');
  if (w.endsWith('e')) { forms.add(w.slice(0, -1) + 'ing'); forms.add(w + 'd'); }
  if (w.endsWith('y')) { forms.add(w.slice(0, -1) + 'ies'); forms.add(w.slice(0, -1) + 'ied'); }
  return [...forms];
}

/* render a sentence, wrapping tokens that match the active highlighted word in <mark> */
function ReadingSentenceText({ text, highlight }) {
  if (!highlight) return text;
  const forms = new Set(readingWordForms(highlight));
  /* split keeping delimiters (non-letters) so we can re-join verbatim */
  const parts = text.split(/([A-Za-z’']+)/);
  return parts.map((part, i) => {
    if (i % 2 === 1 && forms.has(part.toLowerCase())) {
      return <mark key={i} className="reading-hl">{part}</mark>;
    }
    return part;
  });
}

function ReadingView({ groups, words, countByGroup, reading, setReading, startGenerate, goLibrary }) {
  const leafGroups = useMemo(
    () => (window.lwLeafGroups ? window.lwLeafGroups(groups) : groups).filter((g) => countByGroup[g.id] > 0),
    [groups, countByGroup]
  );

  const [groupId, setGroupId] = useState('');
  const [level, setLevel] = useState('B1');
  const [topicId, setTopicId] = useState(LW_TEXT_TOPICS[0].id);
  const [lengthId, setLengthId] = useState('medium');
  const [wordCount, setWordCount] = useState(25);
  const [keyModal, setKeyModal] = useState(false);

  /* transient UI state for the text side */
  const [activeWord, setActiveWord] = useState(null);   // word highlighted in the text
  const [openSentence, setOpenSentence] = useState(-1); // index of sentence whose RU is shown
  const [showFullRu, setShowFullRu] = useState(false);  // lightbulb: whole-text translation

  const result = reading.result;
  const flipped = reading.flipped;
  /* generation status/error live in App (survive tab switches) */
  const state = reading.status === 'loading' ? 'loading' : (reading.error || 'idle');

  /* default to the first available category once groups load */
  useEffect(() => {
    if (!groupId && leafGroups.length) setGroupId(leafGroups[0].id);
  }, [leafGroups, groupId]);

  const activeGroup = leafGroups.find((g) => g.id === groupId) || null;
  const groupWords = useMemo(
    () => (activeGroup ? words.filter((w) => w.groupId === activeGroup.id) : []),
    [words, activeGroup]
  );

  const resetTextUi = () => { setActiveWord(null); setOpenSentence(-1); setShowFullRu(false); };

  const runGenerate = () => {
    if (!activeGroup || reading.status === 'loading') return;
    const picked = shuffle(groupWords.map((w) => w.word)).slice(0, wordCount);
    if (!picked.length) {
      setReading((r) => ({ ...r, error: 'empty' }));
      return;
    }
    const topic = LW_TEXT_TOPICS.find((t) => t.id === topicId) || LW_TEXT_TOPICS[0];
    const length = LW_TEXT_LENGTHS.find((l) => l.id === lengthId) || LW_TEXT_LENGTHS[1];
    resetTextUi();
    /* fire-and-forget: App owns the promise and the toast on completion */
    startGenerate({ picked, level, topicPrompt: topic.prompt, lengthWords: length.words });
  };

  const generate = () => {
    if (!activeGroup) return;
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; }
    runGenerate();
  };

  /* "Прочитано": clear the text and flip back to settings */
  const markRead = () => {
    resetTextUi();
    setReading({ result: null, flipped: false, status: 'idle', error: null });
  };

  if (leafGroups.length === 0) {
    return (
      <div className="reading">
        <div className="empty-card">
          <Ic.Book width="30" height="30" />
          <p className="empty-title">No words yet</p>
          <p className="empty-sub">Add words to a category first, then generate a text from them.</p>
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
      <div className={'reading-scene' + (flipped ? ' is-flipped' : '')}>
        <div className="reading-inner">
          {/* ---------- FRONT: settings ---------- */}
          <div className="reading-face reading-front">
            <div className="reading-controls">
              <label className="field">
                <span className="field-label">Category</span>
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {leafGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({countByGroup[g.id]})</option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span className="field-label">Level (CEFR)</span>
                <div className="seg">
                  {LW_CEFR_LEVELS.map((lv) => (
                    <button key={lv} type="button" className={'seg-btn' + (level === lv ? ' on' : '')}
                      onClick={() => setLevel(lv)}>{lv}</button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="field-label">Topic</span>
                <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  {LW_TEXT_TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span className="field-label">Length</span>
                <div className="seg">
                  {LW_TEXT_LENGTHS.map((l) => (
                    <button key={l.id} type="button" className={'seg-btn' + (lengthId === l.id ? ' on' : '')}
                      onClick={() => setLengthId(l.id)}>{l.name}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Words from category</span>
                <div className="seg">
                  {READING_WORD_COUNTS.map((n) => (
                    <button key={n} type="button" className={'seg-btn' + (wordCount === n ? ' on' : '')}
                      onClick={() => setWordCount(n)}>{n}</button>
                  ))}
                </div>
                {activeGroup && groupWords.length < wordCount && (
                  <p className="field-hint">В категории {groupWords.length} слов — возьмём все.</p>
                )}
              </div>

              <button className="btn btn-primary btn-cta-study" disabled={state === 'loading' || !activeGroup}
                onClick={generate}>
                {state === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="16" height="16" />}
                {state === 'loading' ? 'Генерирую текст…' : 'Сгенерировать текст'}
              </button>

              {result && state !== 'loading' && (
                <button className="btn btn-soft btn-cta-study" type="button"
                  onClick={() => setReading((r) => ({ ...r, flipped: true }))}>
                  <Ic.Book width="16" height="16" /> Вернуться к тексту
                </button>
              )}

              {state === 'bad-key' ? (
                <p className="field-hint">Ключ Gemini недействителен.{' '}
                  <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Изменить ключ</button>
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
                  {result.title && <h2 className="reading-title">{result.title}</h2>}
                  <button className="reading-bulb" type="button" title="Перевод всего текста"
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
                    <span className="field-label">Слова из категории (нажмите, чтобы подсветить):</span>
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

                <div className="reading-actions">
                  <button className="btn btn-primary sm" onClick={markRead} type="button">
                    <Ic.Check width="15" height="15" /> Прочитано
                  </button>
                  <button className="btn btn-soft sm" onClick={runGenerate} type="button" disabled={state === 'loading'}>
                    <Ic.Shuffle width="15" height="15" /> Другой текст
                  </button>
                  <button className="btn btn-ghost sm" type="button"
                    onClick={() => setReading((r) => ({ ...r, flipped: false }))}>
                    <Ic.Swap width="15" height="15" /> Настройки
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
function CategoryView({ groups, selected, setSelected, countByGroup, goStudy }) {
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
        Start studying
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
      .catch(() => setError('Не удалось загрузить пользователей.'));
  }, []);

  const loadAllData = useCallback(() => {
    setError('');
    window.lwAdminFetchAllData()
      .then(setAllData)
      .catch(() => setError('Не удалось загрузить слова и категории.'));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === 'data' && !allData) loadAllData(); }, [tab, allData, loadAllData]);

  const changeRole = async (uid, role) => {
    setSavingId(uid);
    try {
      await window.lwAdminSetRole(uid, role);
      setUsers((list) => list.map((u) => (u.id === uid ? { ...u, role } : u)));
    } catch (e) {
      setError('Не удалось изменить роль.');
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
          <p className="lib-sub">{tab === 'users' ? 'Пользователи и роли' : 'Все слова и категории'}</p>
        </div>
        <div className="lib-head-actions">
          <div className="seg">
            <button className={'seg-btn' + (tab === 'users' ? ' on' : '')} onClick={() => setTab('users')} type="button">Пользователи</button>
            <button className={'seg-btn' + (tab === 'data' ? ' on' : '')} onClick={() => setTab('data')} type="button">Все слова и категории</button>
          </div>
          <button className="btn btn-soft" onClick={reload} type="button"><Ic.Shuffle /> Обновить</button>
        </div>
      </div>
      {error && <p className="field-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
      {tab === 'users' ? (
        users === null ? (
          <p className="row-empty">Загрузка…</p>
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
            {users.length === 0 && <p className="row-empty">Пользователей пока нет.</p>}
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

  if (!data) return <p className="row-empty">Загрузка…</p>;
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

  if (groups.length === 0) return <p className="row-empty">Категорий пока нет.</p>;

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
              <span className="grp-count">{(wordsByGroup[g.id] || []).length} words · добавил: {ownerLabel(g)}</span>
            </button>
            <div className="grp-tools">
              {!g.shared && <button className="btn btn-soft sm" onClick={() => makeGroupShared(g)} type="button">Сделать общим</button>}
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
                <span className="grp-count">добавил: {ownerLabel(w)}</span>
                <div className="wrow-tools">
                  {!w.shared && <button className="btn btn-soft sm" onClick={() => makeWordShared(w)} type="button">Сделать общим</button>}
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

/* ---------------- Library view ---------------- */
function LibraryView({ groups, words, userId, username, isAdmin }) {
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?, parentGroup?}
  const [importModal, setImportModal] = useState(null); // {groupId?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);
  const [query, setQuery] = useState('');

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const topGroups = groups.filter((g) => !g.parentId);
  const subGroupsOf = (id) => groups.filter((g) => g.parentId === id);
  const groupById = (id) => groups.find((g) => g.id === id);

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? words.filter((w) => w.word.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q)))
    : null;

  const canEdit = (item) => item.userId === userId || isAdmin;

  const saveWord = (w) => {
    // Существующее слово определяем по наличию в списке, а не по w.id — форма
    // всегда генерирует id, в т.ч. для новых слов, где userId/username ещё нет.
    const existing = words.find((x) => x.id === w.id);
    const shared = existing ? existing.shared : isAdmin;
    window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, userId: existing ? existing.userId : userId, username: existing ? existing.username : username, shared })
      .catch((e) => { console.error('saveWord failed', e); alert('Не удалось сохранить слово: ' + (e && e.message || e)); });
    setWordModal(null);
  };
  const saveGroup = (g) => {
    const existing = groups.find((x) => x.id === g.id);
    const shared = existing ? existing.shared : isAdmin;
    window.lwSetDoc(window.LW_COLLECTIONS.groups, { ...g, userId: existing ? existing.userId : userId, username: existing ? existing.username : username, shared })
      .catch((e) => { console.error('saveGroup failed', e); alert('Не удалось сохранить группу: ' + (e && e.message || e)); });
    if (!openGroups.includes(g.id)) setOpenGroups((o) => [...o, g.id]);
    if (g.parentId && !openGroups.includes(g.parentId)) setOpenGroups((o) => [...o, g.parentId]);
    setGroupModal(null);
  };
  const importWords = (items) => {
    items.forEach((w) => window.lwSetDoc(window.LW_COLLECTIONS.words, { ...w, userId, username, shared: isAdmin })
      .catch((e) => { console.error('importWords failed', e); alert('Не удалось импортировать слово: ' + (e && e.message || e)); }));
    setImportModal(null);
  };
  const doDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'word') window.lwDeleteDoc(window.LW_COLLECTIONS.words, confirm.id);
    if (confirm.kind === 'group') {
      const ids = [confirm.id, ...subGroupsOf(confirm.id).map((sg) => sg.id)];
      ids.forEach((id) => {
        window.lwDeleteDoc(window.LW_COLLECTIONS.groups, id);
        window.lwDeleteWordsByGroup(id, isAdmin ? null : userId);
      });
    }
    setConfirm(null);
  };

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
      <div className="lib-head">
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder="Search words or translations…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={() => setImportModal({})}><Ic.Plus /> Import</button>
          <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
        </div>
      </div>

      {searchResults ? (
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
                      { label: 'Import', icon: <Ic.Plus width="15" height="15" />, onClick: () => setImportModal({ groupId: g.id }) },
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
                              { label: 'Import', icon: <Ic.Plus width="15" height="15" />, onClick: () => setImportModal({ groupId: sg.id }) },
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

      {wordModal && (
        <Modal title={wordModal.mode === 'edit' ? 'Edit word' : 'New word'} onClose={() => setWordModal(null)}>
          <WordForm initial={wordModal.initial} groups={groups} defaultGroupId={wordModal.groupId}
            onSave={saveWord} onCancel={() => setWordModal(null)} />
        </Modal>
      )}
      {importModal && (
        <Modal title="Import words" onClose={() => setImportModal(null)}>
          <ImportForm groups={groups} defaultGroupId={importModal.groupId}
            onImport={importWords} onCancel={() => setImportModal(null)} />
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
const LW_PALETTE = ['#E8552F', '#2F9E8F', '#5B6CE8', '#C9913B', '#B7409B', '#3E8ED0', '#5BA02E', '#D6453E'];
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
          Подгруппа группы <strong>{parentGroup.name}</strong>
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
        <p className="lang-select-title">Какой язык вы изучаете?</p>
        <p className="lang-select-sub">Этот выбор можно изменить позже в меню.</p>
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
