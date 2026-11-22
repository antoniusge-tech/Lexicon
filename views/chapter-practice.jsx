/* chapter-practice.jsx — Reading: chapter practice (questions, gaps, word bank, dialogue). */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { lwUtterance } from '../data.js';
import { lwCheckFill } from '../progress.ts';
import { lwSplitQuote, readingTokensMatch } from '../reading.ts';
import {
  Ic, lwCanRecognize, lwListenOnce, lwMatchSpoken, lwSpeechTokens, lwUnmark,
} from '../components.jsx';
import { shuffle } from './shared.jsx';

/* ---------------- Chapter practice ----------------
   Books from the make-book skill (scripts/upload-book.mjs) keep exercises in
   each chapter doc: exercises = { questions, fill, bank, dialogue }. Gaps are
   marked [[word]]. Every answer goes through recordAnswer: to the user's card
   for that word when there is one (its review progress), else activity only.
   The last score of each exercise is kept in reading_progress as
   practice.{chapter}.{kind} = percent. */
const lwMarks = (t) => [...String(t || '').matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1]);

const LW_PRACTICE_KINDS = [
  { id: 'questions', label: 'Questions', sub: 'Did you get the story?', icon: 'ListCheck', count: (ex) => (ex.questions || []).length },
  { id: 'fill', label: 'Fill the gaps', sub: 'Type the missing word', icon: 'Blank', count: (ex) => (ex.fill || []).length },
  { id: 'bank', label: 'Word bank', sub: 'Put the words back into the text', icon: 'Cards', count: (ex) => (ex.bank ? lwMarks(ex.bank.text).length : 0) },
  { id: 'dialogue', label: 'Dialogue', sub: 'Say your lines, filling the gap', icon: 'Mic',
    count: (ex) => (ex.dialogue ? (ex.dialogue.lines || []).filter((l) => l.who === ex.dialogue.you).length : 0) },
];

