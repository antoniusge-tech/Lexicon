/* import.jsx — Import: paste or upload word lines, preview, AI fill and save. Loaded on demand (lazy) from App. */

import React from 'react';
import { lwCurrentLang, lwHasGeminiKey, lwLangInfo, lwUid } from '../data.js';
import { GeminiKeyModal, Ic, lwLeafGroups, lwParseImportLine, lwWordKey } from '../components.jsx';

/* how the forms column is written, per language (forms.ts, lwParseFormsText) */
const LW_FORMS_IMPORT_HINT = {
  ro: <>verb <code>lucrez, lucrează, lucreze, lucrat</code> (eu, el, el să, participle) · noun <code>f, case</code> (gender m/f/n, plural) · adjective <code>frumoasă, frumoși, frumoase</code></>,
};

/* Full-page import view. Draft text + chosen group + AI status live in App
   (importState) so a typed/generated list survives leaving the tab; the AI
   fill runs at the App level (startAiFill) and reports back via toast. */
function ImportView({ groups, words, uid, importState, setImportState, startAiFill, onImport, goLibrary }) {
  const { text, groupId, status, error } = importState;
  /* an admin also gets other users' private groups: those go last, by owner */
  const foreign = (g) => uid && g.userId !== uid && !g.shared;
  const leafGroups = React.useMemo(() => {
    const leaves = lwLeafGroups(groups);
    return [...leaves.filter((g) => !foreign(g)),
      ...leaves.filter(foreign).sort((a, b) => (a.username || '').localeCompare(b.username || ''))];
  }, [groups, uid]);
  const group = leafGroups.find((g) => g.id === groupId) || null;
  const fileInputRef = React.useRef(null);
  const [keyModal, setKeyModal] = React.useState(false);

  const setText = (t) => setImportState((s) => ({ ...s, text: t }));
  const setGroupId = (id) => setImportState((s) => ({ ...s, groupId: id }));

  /* default to the first available category once groups load (and again after
     a language switch, when the chosen group belongs to the other language) */
  React.useEffect(() => {
    if ((!groupId || !leafGroups.some((g) => g.id === groupId)) && leafGroups.length) setGroupId(leafGroups[0].id);
    // eslint-disable-next-line
  }, [leafGroups, groupId]);

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = lines.map(lwParseImportLine);

  // Дубли: слово уже есть в текущем языке (в любой группе) или повторяется в списке.
  // Считаются слова, которые видит владелец выбранной группы: его собственные и общие.
  const ownerId = group ? group.userId : uid;
  const existingKeys = React.useMemo(() => new Set((words || [])
    .filter((w) => !ownerId || w.userId === ownerId || w.shared)
    .map((w) => lwWordKey(w.word))), [words, ownerId]);
  const seen = new Set();
  const dupWords = [];
  const freshRows = rows.filter(Boolean).filter((r) => {
    const k = lwWordKey(r.word);
    if (!k || existingKeys.has(k) || seen.has(k)) { dupWords.push(r.word); return false; }
    seen.add(k);
    return true;
  });

  const validCount = freshRows.length;
  const invalidCount = rows.filter((r) => !r).length;
  const loading = status === 'loading';
  const canImport = validCount > 0 && groupId && !loading;

  // «Сырые» строки — те, где нет ни транскрипции, ни перевода (обычно просто
  // одно слово). Их AI может обогатить. Кнопку AI показываем, только пока
  // такие строки есть, — после успешного ответа она сама исчезнет, и повторное
  // нажатие невозможно.
  const rawWords = lines
    .filter((l) => {
      // Голое слово без разделителей (парсер вернёт null) — тоже «сырое».
      if (l.indexOf('|') === -1) return true;
      const p = lwParseImportLine(l);
      return p && !p.ipa && !p.tr;
    })
    .map((l) => l.split('|')[0].trim())
    .filter(Boolean)
    // уже существующие слова и повторы AI не заполняет
    .filter((w, i, a) => !existingKeys.has(lwWordKey(w)) && a.findIndex((x) => lwWordKey(x) === lwWordKey(w)) === i);
  const showAi = rawWords.length > 0;

  const fillWithAi = () => {
    if (!rawWords.length || loading) return;
    if (!lwHasGeminiKey()) { setKeyModal(true); return; }
    startAiFill(rawWords);
  };

  const submit = () => {
    if (!canImport) return;
    const t = Date.now();
    const items = freshRows.map((r, i) => ({
      id: lwUid(),
      groupId,
      word: r.word,
      ipa: r.ipa,
      tr: r.tr,
      example: r.example || '',
      exampleTr: r.exampleTr || '',
      pos: r.pos || '',
      forms: r.forms, // undefined fields are dropped by lwSetDoc
      createdAt: t + i, // keeps the list's order in Library's "Recent" sort
    }));
    // Импортируем и очищаем черновик — иначе текст «не пропадает» до импорта.
    onImport(items, group);
    setImportState((s) => ({ ...s, text: '', status: 'idle', error: null }));
  };

  const clearText = () => setImportState((s) => ({ ...s, text: '', status: 'idle', error: null }));

  return (
    <div className="library import-view">
      <div className="lib-head">
        <div>
          <h1 className="lib-title">Import words</h1>
          <p className="lib-sub">Paste a list, pick a group and import.</p>
        </div>
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={goLibrary} disabled={loading}><Ic.Library /> Library</button>
        </div>
      </div>

      <div className="form">
      <p className="field-hint">
        One line per word. Format: <code>word | transcription | translation | example | example translation | part of speech{LW_FORMS_IMPORT_HINT[lwCurrentLang()] ? ' | forms' : ''}</code>
        {' '}(everything after the translation is optional), or <code>word || translation</code> (no transcription), or <code>word | translation</code>.
      </p>
      {LW_FORMS_IMPORT_HINT[lwCurrentLang()] && <p className="field-hint">Forms, comma-separated: {LW_FORMS_IMPORT_HINT[lwCurrentLang()]}</p>}
      <label className="field">
        <div className="field-label-row">
          <span className="field-label">Words to import</span>
          {showAi && (
            <button type="button" className="btn btn-soft sm" disabled={loading} onClick={fillWithAi}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="15" height="15" />}
              {loading ? 'AI is filling in…' : `Fill with AI (${rawWords.length})`}
            </button>
          )}
          <button type="button" className="btn btn-soft sm" disabled={loading}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Ic.Plus width="15" height="15" /> Load file
          </button>
          {text.trim() && (
            <button type="button" className="btn btn-ghost sm" disabled={loading} onClick={clearText}>
              <Ic.Trash width="15" height="15" /> Clear
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <textarea className="input mono" rows={10} value={text} autoFocus disabled={loading}
          placeholder={lwLangInfo().ex.import}
          onChange={(e) => setText(e.target.value)} />
        {error === 'bad-key' ? (
          <p className="field-hint">Your Gemini key is invalid.{' '}
            <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Change key</button>
          </p>
        ) : error === 'quota' ? (
          <p className="field-hint">Daily Gemini limit reached. Try again later.</p>
        ) : error === 'overload' ? (
          <p className="field-hint">Gemini is overloaded right now. Try again in a minute.</p>
        ) : error === 'refusal' ? (
          <p className="field-hint">The model could not process the list. Try fewer words.</p>
        ) : error ? (
          <p className="field-hint">AI service error. Try again later.</p>
        ) : null}
      </label>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {leafGroups.map((g) => (
            <button key={g.id} type="button" disabled={loading}
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />
              {g.parentId ? (groups.find((p) => p.id === g.parentId) || {}).name + ' / ' + g.name : g.name}
              {uid && g.userId !== uid && g.username && <small className="gp-owner">({g.username})</small>}
            </button>
          ))}
        </div>
        {leafGroups.length === 0 && (
          <p className="field-hint">Create a group in the Library first.</p>
        )}
      </div>

      {rows.length > 0 && (
        <p className="field-hint">
          Ready to import: {validCount}{invalidCount > 0 ? `, skipped lines: ${invalidCount}` : ''}
          {dupWords.length > 0 && `, duplicates skipped: ${dupWords.length} (${dupWords.slice(0, 5).join(', ')}${dupWords.length > 5 ? '…' : ''})`}
        </p>
      )}

      {keyModal && (
        <GeminiKeyModal
          onClose={() => setKeyModal(false)}
          onSaved={(ok) => { if (ok && rawWords.length) startAiFill(rawWords); }}
        />
      )}

      <div className="form-foot">
        <button className="btn btn-primary" disabled={!canImport} onClick={submit}>
          Import {validCount > 0 ? `(${validCount})` : ''}
        </button>
      </div>
      </div>
    </div>
  );
}

export { ImportView };
