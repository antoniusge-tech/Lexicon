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

function App() {
  const [theme, setTheme] = useState(() => window.lwLoad(LW_KEYS.theme, 'light'));
  const [groups, setGroups] = useState([]);
  const [words, setWords] = useState([]);
  const [view, setView] = useState('study');
  const [selected, setSelected] = useState(() => window.lwLoad(LW_KEYS.selected, null) || []);
  const [direction, setDirection] = useState(() => window.lwLoad(LW_KEYS.direction, 'en-ru'));
  const [studyStats, setStudyStats] = useState({ knownCount: 0, poolCount: 0, groupCount: 0 });

  /* live sync with shared Firestore data */
  useEffect(() => {
    const unsubGroups = window.lwWatchCollection(window.LW_COLLECTIONS.groups, setGroups);
    const unsubWords = window.lwWatchCollection(window.LW_COLLECTIONS.words, setWords);
    return () => { unsubGroups(); unsubWords(); };
  }, []);

  /* default selection: everything, once groups load (only if user never picked) */
  const hasSavedSelection = useRef(window.lwLoad(LW_KEYS.selected, null) != null);
  useEffect(() => {
    if (!hasSavedSelection.current && groups.length) {
      setSelected(groups.map((g) => g.id));
    }
  }, [groups]);

  /* persistence (local-only settings) */
  useEffect(() => { document.documentElement.dataset.theme = theme; window.lwSave(LW_KEYS.theme, theme); }, [theme]);
  useEffect(() => { window.lwSave(LW_KEYS.selected, selected); }, [selected]);
  useEffect(() => { window.lwSave(LW_KEYS.direction, direction); }, [direction]);

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

  return (
    <div className="app">
      <TopBar view={view} setView={setView} theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        direction={direction} setDirection={setDirection} />
      <main className="content">
        {view === 'study' ? (
          <StudyView groups={groups} words={words} selected={selected}
            groupById={groupById} onStatsChange={setStudyStats}
            direction={direction}
            goLibrary={() => setView('library')} goCategory={() => setView('category')} />
        ) : view === 'library' ? (
          <LibraryView groups={groups} words={words} />
        ) : (
          <CategoryView groups={groups} selected={selected} setSelected={setSelected}
            countByGroup={countByGroup} goStudy={() => setView('study')} />
        )}
      </main>
      {view === 'study' && studyStats.poolCount > 0 && (
        <footer className="appfooter">
          {studyStats.knownCount} / {studyStats.poolCount} known · {studyStats.poolCount} words · {studyStats.groupCount} {studyStats.groupCount === 1 ? 'group' : 'groups'}
        </footer>
      )}
      {view === 'category' && (
        <footer className="appfooter">
          {selected.length} {selected.length === 1 ? 'group' : 'groups'} selected
        </footer>
      )}
      {view === 'library' && (
        <footer className="appfooter">
          {words.length} words across {groups.filter((g) => !g.parentId).length} groups
        </footer>
      )}
    </div>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar({ view, setView, theme, onToggleTheme, direction, setDirection }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (v) => { setView(v); setOpen(false); };

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
            <button className="menu-item" onClick={onToggleTheme}>
              {theme === 'light' ? <Ic.Moon /> : <Ic.Sun />}
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
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

/* ---------------- Category view ---------------- */
function CategoryView({ groups, selected, setSelected, countByGroup, goStudy }) {
  const toggle = (id) => {
    const wasEmpty = selected.length === 0;
    const turningOn = !selected.includes(id);
    setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
    if (wasEmpty && turningOn && countByGroup[id] > 0) goStudy();
  };
  const allOn = selected.length === groups.length && groups.length > 0;
  const toggleAll = () => {
    const wasEmpty = selected.length === 0;
    const turningOn = !allOn;
    setSelected(allOn ? [] : groups.map((g) => g.id));
    if (wasEmpty && turningOn && groups.some((g) => countByGroup[g.id] > 0)) goStudy();
  };

  return (
    <div className="category">
      <div className="selector">
        <div className="chips">
          <button className={'chip chip-all' + (allOn ? ' chip-on' : '')} onClick={toggleAll} type="button">
            All
          </button>
          {groups.map((g) => (
            <GroupChip key={g.id} group={g} count={countByGroup[g.id] || 0}
              active={selected.includes(g.id)} onToggle={() => toggle(g.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Library view ---------------- */
function LibraryView({ groups, words }) {
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?, parentGroup?}
  const [importModal, setImportModal] = useState(null); // {groupId?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const topGroups = groups.filter((g) => !g.parentId);
  const subGroupsOf = (id) => groups.filter((g) => g.parentId === id);

  const saveWord = (w) => {
    window.lwSetDoc(window.LW_COLLECTIONS.words, w);
    setWordModal(null);
  };
  const saveGroup = (g) => {
    window.lwSetDoc(window.LW_COLLECTIONS.groups, g);
    if (!openGroups.includes(g.id)) setOpenGroups((o) => [...o, g.id]);
    if (g.parentId && !openGroups.includes(g.parentId)) setOpenGroups((o) => [...o, g.parentId]);
    setGroupModal(null);
  };
  const importWords = (items) => {
    items.forEach((w) => window.lwSetDoc(window.LW_COLLECTIONS.words, w));
    setImportModal(null);
  };
  const doDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'word') window.lwDeleteDoc(window.LW_COLLECTIONS.words, confirm.id);
    if (confirm.kind === 'group') {
      const ids = [confirm.id, ...subGroupsOf(confirm.id).map((sg) => sg.id)];
      ids.forEach((id) => {
        window.lwDeleteDoc(window.LW_COLLECTIONS.groups, id);
        window.lwDeleteWordsByGroup(id);
      });
    }
    setConfirm(null);
  };

  const renderWords = (items, hue, showEmptyHint = true) => (
    <div className="word-rows">
      {items.length === 0 && showEmptyHint && <div className="row-empty">No words yet — add the first one.</div>}
      {items.map((w) => (
        <div className="wrow" key={w.id}>
          <div className="wrow-thumb">{w.photo ? <img className="card-photo-img" src={w.photo} alt="" /> : <PhotoFill word={w.word} hue={hue} />}</div>
          <div className="wrow-main">
            <div className="wrow-top"><span className="wrow-word">{w.word}</span><span className="wrow-ipa">{w.ipa}</span></div>
            <div className="wrow-tr">{w.tr}</div>
          </div>
          <div className="wrow-tools">
            <button className="icon-btn sm" onClick={() => setWordModal({ mode: 'edit', initial: w })} aria-label="Edit"><Ic.Edit /></button>
            <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} aria-label="Delete"><Ic.Trash /></button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="library">
      <div className="lib-head">
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={() => setImportModal({})}><Ic.Plus /> Import</button>
          <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
        </div>
      </div>

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
                    { label: 'Edit group', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: g }) },
                    { label: 'Delete group', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: g.id, label: g.name }) },
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
                              { label: 'Edit subgroup', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: sg }) },
                              { label: 'Delete subgroup', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: sg.id, label: sg.name }) },
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
    onSave({ id: initial ? initial.id : window.lwUid(), name: name.trim(), color, ...(parentId ? { parentId } : {}) });
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

Object.assign(window, { App, GroupForm });
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
