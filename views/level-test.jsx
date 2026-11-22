/* level-test.jsx — level test (adaptive CEFR staircase). */

import { useState, useEffect } from 'react';
import { lwWatchLevelQuestions } from '../firebase.js';
import { lwCefrField, lwLangField, lwLangInfo } from '../data.js';
import {
  LW_CEFR_NAMES, LW_LEVEL_TEST_LEN, LW_LEVEL_TEST_MIN_BANK, lwLevelIndex,
  lwLevelTestPick, lwLevelTestResult,
} from '../progress.ts';
import { Ic } from '../components.jsx';
import { lwLazy, shuffle } from './shared.jsx';

/* admin-only, loaded on demand */
const LevelQuestionsAdmin = lwLazy(() => import('./level-admin.jsx').then((m) => ({ default: m.LevelQuestionsAdmin })));

/* ---------------- Level test (any language) + question bank editor (admins) ---------------- */
function LevelTestScreen({ lang, user, uid, isAdmin, updateProfile, pushToast, onClose }) {
  const info = lwLangInfo(lang);
  const cefrKey = lwCefrField(lang);
  const testKey = lwLangField('levelTest', lang);
  const [bank, setBank] = useState(null); // null while loading
  useEffect(() => lwWatchLevelQuestions(lang, setBank), [lang]);
  const [view, setView] = useState('intro'); // intro | test | result | manage
  const [run, setRun] = useState(null); // { asked, answers, level, q, order, picked }
  const [result, setResult] = useState(null);
  useEffect(() => { window.scrollTo(0, 0); }, [view, run && run.q && run.q.id]);
  const last = user[testKey];
  const ready = bank && bank.length >= LW_LEVEL_TEST_MIN_BANK;

  const ask = (q, asked, answers, level) => setRun({ asked, answers, level, q, order: shuffle([0, 1, 2, 3]), picked: null });
  const start = () => {
    const level = user[cefrKey] ? lwLevelIndex(user[cefrKey]) : 1; // A2 when unknown
    const q = lwLevelTestPick(bank, [], level);
    if (!q) return;
    setResult(null);
    ask(q, [q.id], [], level);
    setView('test');
  };
  const finish = (answers) => {
    const res = lwLevelTestResult(answers);
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
      const q = answers.length < LW_LEVEL_TEST_LEN ? lwLevelTestPick(bank, run.asked, level) : null;
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
          <span className="colloc-kicker">Question {n + 1} of {LW_LEVEL_TEST_LEN}</span>
        </div>
        <div className="colloc-segs">
          {Array.from({ length: LW_LEVEL_TEST_LEN }, (_, i) => <span key={i} className={'colloc-seg' + (i < n ? ' on' : i === n ? ' cur' : '')} />)}
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
          <h2 className="quiz-result-title">{LW_CEFR_NAMES[result.level]}</h2>
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
        <p className="ls-cta-sub">{LW_LEVEL_TEST_LEN} questions · about 8 minutes. The questions get harder or easier as you answer.
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

export {
  LevelTestScreen,
};
