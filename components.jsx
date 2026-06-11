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
  Check: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>
  ),
};

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
function Flashcard({ entry, group, flipped, onFlip }) {
  if (!entry) return null;
  const hue = group ? group.color : '#E8552F';
  return (
    <div className={'card-scene' + (flipped ? ' is-flipped' : '')} onClick={onFlip} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onFlip(); }}>
      <div className="card-inner">
        {/* FRONT */}
        <div className="card-face card-front">
          <div className="card-photo">
            <PhotoFill word={entry.word} hue={hue} />
          </div>
          <div className="card-body">
            <div className="card-word">{entry.word}</div>
            <div className="card-ipa">{entry.ipa}</div>
          </div>
          {group && (
            <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
          )}
          <div className="flip-hint">tap to flip</div>
        </div>
        {/* BACK */}
        <div className="card-face card-back" style={{ '--hue': hue }}>
          <div className="back-label">translation</div>
          <div className="card-tr">{entry.tr}</div>
          <div className="back-word">{entry.word} <span className="back-ipa">{entry.ipa}</span></div>
          {group && (
            <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Group chip (study selector) ---------------- */
function GroupChip({ group, count, active, onToggle }) {
  return (
    <button className={'chip' + (active ? ' chip-on' : '')} onClick={onToggle} type="button">
      <span className="chip-dot" style={{ background: group.color }} />
      <span className="chip-name">{group.name}</span>
      <span className="chip-count">{count}</span>
      {active && <Ic.Check className="chip-check" />}
    </button>
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

/* ---------------- Word form (create/edit) ---------------- */
function WordForm({ initial, groups, defaultGroupId, onSave, onCancel }) {
  const [word, setWord] = React.useState(initial ? initial.word : '');
  const [ipa, setIpa] = React.useState(initial ? initial.ipa : '');
  const [tr, setTr] = React.useState(initial ? initial.tr : '');
  const [groupId, setGroupId] = React.useState(initial ? initial.groupId : (defaultGroupId || (groups[0] && groups[0].id)));

  const canSave = word.trim() && tr.trim();
  const submit = () => {
    if (!canSave) return;
    onSave({
      id: initial ? initial.id : window.lwUid(),
      groupId,
      word: word.trim(),
      ipa: ipa.trim(),
      tr: tr.trim(),
    });
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

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {groups.map((g) => (
            <button key={g.id} type="button"
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />{g.name}
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
  if (parts.length >= 3) {
    return { word: parts[0], ipa: parts[1], tr: parts[2] };
  }
  if (parts.length === 2) {
    return { word: parts[0], ipa: '', tr: parts[1] };
  }
  return null;
}

function ImportForm({ groups, defaultGroupId, onImport, onCancel }) {
  const [text, setText] = React.useState('');
  const [groupId, setGroupId] = React.useState(defaultGroupId || (groups[0] && groups[0].id));
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
    }));
    onImport(items);
  };

  return (
    <div className="form">
      <p className="field-hint">
        Одна строка — одно слово. Формат: <code>слово | транскрипция | перевод</code>
        {' '}или <code>слово || перевод</code> (без транскрипции), или <code>слово | перевод</code>.
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
          placeholder={'journey | /ˈdʒɜː.ni/ | путешествие\nbook || книга'}
          onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {groups.map((g) => (
            <button key={g.id} type="button"
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />{g.name}
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

Object.assign(window, { Ic, PhotoFill, Flashcard, GroupChip, Modal, WordForm, ImportForm });