function ChapterPracticeMenu({ ex, scores, onPick }) {
  const kinds = LW_PRACTICE_KINDS.filter((k) => k.count(ex) > 0);
  return (
    <section className="cp-menu">
      <h2 className="section-label">Practice this chapter</h2>
      <div className="cp-grid">
        {kinds.map((k) => {
          const I = Ic[k.icon];
          const score = scores && scores[k.id];
          return (
            <button key={k.id} type="button" className="cp-tile" onClick={() => onPick(k.id)}>
              <span className="tile-icon tile-icon-blue"><I width="18" height="18" /></span>
              <span className="cp-tile-label">{k.label}</span>
              <span className="cp-tile-sub">{k.sub}</span>
              <span className={'cp-tile-meta' + (score === 100 ? ' done' : '')}>
                {k.count(ex)} {k.id === 'questions' ? 'questions' : k.id === 'dialogue' ? 'lines' : 'gaps'}
                {score != null ? ' · last ' + score + '%' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* progress segments + counter, shared by the step-by-step exercises */
function PracticeHead({ label, idx, total, results }) {
  return (
    <>
      <div className="colloc-head">
        <span className="colloc-kicker">{label} · {Math.min(idx + 1, total)} of {total}</span>
        <span className="colloc-count">{results.filter(Boolean).length} correct</span>
      </div>
      <div className="colloc-segs">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={'colloc-seg' + (i < results.length ? (results[i] ? ' on' : ' bad') : i === idx ? ' cur' : '')} />
        ))}
      </div>
    </>
  );
}

function PracticeDone({ right, total, onAgain, onBack }) {
  const pct = total ? Math.round((right / total) * 100) : 0;
  const good = pct >= 80;
  return (
    <div className={'quiz-result' + (good ? ' pass' : ' fail')}>
      <span className="quiz-result-icon">{good ? <Ic.DoubleCheck width="30" height="30" /> : <Ic.Repeat width="28" height="28" />}</span>
      <p className="quiz-score">{right}/{total}</p>
      <h2 className="quiz-result-title">{pct === 100 ? 'Perfect!' : good ? 'Well done!' : 'Keep practising'}</h2>
      <p className="quiz-result-sub">Every answer counts towards your daily goal and XP.</p>
      <div className="quiz-result-btns">
        <button type="button" className="btn btn-soft" onClick={onAgain}>Try again</button>
        <button type="button" className="btn btn-primary" onClick={onBack}>Back to the chapter</button>
      </div>
    </div>
  );
}

/* sentence with its [[gap]] shown as a blank, or filled in after the answer */
function GapSentence({ text, shown, ok }) {
  const q = lwSplitQuote(text);
  return (
    <>{q.before}{shown
      ? <mark className={'cp-gap-filled' + (ok ? ' ok' : ' bad')}>{q.target}</mark>
      : <span className="cp-gap">{'_'.repeat(Math.max(4, Math.min(12, q.target.length)))}</span>}{q.after}</>
  );
}

/* comprehension questions: 4 options, shuffled per attempt */
function PracticeQuestions({ items, onAnswer, onFinish }) {
  const [tasks] = useState(() => shuffle(items).map((t) => {
    const order = shuffle([0, 1, 2, 3]);
    return { ...t, options: order.map((i) => t.options[i]), answer: order.indexOf(t.answer) };
  }));
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState(null);
  const [results, setResults] = useState([]);
  const task = tasks[idx];
  const pick = (i) => {
    if (given != null) return;
    const ok = i === task.answer;
    setGiven(i);
    setResults((r) => [...r, ok]);
    onAnswer(null, ok);
  };
  const next = () => {
    if (idx + 1 < tasks.length) { setIdx(idx + 1); setGiven(null); }
    else onFinish(results.filter(Boolean).length, tasks.length);
  };
  return (
    <>
      <PracticeHead label="Questions" idx={idx} total={tasks.length} results={results} />
      <div className="ls-card quiz-card">
        <p className="quiz-q quiz-q-big">{task.q}</p>
        <div className="quiz-options">
          {task.options.map((o, i) => {
            const cls = given == null ? '' : i === task.answer ? ' right' : i === given ? ' wrong' : ' dim';
            return (
              <button key={i} type="button" className={'quiz-option' + cls} disabled={given != null} onClick={() => pick(i)}>
                <span className="quiz-letter">{'ABCD'[i]}</span>{o}
              </button>
            );
          })}
        </div>
        {given != null && task.why && (
          <div className={'quiz-feedback' + (given === task.answer ? ' ok' : ' bad')} role="status">
            <p className="quiz-why">{task.why}</p>
          </div>
        )}
      </div>
      {given != null && (
        <button type="button" className="btn btn-primary quiz-next" onClick={next} autoFocus>
          {idx + 1 < tasks.length ? 'Next' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </>
  );
}

/* typed gaps: a sentence from the chapter with one word missing */
function PracticeFill({ items, onAnswer, onFinish }) {
  const [tasks] = useState(() => shuffle(items.map((f) => (typeof f === 'string' ? { s: f } : f))));
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState(null); // null | { ok, form, shown }
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [idx]);
  const task = tasks[idx];
  const target = lwSplitQuote(task.s).target;
  const settle = (ok, extra) => {
    setState({ ok, ...extra });
    setResults((r) => [...r, ok]);
    onAnswer(target, ok);
  };
  const check = () => {
    if (state || !typed.trim()) return;
    const ok = lwCheckFill(typed, [target]);
    /* the right word in another form (hire for hired) is still a miss, but say so */
    const form = !ok && lwSpeechTokens(typed).length === lwSpeechTokens(target).length
      && lwSpeechTokens(typed).every((t, i) => readingTokensMatch(t, lwSpeechTokens(target)[i]));
    settle(ok, { form });
  };
  const next = () => {
    if (idx + 1 < tasks.length) { setIdx(idx + 1); setTyped(''); setState(null); }
    else onFinish(results.filter(Boolean).length, tasks.length);
  };
  return (
    <>
      <PracticeHead label="Fill the gaps" idx={idx} total={tasks.length} results={results} />
      <div className="ls-card quiz-card">
        <p className="quiz-q quiz-q-big cp-sentence"><GapSentence text={task.s} shown={!!state} ok={state && state.ok} /></p>
        {task.hint && <p className="cp-hint"><Ic.Bulb width="15" height="15" /> {task.hint}</p>}
        <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); check(); }}>
          <input ref={inputRef} className={'input quiz-input' + (!state ? '' : state.ok ? ' right' : ' wrong')} value={typed}
            disabled={!!state} placeholder="Type the missing word" autoComplete="off" autoCapitalize="off" spellCheck="false"
            onChange={(e) => setTyped(e.target.value)} />
          {!state && <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Check</button>}
        </form>
        {!state && <button type="button" className="btn btn-ghost sm cp-show" onClick={() => settle(false, { shown: true })}>Show answer</button>}
        {state && (
          <div className={'quiz-feedback' + (state.ok ? ' ok' : ' bad')} role="status">
            <p className="quiz-feedback-title">
              {state.ok ? 'Correct!' : state.form ? 'Right word, wrong form — it is “' + target + '”' : 'The answer is “' + target + '”'}
            </p>
          </div>
        )}
      </div>
      {state && (
        <button type="button" className="btn btn-primary quiz-next" onClick={next} autoFocus>
          {idx + 1 < tasks.length ? 'Next' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </>
  );
}

/* word bank: a paragraph with gaps; tap a word to put it into the selected gap */
function PracticeBank({ bank, onAnswer, onFinish }) {
  const parts = useMemo(() => String(bank.text || '').split(/\[\[(.+?)\]\]/), [bank.text]);
  const answers = parts.filter((_, i) => i % 2 === 1);
  const [chips, setChips] = useState(() => shuffle([...answers, ...(bank.extra || [])]));
  const [filled, setFilled] = useState(() => answers.map(() => null)); // chip index per gap
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState(false);
  const firstEmpty = (f, from = 0) => {
    for (let k = 0; k < f.length; k++) { const i = (from + k) % f.length; if (f[i] == null) return i; }
    return -1;
  };
  const put = (ci) => {
    if (checked || filled.includes(ci)) return;
    const at = filled[active] == null ? active : firstEmpty(filled, active);
    if (at < 0) return;
    const f = filled.slice();
    f[at] = ci;
    setFilled(f);
    setActive(Math.max(0, firstEmpty(f, at)));
  };
  const tapGap = (gi) => {
    if (checked) return;
    if (filled[gi] != null) { const f = filled.slice(); f[gi] = null; setFilled(f); }
    setActive(gi);
  };
  const ok = (gi) => filled[gi] != null && chips[filled[gi]].toLowerCase() === answers[gi].toLowerCase();
  const check = () => {
    setChecked(true);
    answers.forEach((a, gi) => onAnswer(a, ok(gi)));
  };
  const again = () => { setChips(shuffle([...answers, ...(bank.extra || [])])); setFilled(answers.map(() => null)); setActive(0); setChecked(false); };
  const right = answers.filter((_, gi) => ok(gi)).length;
  let gi = -1;
  return (
    <>
      <div className="colloc-head">
        <span className="colloc-kicker">Word bank</span>
        <span className="colloc-count">{checked ? right + ' of ' + answers.length + ' correct' : answers.length + ' gaps'}</span>
      </div>
      <div className="ls-card cp-bank-text">
        <p className="rpara-text">
          {parts.map((p, i) => {
            if (i % 2 === 0) return <React.Fragment key={i}>{p}</React.Fragment>;
            gi++;
            const g = gi;
            const ci = filled[g];
            const cls = checked ? (ok(g) ? ' ok' : ' bad') : g === active ? ' active' : '';
            return (
              <React.Fragment key={i}>
                <button type="button" className={'cp-slot' + (ci != null ? ' full' : '') + cls} onClick={() => tapGap(g)}
                  aria-label={'Gap ' + (g + 1) + (ci != null ? ': ' + chips[ci] : '')}>
                  {ci != null ? chips[ci] : ' '}
                </button>
                {checked && !ok(g) && <span className="cp-fix">{answers[g]}</span>}
              </React.Fragment>
            );
          })}
        </p>
      </div>
      {!checked && (
        <div className="cp-chips">
          {chips.map((c, ci) => (
            <button key={ci} type="button" className={'chip cp-chip' + (filled.includes(ci) ? ' used' : '')}
              disabled={filled.includes(ci)} onClick={() => put(ci)}>{c}</button>
          ))}
        </div>
      )}
      {!checked ? (
        <button type="button" className="btn btn-primary quiz-next" disabled={filled.some((f) => f == null)} onClick={check}>Check</button>
      ) : (
        <div className="quiz-result-btns">
          <button type="button" className="btn btn-soft" onClick={again}>Try again</button>
          <button type="button" className="btn btn-primary" onClick={() => onFinish(right, answers.length, true)}>Done</button>
        </div>
      )}
    </>
  );
}

/* dialogue: the partner's lines are read aloud; the learner says their own line,
   filling the gap, and it is compared with the original (or types the word) */
function PracticeDialogue({ dialogue, onAnswer, onFinish }) {
  const lines = dialogue.lines || [];
  const you = dialogue.you;
  const canSpeak = lwCanRecognize();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState({}); // line index -> { ok, score, heard, typed, shown, tokensOk }
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(!canSpeak);
  const recRef = useRef(null);
  const endRef = useRef(null);
  const results = lines.map((l, i) => (l.who === you && done[i] ? done[i].ok : undefined)).filter((x) => x !== undefined);
  const mine = lines.filter((l) => l.who === you).length;
  const line = lines[idx];
  const isMine = line && line.who === you;

  const say = (text) => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(lwUtterance(lwUnmark(text), 1)); } };
  useEffect(() => { if (line && !isMine) say(line.text); }, [idx]); // eslint-disable-line
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [idx, done]);
  useEffect(() => () => { if (recRef.current) recRef.current.abort(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const settle = (res) => {
    setDone((d) => ({ ...d, [idx]: res }));
    onAnswer(lwSplitQuote(line.text).target, res.ok);
  };
  /* the gap is right when every one of its words was heard in place */
  const judge = (heard) => {
    const q = lwSplitQuote(line.text);
    const m = lwMatchSpoken(lwUnmark(line.text), heard);
    const from = lwSpeechTokens(q.before).length;
    const n = lwSpeechTokens(q.target).length;
    return { ok: m.ok.slice(from, from + n).every(Boolean), score: m.score, heard, tokensOk: m.ok };
  };
  const listen = () => {
    setError('');
    setListening(true);
    recRef.current = lwListenOnce({
      onEnd: (alts) => {
        recRef.current = null;
        setListening(false);
        if (!alts.length) { setError("Didn't hear anything — try again a bit louder."); return; }
        const best = alts.map(judge).sort((a, b) => (b.ok - a.ok) || (b.score - a.score))[0];
        settle(best);
      },
      onError: (msg) => { recRef.current = null; setListening(false); setError(msg); },
    });
  };
  const checkTyped = () => {
    if (!typed.trim()) return;
    settle({ ok: lwCheckFill(typed, [lwSplitQuote(line.text).target]), typed });
  };
  const next = () => {
    setTyped(''); setError('');
    if (idx + 1 < lines.length) setIdx(idx + 1);
    else onFinish(results.filter(Boolean).length, mine);
  };

  /* the learner's line once answered: words heard in green, missed in red */
  const answeredLine = (l, r) => {
    if (!r.tokensOk) return <GapSentence text={l.text} shown ok={r.ok} />;
    const words = lwUnmark(l.text).split(/(\s+)/);
    let k = -1;
    return words.map((w, i) => {
      if (/^\s+$/.test(w) || !lwSpeechTokens(w).length) return w;
      k += lwSpeechTokens(w).length;
      return <span key={i} className={r.tokensOk[k] ? 'pron-ok' : 'pron-miss'}>{w}</span>;
    });
  };

  return (
    <>
      <PracticeHead label={dialogue.title || 'Dialogue'} idx={Math.min(results.length, mine - 1)} total={mine} results={results} />
      <p className="field-hint">You are <strong>{you}</strong>. Listen to the others, then say your line with the missing word.</p>
      <div className="ls-card cp-chat">
        {lines.slice(0, idx + 1).map((l, i) => {
          const r = done[i];
          const me = l.who === you;
          return (
            <div key={i} className={'cp-line' + (me ? ' me' : '')}>
              <span className="cp-who">{l.who}</span>
              <div className="cp-bubble">
                <p className="cp-text">
                  {!me ? l.text : r ? answeredLine(l, r) : <GapSentence text={l.text} />}
                  {!me && <button type="button" className="icon-btn sm cp-replay" onClick={() => say(l.text)} aria-label="Listen again"><Ic.Speaker width="15" height="15" /></button>}
                </p>
                {l.tr && <p className="cp-tr">{l.tr}</p>}
                {me && r && (
                  <p className={'cp-verdict' + (r.ok ? ' ok' : ' bad')}>
                    {r.ok ? 'Correct' : 'The word is “' + lwSplitQuote(l.text).target + '”'}
                    {r.score != null ? ' · ' + r.score + '% of the line heard' : ''}
                    {r.heard && !r.ok ? ' · heard: “' + r.heard + '”' : ''}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <span ref={endRef} />
      </div>
      {isMine && !done[idx] ? (
        <div className="cp-controls">
          {!typing ? (
            <>
              <button type="button" className={'pron-btn' + (listening ? ' on' : '')} onClick={listening ? () => recRef.current && recRef.current.stop() : listen}>
                <Ic.Mic width="16" height="16" /> {listening ? 'Listening…' : 'Say the line'}
              </button>
              <button type="button" className="btn btn-ghost sm" onClick={() => setTyping(true)}>Type instead</button>
            </>
          ) : (
            <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); checkTyped(); }}>
              <input className="input quiz-input" value={typed} autoFocus placeholder="Type the missing word" autoComplete="off"
                autoCapitalize="off" spellCheck="false" onChange={(e) => setTyped(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Check</button>
            </form>
          )}
          {typing && canSpeak && <button type="button" className="btn btn-ghost sm" onClick={() => setTyping(false)}><Ic.Mic width="15" height="15" /> Speak instead</button>}
          <button type="button" className="btn btn-ghost sm" onClick={() => settle({ ok: false, shown: true })}>Show answer</button>
          {error && <span className="pron-error">{error}</span>}
        </div>
      ) : (
        <button type="button" className="btn btn-primary quiz-next" onClick={next} autoFocus>
          {idx + 1 < lines.length ? 'Continue' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </>
  );
}

/* one exercise of a chapter; `run` remounts it for "Try again" */
function ChapterPractice({ kind, ex, onAnswer, onSave, onBack }) {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState(null); // { right, total }
  const finish = (right, total, skipScreen) => {
    onSave(total ? Math.round((right / total) * 100) : 0);
    if (skipScreen) onBack();
    else setResult({ right, total });
  };
  const again = () => { setResult(null); setRun((r) => r + 1); };
  const props = { onAnswer, onFinish: finish };
  return (
    <div className="quiz cp">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Close width="15" height="15" /> Back to the text</button>
      </div>
      {result ? <PracticeDone right={result.right} total={result.total} onAgain={again} onBack={onBack} />
        : kind === 'questions' ? <PracticeQuestions key={run} {...props} items={ex.questions} />
        : kind === 'fill' ? <PracticeFill key={run} {...props} items={ex.fill} />
        : kind === 'bank' ? <PracticeBank key={run} {...props} bank={ex.bank} />
        : <PracticeDialogue key={run} {...props} dialogue={ex.dialogue} />}
    </div>
  );
}

export {
  ChapterPractice, ChapterPracticeMenu,
};
