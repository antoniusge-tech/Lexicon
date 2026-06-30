/* components.jsx — icons, flashcard, chips, modals, forms */

/* ---------------- Icons ---------------- */
const Ic = {
  Sun: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>
  ),
  Close: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  Shuffle: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  Image: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>
  ),
  Cards: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="13" height="16" rx="2" /><path d="M8 5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1" /></svg>
  ),
  Library: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4v15.5M6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5" /></svg>
  ),
  Tag: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2H4v8l9.5 9.5a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83L12 2Z" /><circle cx="8" cy="8" r="1.5" /></svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>
  ),
  MoreVertical: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
  ),
  Bulb: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.36.8.93.8 1.6v.5h5.4v-.5c0-.67.3-1.24.8-1.6A6 6 0 0 0 12 3z" />
    </svg>
  ),
  Speaker: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 8a5 5 0 0 1 0 8M19 5a8.5 8.5 0 0 1 0 14" />
    </svg>
  ),
  Menu: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Swap: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 4 4v1" />
      <path d="M17 20l4-4-4-4" /><path d="M21 16H8a4 4 0 0 1-4-4v-1" />
    </svg>
  ),
  ListCheck: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m4 6 1.5 1.5L8 5" /><path d="M11 6h9" />
      <path d="m4 12 1.5 1.5L8 11" /><path d="M11 12h9" />
      <path d="m4 18 1.5 1.5L8 17" /><path d="M11 18h9" />
    </svg>
  ),
};

/* ---------------- Speech synthesis helper ---------------- */
function lwSpeak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
}

/* ---------------- Photo placeholder ---------------- */
function PhotoFill({ word, hue }) {
  return (
    <div className="photo-ph" style={{ '--ph-hue': hue || '#E8552F' }}>
      <Ic.Image className="photo-ph-icon" />
      <span className="photo-ph-label">{word}</span>
    </div>
  );
}

/* ---------------- Flashcard ---------------- */
const SWIPE_THRESHOLD = 100;

