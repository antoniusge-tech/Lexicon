/* level-admin.jsx — level test question bank editor (admins). */

import { useState } from 'react';
import { LW_COLLECTIONS, lwDeleteDoc, lwSetDoc } from '../firebase.js';
import { lwLangInfo, lwUid } from '../data.js';
import { LW_CEFR_ALL, LW_CEFR_NAMES, LW_LEVEL_TEST_MIN_BANK, lwLevelIndex } from '../progress.ts';
import { Ic, Modal } from '../components.jsx';

const lwEmptyLevelQuestion = (level) => ({ level: level || 'B1', skill: 'grammar', q: '', options: ['', '', '', ''], answer: 0, why: '' });

function LevelQuestionsAdmin({ bank, lang, uid, pushToast, onBack }) {
  const info = lwLangInfo(lang);
  const [level, setLevel] = useState('all');
  const [form, setForm] = useState(null); // question being edited or created
  const [confirm, setConfirm] = useState(null);
  const counts = Object.fromEntries(LW_CEFR_ALL.map((lv) => [lv, bank.filter((q) => q.level === lv).length]));
  const list = bank.filter((q) => level === 'all' || q.level === level)
    .sort((a, b) => lwLevelIndex(a.level) - lwLevelIndex(b.level) || (a.createdAt || 0) - (b.createdAt || 0));
  const fail = (title) => (e) => pushToast({ kind: 'error', title, msg: (e && e.message) || String(e) });
  const save = (q) => {
    const now = Date.now();
    lwSetDoc(LW_COLLECTIONS.levelQuestions, {
      ...q, id: q.id || lwUid() + lwUid(), lang, userId: q.userId || uid, shared: true,
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
          <p className="lib-sub">{info.name} · {bank.length} questions · the test needs at least {LW_LEVEL_TEST_MIN_BANK}, about 10 per level is best</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(lwEmptyLevelQuestion(level === 'all' ? 'B1' : level))}><Ic.Plus /> New question</button>
      </div>
      <div className="status-chips">
        <button type="button" className={'chip' + (level === 'all' ? ' chip-on' : '')} onClick={() => setLevel('all')}>All <span className="chip-count">{bank.length}</span></button>
        {LW_CEFR_ALL.map((lv) => (
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
              lwDeleteDoc(LW_COLLECTIONS.levelQuestions, q.id).catch(fail('Could not delete the question'));
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
            {LW_CEFR_ALL.map((lv) => <option key={lv} value={lv}>{lv} · {LW_CEFR_NAMES[lv]}</option>)}
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

export {
  LevelQuestionsAdmin,
};
