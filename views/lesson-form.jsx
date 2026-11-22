/* lesson-form.jsx — the grammar lesson editor (admins). Loaded on demand (lazy) from GrammarScreen. */

import React from 'react';
import { LW_LESSON_TASKS } from '../progress.ts';
import { lwAiGenerateLesson, lwAiRegenerateTask, lwHasGeminiKey, lwNormTask } from '../data.js';
import {
  GeminiKeyModal, Ic, LW_COLLOC_AI_MSG, LW_FORMULA_KINDS, LessonBody,
} from '../components.jsx';

const lwEmptyTask = (type = 'choice') => (type === 'fill'
  ? { type: 'fill', q: '', answers: [''], why: '' }
  : { type: 'choice', q: '', options: ['', '', '', ''], answer: 0, why: '' });

const LW_LESSON_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* Lesson editor (admins). Fill by hand or with "Generate with AI"; exactly 10
   test tasks. onSave(lesson, publish) — publish: true publishes, false keeps a draft. */
function LessonForm({ initial, topics, onSave, onDelete, onCancel }) {
  const [d, setD] = React.useState(() => {
    const quiz = ((initial && initial.quiz) || []).map((t) => (t.type === 'fill'
      ? { ...t, answers: (t.answers || []).length ? t.answers.slice() : [''] }
      : { ...t, options: [0, 1, 2, 3].map((i) => (t.options || [])[i] || '') }));
    while (quiz.length < LW_LESSON_TASKS) quiz.push(lwEmptyTask(quiz.length % 5 === 4 ? 'fill' : 'choice'));
    return {
      title: '', topic: '', level: 'B1', minutes: 10, compare: '', focus: '',
      formulas: [], compareTable: { rows: [], tip: '' }, examples: [],
      ...(initial || {}),
      quiz,
    };
  });
  const [preview, setPreview] = React.useState(false);
  const [aiState, setAiState] = React.useState('idle');
  const [taskBusy, setTaskBusy] = React.useState(-1);
  const [keyModal, setKeyModal] = React.useState(null); // pending AI action
  const [tried, setTried] = React.useState(false);

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setIn = (k, i, fields) => setD((x) => ({ ...x, [k]: x[k].map((r, j) => (j === i ? { ...r, ...fields } : r)) }));
  const addIn = (k, row) => setD((x) => ({ ...x, [k]: [...x[k], row] }));
  const delIn = (k, i) => setD((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) }));
  const setRow = (i, fields) => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: x.compareTable.rows.map((r, j) => (j === i ? { ...r, ...fields } : r)) } }));
  const setTask = (i, fields) => setD((x) => ({ ...x, quiz: x.quiz.map((t, j) => (j === i ? { ...t, ...fields } : t)) }));
  const setTaskType = (i, type) => setD((x) => ({ ...x, quiz: x.quiz.map((t, j) => (j === i ? { ...lwEmptyTask(type), q: t.q, why: t.why } : t)) }));

  /* what gets saved: trimmed, empty rows dropped */
  const clean = () => ({
    ...d,
    title: d.title.trim(), topic: d.topic.trim(), compare: (d.compare || '').trim(), focus: d.focus.trim(),
    minutes: Math.min(60, Math.max(1, Number(d.minutes) || 10)),
    formulas: d.formulas.map((f) => ({ ...f, pattern: f.pattern.trim(), example: f.example.trim(), tr: (f.tr || '').trim() })).filter((f) => f.pattern || f.example),
    compareTable: {
      rows: d.compareTable.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v || '').trim()]))).filter((r) => r.title),
      tip: (d.compareTable.tip || '').trim(),
    },
    examples: d.examples.map((x) => ({ sentence: x.sentence.trim(), tr: (x.tr || '').trim(), notes: (x.notes || []).filter((n) => n.part.trim() && n.text.trim()) })).filter((x) => x.sentence),
    quiz: d.quiz.map((t) => lwNormTask(t.type === 'fill' ? { ...t, answers: t.answers.map((a) => a.trim()) } : t)),
  });
  const out = clean();
  const errors = [];
  if (!out.title) errors.push('Enter a title.');
  if (!out.topic) errors.push('Enter a topic.');
  if (!out.focus) errors.push('Write the key idea.');
  const badTasks = out.quiz.map((t, i) => (t ? 0 : i + 1)).filter(Boolean);
  if (badTasks.length) errors.push('Complete test task' + (badTasks.length > 1 ? 's ' : ' ') + badTasks.join(', ')
    + ': a question, 4 options for Choice or an answer for Fill.');

  const save = (publish) => {
    setTried(true);
    if (errors.length) return;
    onSave(out, publish);
  };

  const needKey = (action) => { if (lwHasGeminiKey()) return false; setKeyModal(() => action); return true; };
  const generate = () => {
    if (!d.title.trim() && !d.topic.trim()) { setAiState('empty'); return; }
    if (needKey(generate)) return;
    setAiState('loading');
    lwAiGenerateLesson({ title: d.title, topic: d.topic, level: d.level, compare: d.compare })
      .then((r) => {
        setD((x) => {
          const quiz = r.quiz.slice();
          while (quiz.length < LW_LESSON_TASKS) quiz.push(lwEmptyTask(quiz.length % 5 === 4 ? 'fill' : 'choice'));
          return {
            ...x, title: x.title.trim() || r.title, focus: r.focus, minutes: r.minutes, formulas: r.formulas,
            compareTable: r.compareTable, examples: r.examples,
            quiz: quiz.map((t) => (t.type === 'fill' ? { ...t, answers: t.answers.length ? t.answers : [''] } : t)),
          };
        });
        setAiState(r.quiz.length < LW_LESSON_TASKS ? 'short' : 'idle');
      })
      .catch((e) => setAiState((e && e.code) || 'error'));
  };
  const regenTask = (i) => {
    if (needKey(() => regenTask(i))) return;
    setTaskBusy(i);
    lwAiRegenerateTask({ ...d, quiz: d.quiz.filter((_, j) => j !== i) }, d.quiz[i].type)
      .then((t) => { setD((x) => ({ ...x, quiz: x.quiz.map((q, j) => (j === i ? (t.type === 'fill' ? t : { ...t, options: t.options.slice() }) : q)) })); setTaskBusy(-1); })
      .catch((e) => { setTaskBusy(-1); setAiState((e && e.code) || 'error'); });
  };
  const aiMsg = {
    empty: 'Enter a title or a topic first.',
    short: 'AI returned fewer than 10 valid tasks — fill in or regenerate the empty ones.',
    ...LW_COLLOC_AI_MSG,
  };

  if (preview) {
    return (
      <div className="lesson-form">
        <div className="lf-preview-bar">
          <span className="lf-preview-label">Preview</span>
          <button type="button" className="btn btn-soft sm" onClick={() => setPreview(false)}><Ic.Edit width="15" height="15" /> Back to editor</button>
        </div>
        <h2 className="ls-title">{out.title || 'Untitled lesson'}</h2>
        <LessonBody lesson={out} />
        <p className="field-hint">The test ({LW_LESSON_TASKS} tasks) is shown after “I've studied this”.</p>
      </div>
    );
  }

  return (
    <div className="form lesson-form">
      <div className="lf-ai">
        <button type="button" className="btn btn-soft sm" disabled={aiState === 'loading'} onClick={generate}>
          {aiState === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Sparkle width="15" height="15" />}
          {aiState === 'loading' ? 'Writing the lesson…' : 'Generate with AI'}
        </button>
        <button type="button" className="btn btn-soft sm" onClick={() => setPreview(true)}><Ic.Book width="15" height="15" /> Preview</button>
      </div>
      {aiState !== 'idle' && aiState !== 'loading' && <p className="field-hint lf-ai-msg">{aiMsg[aiState] || 'AI service error. Try again later.'}</p>}

      <h4 className="lf-h">Basics</h4>
      <label className="field">
        <span className="field-label">Title</span>
        <input className="input" value={d.title} placeholder="Past Simple vs Present Perfect" onChange={(e) => set('title', e.target.value)} />
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Topic</span>
          <input className="input" value={d.topic} list="lw-lesson-topics" placeholder="Tenses" onChange={(e) => set('topic', e.target.value)} />
          <datalist id="lw-lesson-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className="field">
          <span className="field-label">Compare with (optional)</span>
          <input className="input" value={d.compare || ''} placeholder="Present Perfect" onChange={(e) => set('compare', e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Level</span>
          <select className="input" value={d.level} onChange={(e) => set('level', e.target.value)}>
            {LW_LESSON_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Minutes to study</span>
          <input className="input" type="number" min="1" max="60" value={d.minutes} onChange={(e) => set('minutes', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Key idea</span>
        <textarea className="input lf-area" rows="2" value={d.focus} placeholder="Действие завершилось, но результат связан с [[моментом сейчас]]."
          onChange={(e) => set('focus', e.target.value)} />
        <span className="field-hint">Wrap words in [[double brackets]] to highlight them.</span>
      </label>

      <h4 className="lf-h">Formulas</h4>
      {d.formulas.map((f, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <select className="input input-sm" value={f.kind} aria-label="Sentence type" onChange={(e) => setIn('formulas', i, { kind: e.target.value })}>
              {LW_FORMULA_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <input className="input input-sm" value={f.pattern} placeholder="have/has + V3" aria-label="Pattern" onChange={(e) => setIn('formulas', i, { pattern: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove formula" onClick={() => delIn('formulas', i)}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={f.example} placeholder="I [[have lost]] my keys." aria-label="Example" onChange={(e) => setIn('formulas', i, { example: e.target.value })} />
          <input className="input input-sm" value={f.tr || ''} placeholder="translation" aria-label="Translation" onChange={(e) => setIn('formulas', i, { tr: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn-soft sm lf-add" onClick={() => addIn('formulas', { kind: ['affirmative', 'negative', 'question'][d.formulas.length % 3], pattern: '', example: '', tr: '' })}>
        <Ic.Plus width="15" height="15" /> Add formula
      </button>

      <h4 className="lf-h">Difference table</h4>
      {d.compareTable.rows.map((r, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <input className="input input-sm" value={r.title} placeholder="Present Perfect" aria-label="Column title" onChange={(e) => setRow(i, { title: e.target.value })} />
            <input className="input input-sm" value={r.tag || ''} placeholder="Связь с сейчас" aria-label="Tag" onChange={(e) => setRow(i, { tag: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove row"
              onClick={() => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: x.compareTable.rows.filter((_, j) => j !== i) } }))}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={r.markers || ''} placeholder="Markers: already, just, ever…" aria-label="Markers" onChange={(e) => setRow(i, { markers: e.target.value })} />
          <div className="lf-row">
            <input className="input input-sm" value={r.pattern || ''} placeholder="have/has + V3" aria-label="Pattern" onChange={(e) => setRow(i, { pattern: e.target.value })} />
            <input className="input input-sm" value={r.example || ''} placeholder="I have already eaten." aria-label="Example" onChange={(e) => setRow(i, { example: e.target.value })} />
          </div>
        </div>
      ))}
      {d.compareTable.rows.length < 3 && (
        <button type="button" className="btn btn-soft sm lf-add"
          onClick={() => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: [...x.compareTable.rows, { title: '', tag: '', markers: '', pattern: '', example: '' }] } }))}>
          <Ic.Plus width="15" height="15" /> Add column
        </button>
      )}
      <label className="field">
        <span className="field-label">Tip</span>
        <input className="input" value={d.compareTable.tip || ''} placeholder="Если указано конкретное время (yesterday) — всегда Past Simple."
          onChange={(e) => setD((x) => ({ ...x, compareTable: { ...x.compareTable, tip: e.target.value } }))} />
      </label>

      <h4 className="lf-h">Worked examples</h4>
      {d.examples.map((x, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <input className="input input-sm" value={x.sentence} placeholder="I [[have worked]] here [[for three years]]." aria-label="Sentence"
              onChange={(e) => setIn('examples', i, { sentence: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove example" onClick={() => delIn('examples', i)}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={x.tr || ''} placeholder="translation" aria-label="Translation" onChange={(e) => setIn('examples', i, { tr: e.target.value })} />
          {(x.notes || []).map((n, j) => (
            <div className="lf-row lf-note" key={j}>
              <input className="input input-sm" value={n.part} placeholder="have worked" aria-label="Part"
                onChange={(e) => setIn('examples', i, { notes: x.notes.map((m, k) => (k === j ? { ...m, part: e.target.value } : m)) })} />
              <input className="input input-sm" value={n.text} placeholder="до сих пор работаю" aria-label="Explanation"
                onChange={(e) => setIn('examples', i, { notes: x.notes.map((m, k) => (k === j ? { ...m, text: e.target.value } : m)) })} />
              <button type="button" className="icon-btn sm danger" aria-label="Remove note"
                onClick={() => setIn('examples', i, { notes: x.notes.filter((_, k) => k !== j) })}><Ic.Trash /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost sm lf-add" onClick={() => setIn('examples', i, { notes: [...(x.notes || []), { part: '', text: '' }] })}>
            <Ic.Plus width="14" height="14" /> Add note
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-soft sm lf-add" onClick={() => addIn('examples', { sentence: '', tr: '', notes: [] })}>
        <Ic.Plus width="15" height="15" /> Add example
      </button>

      <h4 className="lf-h">Test — {LW_LESSON_TASKS} tasks</h4>
      {d.quiz.map((t, i) => (
        <div className={'lf-block lf-task' + (tried && !out.quiz[i] ? ' bad' : '')} key={i}>
          <div className="lf-row">
            <span className="lf-num">{i + 1}</span>
            <select className="input input-sm lf-type" value={t.type} aria-label="Task type" onChange={(e) => setTaskType(i, e.target.value)}>
              <option value="choice">Choice</option>
              <option value="fill">Fill in</option>
            </select>
            <button type="button" className="btn btn-ghost sm" disabled={taskBusy === i} onClick={() => regenTask(i)}>
              {taskBusy === i ? <span className="spinner" aria-hidden="true" /> : <Ic.Repeat width="14" height="14" />} Regenerate
            </button>
          </div>
          <input className="input input-sm" value={t.q} placeholder={t.type === 'fill' ? 'She ___ (finish) her report yet.' : 'I ___ him yesterday.'} aria-label="Question"
            onChange={(e) => setTask(i, { q: e.target.value })} />
          {t.type === 'choice' ? (
            <div className="lf-options">
              {t.options.map((o, j) => (
                <label className={'lf-option' + (t.answer === j ? ' on' : '')} key={j}>
                  <input type="radio" name={'lf-ans-' + i} checked={t.answer === j} onChange={() => setTask(i, { answer: j })} aria-label={'Correct answer ' + (j + 1)} />
                  <input className="input input-sm" value={o} placeholder={'option ' + (j + 1)}
                    onChange={(e) => setTask(i, { options: t.options.map((x, k) => (k === j ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
          ) : (
            <label className="field">
              <span className="field-hint">Accepted answers, separated by |</span>
              <input className="input input-sm" value={t.answers.join(' | ')} placeholder="has finished | 's finished"
                onChange={(e) => setTask(i, { answers: e.target.value.split('|') })} />
            </label>
          )}
          <input className="input input-sm" value={t.why || ''} placeholder="why this answer (shown after answering)" aria-label="Explanation"
            onChange={(e) => setTask(i, { why: e.target.value })} />
        </div>
      ))}

      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot lf-foot">
        {onDelete && <button type="button" className="btn btn-ghost danger-text" onClick={onDelete}><Ic.Trash width="15" height="15" /> Delete</button>}
        <span className="lf-foot-gap" />
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-soft" onClick={() => save(false)}>Save draft</button>
        <button type="button" className="btn btn-primary" onClick={() => save(true)}>Publish</button>
      </div>
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(null)} onSaved={(ok) => { const a = keyModal; setKeyModal(null); if (ok) a(); }} />}
    </div>
  );
}

export { LessonForm };