function Flashcard({ entry, group, flipped, onFlip, onSwipe, onShuffle, direction = 'en-ru' }) {
  const [drag, setDrag] = React.useState(null); // {startX, startY, dx, dy} or null
  const [flyDir, setFlyDir] = React.useState(null); // 'known' | 'unknown' | null
  const [showExample, setShowExample] = React.useState(false);
  const dragRef = React.useRef(null);
  dragRef.current = drag;

  React.useEffect(() => {
    setFlyDir(null);
    setDrag(null);
    setShowExample(false);
  }, [entry && entry.id]);

  if (!entry) return null;
  const hue = group ? group.color : '#E8552F';

  const onPointerDown = (e) => {
    if (flyDir) return;
    setDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    setDrag({ ...d, dx, dy, moved });
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.dy > SWIPE_THRESHOLD && d.dy > Math.abs(d.dx)) {
      setFlyDir('shuffle');
      setDrag(null);
      setTimeout(() => onShuffle(), 560);
    } else if (-d.dy > SWIPE_THRESHOLD && -d.dy > Math.abs(d.dx)) {
      setFlyDir('skip');
      setDrag(null);
      setTimeout(() => onSwipe('skip'), 220);
    } else if (Math.abs(d.dx) > SWIPE_THRESHOLD) {
      const dir = d.dx > 0 ? 'known' : 'unknown';
      setFlyDir(dir);
      setDrag(null);
      setTimeout(() => onSwipe(dir), 220);
    } else {
      setDrag(null);
    }
  };
  const onPointerUp = () => endDrag();
  const onPointerLeave = () => { if (dragRef.current && !flyDir) endDrag(); };
  const onClick = () => {
    if (drag && drag.moved) return;
    if (showExample) { setShowExample(false); return; }
    onFlip();
  };

  let style = {};
  let swipeClass = '';
  if (flyDir === 'shuffle') {
    style = { transition: 'none' };
    swipeClass = ' swipe-shuffle';
  } else if (flyDir === 'skip') {
    style = { transform: 'translateY(-600px) rotate(0deg)', opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = ' swipe-skip';
  } else if (flyDir) {
    const sign = flyDir === 'known' ? 1 : -1;
    style = { transform: `translateX(${sign * 600}px) rotate(${sign * 24}deg)`, opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = flyDir === 'known' ? ' swipe-known' : ' swipe-unknown';
  } else if (drag) {
    if (Math.abs(drag.dy) > Math.abs(drag.dx)) {
      style = { transform: `translateY(${drag.dy}px)`, transition: 'none' };
      if (drag.dy > 24) swipeClass = ' swipe-shuffle-hint';
      else if (drag.dy < -24) swipeClass = ' swipe-skip-hint';
    } else {
      const rotate = drag.dx / 18;
      style = { transform: `translateX(${drag.dx}px) rotate(${rotate}deg)`, transition: 'none' };
      if (drag.dx > 24) swipeClass = ' swipe-known';
      else if (drag.dx < -24) swipeClass = ' swipe-unknown';
    }
  }
  const swipeStrength = drag
    ? Math.min(Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) / SWIPE_THRESHOLD, 1)
    : (flyDir && flyDir !== 'shuffle' ? 1 : 0);

  return (
    <div className={'card-scene' + (flipped ? ' is-flipped' : '') + (showExample ? ' is-example' : '') + swipeClass} style={style}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onFlip(); }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerLeave} onPointerLeave={onPointerLeave}>
      {swipeClass === ' swipe-known' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Know</div>}
      {swipeClass === ' swipe-unknown' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Don't know</div>}
      {swipeClass === ' swipe-shuffle-hint' && <div className="swipe-stamp swipe-stamp-shuffle" style={{ opacity: swipeStrength }}><Ic.Shuffle width="14" height="14" /> Shuffle</div>}
      {(swipeClass === ' swipe-skip-hint' || swipeClass === ' swipe-skip') && <div className="swipe-stamp swipe-stamp-skip" style={{ opacity: swipeStrength }}>Skip</div>}
      {flyDir === 'shuffle' && (
        <div className="shuffle-fx" aria-hidden="true">
          <span className="shuffle-card sc-1" />
          <span className="shuffle-card sc-2" />
          <span className="shuffle-card sc-3" />
          <Ic.Shuffle className="shuffle-icon" width="28" height="28" />
        </div>
      )}
      <div className="card-inner">
        {direction === 'ru-en' ? (
          <>
            {/* FRONT: translation */}
            <div className="card-face card-front">
              {entry.photo && (
                <div className="card-photo">
                  <img className="card-photo-img" src={entry.photo} alt="" />
                </div>
              )}
              <div className="card-body">
                <div className="card-word">{entry.tr}</div>
              </div>
              {group && (
                <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
              )}
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
            {/* BACK: English word */}
            <div className="card-face card-back" style={{ '--hue': hue }}>
              <div className="back-label">word</div>
              <div className="card-tr">
                {entry.word}
              </div>
              <div className="back-word">
                {entry.ipa}
              </div>
              {group && (
                <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
              )}
              <SpeakButton word={entry.word} />
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
          </>
        ) : (
          <>
            {/* FRONT: English word */}
            <div className="card-face card-front">
              {entry.photo && (
                <div className="card-photo">
                  <img className="card-photo-img" src={entry.photo} alt="" />
                </div>
              )}
              <div className="card-body">
                <div className="card-word">{entry.word}</div>
                <div className="card-ipa">{entry.ipa}</div>
              </div>
              {group && (
                <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
              )}
              <SpeakButton word={entry.word} />
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
            {/* BACK: translation */}
            <div className="card-face card-back" style={{ '--hue': hue }}>
              <div className="back-label">translation</div>
              <div className="card-tr">
                {entry.tr}
              </div>
              <div className="back-word">{entry.word} <span className="back-ipa">{entry.ipa}</span></div>
              {group && (
                <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
              )}
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
          </>
        )}
        {/* EXAMPLE */}
        <div className="card-face card-example">
          <div className="example-text">{entry.example}</div>
          {entry.exampleTr && entry.exampleTr.trim() && (
            <>
              <hr className="example-divider" />
              <div className="example-text-tr">{entry.exampleTr}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pronunciation button ---------------- */
function SpeakButton({ word }) {
  return (
    <button type="button" className="card-speak" aria-label="Pronounce word"
      onClick={(e) => { e.stopPropagation(); lwSpeak(word); }}
      onPointerDown={(e) => e.stopPropagation()}>
      <Ic.Speaker />
    </button>
  );
}

/* ---------------- Example "lightbulb" toggle ---------------- */
function ExampleBulb({ example, onShow }) {
  const has = !!(example && example.trim());
  return (
    <button type="button" className={'card-bulb' + (has ? ' card-bulb-on' : '')}
      disabled={!has} aria-label="Show example sentence"
      onClick={(e) => { e.stopPropagation(); if (has) onShow(); }}
      onPointerDown={(e) => e.stopPropagation()}>
      <Ic.Bulb />
    </button>
  );
}

/* ---------------- Group chip (study selector) ---------------- */
function GroupChip({ group, groups, count, active, onToggle }) {
  const parent = group.parentId && groups ? groups.find((p) => p.id === group.parentId) : null;
  const label = parent ? parent.name + ' / ' + group.name : group.name;
  return (
    <button className={'chip' + (active ? ' chip-on' : '')} onClick={onToggle} type="button">
      <span className="chip-dot" style={{ background: group.color }} />
      <span className="chip-name">{label}</span>
      <span className="chip-count">{count}</span>
      {active && <Ic.Check className="chip-check" />}
    </button>
  );
}

/* ---------------- Actions menu (overflow "...") ---------------- */
function ActionsMenu({ items }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const btnRef = React.useRef(null);
  const popRef = React.useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    window.addEventListener('resize', () => setOpen(false));
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('resize', () => setOpen(false));
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  return (
    <div className="actions-menu">
      <button ref={btnRef} className="icon-btn sm" onClick={toggle} aria-label="More actions" aria-expanded={open}>
        <Ic.MoreVertical />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div ref={popRef} className="actions-menu-pop" style={{ top: pos.top, right: pos.right }} onClick={() => setOpen(false)}>
          {items.map((it, i) => (
            <button key={i} className={'actions-menu-item' + (it.danger ? ' danger' : '')} onClick={it.onClick}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------------- Modal shell ---------------- */
function Modal({ title, onClose, children, footer }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Ic.Close /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* groups that may hold words: groups with no subgroups */
function lwLeafGroups(groups) {
  return groups.filter((g) => !groups.some((other) => other.parentId === g.id));
}

/* ---------------- Word form (create/edit) ---------------- */
function WordForm({ initial, groups, defaultGroupId, onSave, onCancel }) {
  const [word, setWord] = React.useState(initial ? initial.word : '');
  const [ipa, setIpa] = React.useState(initial ? initial.ipa : '');
  const [tr, setTr] = React.useState(initial ? initial.tr : '');
  const [example, setExample] = React.useState(initial ? (initial.example || '') : '');
  const [exampleTr, setExampleTr] = React.useState(initial ? (initial.exampleTr || '') : '');
  const [photo, setPhoto] = React.useState(initial ? (initial.photo || '') : '');
  const [autoState, setAutoState] = React.useState('idle'); // 'idle' | 'loading' | 'notfound' | 'error'
  const leafGroups = lwLeafGroups(groups);
  const [groupId, setGroupId] = React.useState(initial ? initial.groupId : (defaultGroupId || (leafGroups[0] && leafGroups[0].id)));
  const fileInputRef = React.useRef(null);

  const canSave = word.trim() && tr.trim();
  const submit = () => {
    if (!canSave) return;
    onSave({
      id: initial ? initial.id : window.lwUid(),
      groupId,
      word: word.trim(),
      ipa: ipa.trim(),
      tr: tr.trim(),
      example: example.trim(),
      exampleTr: exampleTr.trim(),
      photo,
    });
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    window.lwFileToPhoto(file).then(setPhoto).catch(() => {});
  };

  const findPhoto = () => {
    if (!word.trim()) return;
    setAutoState('loading');
    window.lwAutoFindPhoto(word.trim())
      .then((dataUrl) => {
        if (dataUrl) { setPhoto(dataUrl); setAutoState('idle'); }
        else setAutoState('notfound');
      })
      .catch(() => setAutoState('error'));
  };

  return (
    <div className="form">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">English word</span>
          <input className="input" value={word} autoFocus placeholder="e.g. journey"
            onChange={(e) => setWord(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Transcription</span>
          <input className="input mono" value={ipa} placeholder="/ˈdʒɜː.ni/"
            onChange={(e) => setIpa(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Translation</span>
        <input className="input" value={tr} placeholder="перевод"
          onChange={(e) => setTr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </label>
      <label className="field">
        <span className="field-label">Example sentence</span>
        <input className="input" value={example} placeholder="e.g. We went on a long journey."
          onChange={(e) => setExample(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Example translation</span>
        <input className="input" value={exampleTr} placeholder="перевод примера"
          onChange={(e) => setExampleTr(e.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">Photo</span>
        <div className="photo-edit">
          {photo ? (
            <div className="photo-edit-preview">
              <img src={photo} alt="" />
            </div>
          ) : (
            <div className="photo-edit-preview photo-edit-empty">
              <Ic.Image width="24" height="24" />
            </div>
          )}
          <div className="photo-edit-actions">
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            <button type="button" className="btn btn-soft sm" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              Upload photo
            </button>
            {initial && (
              <button type="button" className="btn btn-soft sm" disabled={autoState === 'loading'} onClick={findPhoto}>
                {autoState === 'loading' ? 'Searching…' : 'Find photo automatically'}
              </button>
            )}
            {photo && (
              <button type="button" className="btn btn-ghost sm" onClick={() => setPhoto('')}>
                Remove
              </button>
            )}
          </div>
          {autoState === 'notfound' && <p className="field-hint">Не удалось найти подходящее фото.</p>}
          {autoState === 'error' && <p className="field-hint">Ошибка поиска фото. Попробуйте позже.</p>}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {leafGroups.map((g) => (
            <button key={g.id} type="button"
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />
              {g.parentId ? (groups.find((p) => p.id === g.parentId) || {}).name + ' / ' + g.name : g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>
          {initial ? 'Save changes' : 'Add word'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Import form (bulk text) ---------------- */
function lwParseImportLine(line) {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length >= 5) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: parts[3], exampleTr: parts[4] };
  }
  if (parts.length === 4) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: parts[3], exampleTr: '' };
  }
  if (parts.length === 3) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: '', exampleTr: '' };
  }
  if (parts.length === 2) {
    return { word: parts[0], ipa: '', tr: parts[1], example: '', exampleTr: '' };
  }
  return null;
}

function ImportForm({ groups, defaultGroupId, onImport, onCancel }) {
  const [text, setText] = React.useState('');
  const leafGroups = lwLeafGroups(groups);
  const [groupId, setGroupId] = React.useState(defaultGroupId || (leafGroups[0] && leafGroups[0].id));
  const fileInputRef = React.useRef(null);

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const rows = text.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(lwParseImportLine);

  const validCount = rows.filter(Boolean).length;
  const invalidCount = rows.length - validCount;
  const canImport = validCount > 0 && groupId;

  const submit = () => {
    if (!canImport) return;
    const items = rows.filter(Boolean).map((r) => ({
      id: window.lwUid(),
      groupId,
      word: r.word,
      ipa: r.ipa,
      tr: r.tr,
      example: r.example || '',
      exampleTr: r.exampleTr || '',
    }));
    onImport(items);
  };

  return (
    <div className="form">
      <p className="field-hint">
        Одна строка — одно слово. Формат: <code>слово | транскрипция | перевод | пример использования | перевод примера</code>
        {' '}(пример и его перевод опциональны), или <code>слово || перевод</code> (без транскрипции), или <code>слово | перевод</code>.
      </p>
      <label className="field">
        <div className="field-label-row">
          <span className="field-label">Текст для импорта</span>
          <button type="button" className="btn btn-soft sm" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Ic.Plus width="15" height="15" /> Load file
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <textarea className="input mono" rows={8} value={text} autoFocus
          placeholder={'journey | /ˈdʒɜː.ni/ | путешествие | We went on a long journey. | Мы отправились в долгое путешествие.\nbook || книга'}
          onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {leafGroups.map((g) => (
            <button key={g.id} type="button"
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />
              {g.parentId ? (groups.find((p) => p.id === g.parentId) || {}).name + ' / ' + g.name : g.name}
            </button>
          ))}
        </div>
      </div>

      {rows.length > 0 && (
        <p className="field-hint">
          Готово к импорту: {validCount}{invalidCount > 0 ? `, пропущено строк: ${invalidCount}` : ''}
        </p>
      )}

      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!canImport} onClick={submit}>
          Import {validCount > 0 ? `(${validCount})` : ''}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Ic, PhotoFill, Flashcard, GroupChip, ActionsMenu, Modal, WordForm, ImportForm, lwLeafGroups, SpeakButton });
