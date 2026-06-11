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

  /* keep selection valid if a group is deleted */
  useEffect(() => {
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
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      <main className="content">
        {view === 'study' ? (
          <StudyView groups={groups} words={words} selected={selected} setSelected={setSelected}
            countByGroup={countByGroup} groupById={groupById} goLibrary={() => setView('library')} />
        ) : (
          <LibraryView groups={groups} words={words} countByGroup={countByGroup} />
        )}
      </main>
    </div>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar({ view, setView, theme, onToggleTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Ic.Cards width="17" height="17" /></span>
        <span className="brand-name">Lexicon</span>
      </div>
      <nav className="nav">
        <button className={'nav-btn' + (view === 'study' ? ' on' : '')} onClick={() => setView('study')}>
          <Ic.Cards /> Study
        </button>
        <button className={'nav-btn' + (view === 'library' ? ' on' : '')} onClick={() => setView('library')}>
          <Ic.Library /> Library
        </button>
      </nav>
      <button className="icon-btn theme-btn" onClick={onToggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? <Ic.Moon /> : <Ic.Sun />}
      </button>
    </header>
  );
}

/* ---------------- Study view ---------------- */
function StudyView({ groups, words, selected, setSelected, countByGroup, groupById, goLibrary }) {
  const pool = useMemo(() => words.filter((w) => selected.includes(w.groupId)), [words, selected]);

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const lastId = useRef(null);

  const buildQueue = useCallback((exclude) => {
    let ids = pool.map((w) => w.id);
    ids = shuffle(ids);
    if (exclude && ids.length > 1 && ids[0] === exclude) {
      ids.push(ids.shift());
    }
    return ids;
  }, [pool]);

  const draw = useCallback(() => {
    setFlipped(false);
    setQueue((q) => {
      let nq = q.slice();
      if (nq.length === 0) nq = buildQueue(lastId.current);
      const id = nq.shift();
      lastId.current = id;
      setCurrent(id || null);
      return nq;
    });
  }, [buildQueue]);

  /* reset when pool identity changes */
  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    const ids = pool.map((w) => w.id);
    if (ids.length === 0) { setCurrent(null); setQueue([]); return; }
    if (!current || !ids.includes(current)) {
      const q = buildQueue(null);
      const first = q.shift();
      lastId.current = first;
      setCurrent(first);
      setQueue(q);
      setFlipped(false);
    }
    // eslint-disable-next-line
  }, [poolKey]);

  /* keyboard */
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); draw(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [draw]);

  const toggle = (id) => {
    setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };
  const allOn = selected.length === groups.length && groups.length > 0;
  const toggleAll = () => setSelected(allOn ? [] : groups.map((g) => g.id));

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;

  return (
    <div className="study">
      <div className="selector">
        <div className="selector-head">
          <span className="selector-title">Studying</span>
          <span className="selector-sub">{pool.length} words · {selected.length} {selected.length === 1 ? 'group' : 'groups'}</span>
        </div>
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

      <div className="stage">
        {entry ? (
          <Flashcard entry={entry} group={group} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        ) : (
          <div className="empty-card">
            <Ic.Cards width="30" height="30" />
            <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
            <p className="empty-sub">{selected.length === 0 ? 'Pick one or more groups above.' : 'Add words to these groups in the Library.'}</p>
            {selected.length > 0 && <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>}
          </div>
        )}
      </div>

      {entry && (
        <div className="controls">
          <button className="btn btn-ghost" onClick={draw} title="Random next (→)"><Ic.Shuffle /> Shuffle</button>
          <button className="btn btn-primary lg" onClick={draw} title="Next (→)">Next <Ic.Arrow /></button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Library view ---------------- */
function LibraryView({ groups, words, countByGroup }) {
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?}
  const [importModal, setImportModal] = useState(null); // {groupId?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState(() => groups.map((g) => g.id));

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const saveWord = (w) => {
    window.lwSetDoc(window.LW_COLLECTIONS.words, w);
    setWordModal(null);
  };
  const saveGroup = (g) => {
    window.lwSetDoc(window.LW_COLLECTIONS.groups, g);
    if (!openGroups.includes(g.id)) setOpenGroups((o) => [...o, g.id]);
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
      window.lwDeleteDoc(window.LW_COLLECTIONS.groups, confirm.id);
      window.lwDeleteWordsByGroup(confirm.id);
    }
    setConfirm(null);
  };

  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h2 className="lib-title">Library</h2>
          <p className="lib-sub">{words.length} words across {groups.length} groups</p>
        </div>
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={() => setImportModal({})}><Ic.Plus /> Import</button>
          <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
        </div>
      </div>

      <div className="groups-list">
        {groups.map((g) => {
          const items = words.filter((w) => w.groupId === g.id);
          const open = openGroups.includes(g.id);
          return (
            <section className="grp" key={g.id}>
              <header className="grp-head">
                <button className="grp-toggle" onClick={() => toggleOpen(g.id)}>
                  <Ic.Chevron style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                  <span className="grp-dot" style={{ background: g.color }} />
                  <span className="grp-name">{g.name}</span>
                  <span className="grp-count">{items.length}</span>
                </button>
                <div className="grp-tools">
                  <button className="btn btn-soft sm" onClick={() => setWordModal({ mode: 'new', groupId: g.id })}><Ic.Plus width="15" height="15" /> Word</button>
                  <button className="btn btn-soft sm" onClick={() => setImportModal({ groupId: g.id })}><Ic.Plus width="15" height="15" /> Import</button>
                  <button className="icon-btn sm" onClick={() => setGroupModal({ mode: 'edit', initial: g })} aria-label="Edit group"><Ic.Edit /></button>
                  <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'group', id: g.id, label: g.name })} aria-label="Delete group"><Ic.Trash /></button>
                </div>
              </header>
              {open && (
                <div className="word-rows">
                  {items.length === 0 && <div className="row-empty">No words yet — add the first one.</div>}
                  {items.map((w) => (
                    <div className="wrow" key={w.id}>
                      <div className="wrow-thumb"><PhotoFill word={w.word} hue={g.color} /></div>
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
        <Modal title={groupModal.mode === 'edit' ? 'Edit group' : 'New group'} onClose={() => setGroupModal(null)}>
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

/* ---------------- Group form ---------------- */
const LW_PALETTE = ['#E8552F', '#2F9E8F', '#5B6CE8', '#C9913B', '#B7409B', '#3E8ED0', '#5BA02E', '#D6453E'];
function GroupForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [color, setColor] = useState(initial ? initial.color : LW_PALETTE[0]);
  const canSave = name.trim();
  const submit = () => {
    if (!canSave) return;
    onSave({ id: initial ? initial.id : window.lwUid(), name: name.trim(), color });
  };
  return (
    <div className="form">
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
