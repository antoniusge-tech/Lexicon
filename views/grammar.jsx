/* grammar.jsx — Grammar: lesson list, lesson and its test. */

import { useState, useEffect, useMemo, useRef } from 'react';
import { LW_KEYS, lwLoad, lwSave } from '../data.js';
import {
  LW_LESSON_TASKS, LW_XP_LESSON_BONUS, lwCheckFill, lwLessonStatus, lwLessonTopics,
} from '../progress.ts';
import { Ic, LessonBody } from '../components.jsx';
import { lwLazy, shuffle } from './shared.jsx';

/* admin-only, loaded on demand */
const LessonForm = lwLazy(() => import('./lesson-form.jsx').then((m) => ({ default: m.LessonForm })));

/* ---------------- Grammar: lesson list, lesson, test, editor ---------------- */
const LW_LESSON_STATUS = {
  locked: { label: 'Locked' },
  new: { label: 'New' },
  studied: { label: 'Studied' },
  completed: { label: 'Completed' },
};

function GrammarScreen({ nav, setGrammar, lessons, progressBy, isAdmin, userLevel, recordAnswer,
  saveLesson, moveLesson, saveProgress, finishTest, deleteLesson }) {
  const topics = useMemo(() => lwLessonTopics(lessons), [lessons]);
  const [attempt, setAttempt] = useState(0); // bumps on "Retake test" to restart the quiz
  const topicOf = (l) => topics.find((t) => t.lessons.some((x) => x.id === l.id)) || { lessons: [l] };
  const statusOf = (l) => lwLessonStatus(l, topicOf(l).lessons, progressBy, isAdmin);
  const lesson = nav.lessonId && lessons.find((l) => l.id === nav.lessonId);
  const home = () => setGrammar({ view: 'home' });
  /* a locked lesson (e.g. a saved link) sends the user back to the list */
  const blocked = !!lesson && nav.view !== 'edit' && statusOf(lesson) === 'locked';
  useEffect(() => { if (blocked) home(); }, [blocked]); // eslint-disable-line

  if (nav.view === 'edit' && isAdmin) {
    return (
      <div className="grammar">
        <div className="ls-back-row">
          <button type="button" className="btn btn-ghost sm" onClick={() => (lesson ? setGrammar({ view: 'lesson', lessonId: lesson.id }) : home())}>
            <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Back
          </button>
        </div>
        <h1 className="lib-title">{lesson ? 'Edit lesson' : 'New lesson'}</h1>
        <div className="ls-editor">
          <LessonForm key={lesson ? lesson.id : 'new'} initial={lesson || null} topics={topics.map((t) => t.topic)}
            onSave={saveLesson} onCancel={() => (lesson ? setGrammar({ view: 'lesson', lessonId: lesson.id }) : home())}
            onDelete={lesson ? () => { if (window.confirm('Delete “' + lesson.title + '”? This can\'t be undone.')) deleteLesson(lesson); } : null} />
        </div>
      </div>
    );
  }
  if (lesson && !blocked && (nav.view === 'lesson' || nav.view === 'quiz')) {
    const status = statusOf(lesson);
    const list = topicOf(lesson).lessons;
    const next = list[list.findIndex((l) => l.id === lesson.id) + 1] || null;
    if (nav.view === 'quiz') {
      return (
        <LessonQuiz key={lesson.id + ':' + attempt} lesson={lesson} recordAnswer={recordAnswer}
          finishTest={(score) => finishTest(lesson.id, score)} next={next} onRetake={() => setAttempt((a) => a + 1)}
          onReview={() => setGrammar({ view: 'lesson', lessonId: lesson.id })}
          onNext={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onHome={home} />
      );
    }
    return (
      <LessonView lesson={lesson} prog={progressBy[lesson.id] || {}} status={status} isAdmin={isAdmin}
        position={list.findIndex((l) => l.id === lesson.id) + 1} total={list.length}
        onBack={home} onEdit={() => setGrammar({ view: 'edit', lessonId: lesson.id })}
        onToggleSave={() => saveProgress(lesson.id, { saved: !(progressBy[lesson.id] || {}).saved })}
        onPublish={(pub) => saveLesson({ ...lesson }, pub)}
        onStartTest={() => {
          if (!(progressBy[lesson.id] || {}).studiedAt) saveProgress(lesson.id, { studiedAt: Date.now() });
          setGrammar({ view: 'quiz', lessonId: lesson.id });
        }} />
    );
  }
  return (
    <GrammarHome topics={topics} progressBy={progressBy} isAdmin={isAdmin} userLevel={userLevel} statusOf={statusOf}
      onOpen={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onNew={() => setGrammar({ view: 'edit' })}
      onMove={moveLesson} onToggleSave={(l) => saveProgress(l.id, { saved: !(progressBy[l.id] || {}).saved })} />
  );
}

function GrammarHome({ topics, progressBy, isAdmin, userLevel, statusOf, onOpen, onNew, onMove, onToggleSave }) {
  const [f, setF] = useState(() => ({ level: 'all', saved: false, ...(lwLoad(LW_KEYS.grammar, null) || {}) }));
  useEffect(() => { lwSave(LW_KEYS.grammar, f); }, [f]);
  const levels = [...new Set(topics.flatMap((t) => t.lessons.map((l) => l.level)).filter(Boolean))].sort();
  const all = topics.flatMap((t) => t.lessons);
  const done = all.filter((l) => statusOf(l) === 'completed').length;
  const show = (l) => (f.level === 'all' || l.level === f.level) && (!f.saved || (progressBy[l.id] || {}).saved);

  return (
    <div className="grammar">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Grammar</h1>
          <p className="lib-sub">{all.length} {all.length === 1 ? 'lesson' : 'lessons'} · {done} completed{userLevel ? ' · your level ' + userLevel : ''}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New lesson</button>}
      </div>

      {all.length > 0 && (
        <div className="status-chips gr-filters">
          <button type="button" className={'chip' + (f.level === 'all' && !f.saved ? ' chip-on' : '')} onClick={() => setF({ level: 'all', saved: false })}>All</button>
          {levels.map((lv) => (
            <button key={lv} type="button" className={'chip' + (f.level === lv ? ' chip-on' : '')}
              onClick={() => setF((x) => ({ ...x, level: x.level === lv ? 'all' : lv }))}>{lv}</button>
          ))}
          <button type="button" className={'chip' + (f.saved ? ' chip-on' : '')} onClick={() => setF((x) => ({ ...x, saved: !x.saved }))}>
            <Ic.Bookmark width="14" height="14" /> Saved
          </button>
        </div>
      )}

      {all.length === 0 && (
        <div className="empty-card lib-empty">
          <Ic.Grammar width="28" height="28" />
          <p className="empty-title">No lessons yet</p>
          <p className="empty-sub">{isAdmin ? 'Create the first lesson — by hand or with AI.' : 'Lessons will appear here soon.'}</p>
          {isAdmin && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New lesson</button>}
        </div>
      )}

      {topics.map((t) => {
        const visible = t.lessons.filter(show);
        if (!visible.length) return null;
        const doneN = t.lessons.filter((l) => statusOf(l) === 'completed').length;
        const pct = Math.round((doneN / t.lessons.length) * 100);
        return (
          <section className="gr-topic" key={t.topic}>
            <div className="gr-topic-head">
              <h2 className="gr-topic-title">{t.topic}</h2>
              <span className="gr-topic-count">Completed {doneN} of {t.lessons.length}</span>
            </div>
            <div className="goal-track gr-topic-track"><div className="goal-fill" style={{ width: pct + '%' }} /></div>
            <div className="gr-list">
              {visible.map((l) => {
                const st = statusOf(l);
                const p = progressBy[l.id] || {};
                const i = t.lessons.indexOf(l);
                const prev = i > 0 ? t.lessons[i - 1] : null;
                return (
                  <div className={'gr-item gr-' + st} key={l.id}>
                    <button type="button" className="gr-item-main" disabled={st === 'locked'} onClick={() => onOpen(l)}
                      title={st === 'locked' && prev ? 'Complete “' + prev.title + '” first' : undefined}>
                      <span className="gr-num">{st === 'completed' ? <Ic.Check width="16" height="16" /> : st === 'locked' ? <Ic.Lock width="15" height="15" /> : i + 1}</span>
                      <span className="gr-item-text">
                        <span className="gr-item-title">{l.title}</span>
                        <span className="gr-item-meta">
                          {l.level && <span className="gr-level">{l.level}</span>}
                          <span>{l.minutes || 10} min</span>
                          <span>{(l.quiz || []).length} tasks</span>
                          {p.best != null && <span>Best {p.best}/{LW_LESSON_TASKS}</span>}
                          {isAdmin && !l.published && <span className="gr-draft">Draft</span>}
                        </span>
                        {st === 'locked' && prev && <span className="gr-lock-hint">Complete “{prev.title}” first</span>}
                      </span>
                      <span className={'gr-status gr-status-' + st}>{LW_LESSON_STATUS[st].label}</span>
                    </button>
                    <div className="gr-item-tools">
                      {st !== 'locked' && (
                        <button type="button" className={'icon-btn sm' + (p.saved ? ' on' : '')} aria-label={p.saved ? 'Remove bookmark' : 'Save lesson'}
                          aria-pressed={!!p.saved} onClick={() => onToggleSave(l)}><Ic.Bookmark width="16" height="16" /></button>
                      )}
                      {isAdmin && f.level === 'all' && !f.saved && (
                        <>
                          <button type="button" className="icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => onMove(t.lessons, i, -1)}><Ic.ArrowUp width="16" height="16" /></button>
                          <button type="button" className="icon-btn sm" aria-label="Move down" disabled={i === t.lessons.length - 1} onClick={() => onMove(t.lessons, i, 1)}><Ic.ArrowDown width="16" height="16" /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonView({ lesson, prog, status, isAdmin, position, total, onBack, onEdit, onToggleSave, onPublish, onStartTest }) {
  useEffect(() => { window.scrollTo(0, 0); }, [lesson.id]);
  return (
    <div className="grammar lesson">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}>
          <Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> {lesson.topic || 'Grammar'}
        </button>
        <span className="ls-pos">Lesson {position} of {total}</span>
      </div>
      <div className="ls-head">
        <div className="ls-badges">
          {lesson.level && <span className="ls-badge ls-badge-level">{lesson.level}</span>}
          <span className="ls-badge"><Ic.Clock width="14" height="14" /> {lesson.minutes || 10} min</span>
          <span className="ls-badge">{LW_LESSON_TASKS} tasks</span>
          {isAdmin && !lesson.published && <span className="ls-badge gr-draft">Draft</span>}
          <button type="button" className={'icon-btn sm ls-save' + (prog.saved ? ' on' : '')} aria-pressed={!!prog.saved}
            aria-label={prog.saved ? 'Remove bookmark' : 'Save lesson'} onClick={onToggleSave}><Ic.Bookmark width="17" height="17" /></button>
        </div>
        <h1 className="ls-title">{lesson.title}</h1>
        {status === 'completed' && <p className="ls-done"><Ic.Check width="16" height="16" /> Completed · best {prog.best}/{LW_LESSON_TASKS}</p>}
        {isAdmin && (
          <div className="ls-admin">
            <button type="button" className="btn btn-soft sm" onClick={onEdit}><Ic.Edit width="15" height="15" /> Edit</button>
            <button type="button" className="btn btn-soft sm" onClick={() => onPublish(!lesson.published)}>{lesson.published ? 'Unpublish' : 'Publish'}</button>
          </div>
        )}
      </div>

      <LessonBody lesson={lesson} />

      <section className="ls-cta">
        <span className="ls-cta-icon"><Ic.ListCheck width="24" height="24" /></span>
        <h3 className="ls-cta-title">{status === 'completed' ? 'Lesson completed' : 'Ready to test yourself?'}</h3>
        <p className="ls-cta-sub">
          {status === 'completed'
            ? 'You can retake the test any time to refresh the rule.'
            : 'Answer all ' + LW_LESSON_TASKS + ' tasks correctly to complete the lesson' + (position < total ? ' and unlock the next one.' : '.')}
        </p>
        <button type="button" className="btn btn-primary ls-cta-btn" onClick={onStartTest}>
          {status === 'completed' ? 'Retake test' : status === 'studied' ? 'Start test' : "I've studied this — start test"} <Ic.Arrow width="16" height="16" />
        </button>
        {prog.attempts > 0 && status !== 'completed' && <p className="ls-cta-note">Last attempt: {prog.last}/{LW_LESSON_TASKS}</p>}
      </section>
    </div>
  );
}

/* The test: tasks and options shuffled per attempt; feedback after each answer;
   10/10 completes the lesson. Every answer counts toward XP and the daily goal. */
function LessonQuiz({ lesson, recordAnswer, finishTest, next, onRetake, onReview, onNext, onHome }) {
  const [tasks] = useState(() => shuffle(lesson.quiz || []).map((t) => {
    if (t.type !== 'choice') return t;
    const order = shuffle([0, 1, 2, 3]);
    return { ...t, options: order.map((i) => t.options[i]), answer: order.indexOf(t.answer) };
  }));
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState(null); // choice index or typed text, once answered
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState([]); // { task, given, ok }
  const [finished, setFinished] = useState(null); // { score, firstPass }
  const inputRef = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); if (inputRef.current) inputRef.current.focus(); }, [idx]);

  const task = tasks[idx];
  const answer = (value) => {
    if (given != null || !task) return;
    const ok = task.type === 'choice' ? value === task.answer : lwCheckFill(value, task.answers);
    if (task.type === 'fill' && !String(value).trim()) return;
    setGiven(value);
    setResults((r) => [...r, { task, given: value, ok }]);
    recordAnswer(null, ok, 'lesson');
  };
  const goNext = () => {
    if (idx + 1 < tasks.length) { setIdx(idx + 1); setGiven(null); setTyped(''); return; }
    const score = results.filter((r) => r.ok).length;
    setFinished({ score, firstPass: finishTest(score) });
  };

  if (finished) {
    const passed = finished.score >= LW_LESSON_TASKS;
    const wrong = results.filter((r) => !r.ok);
    return (
      <div className="grammar quiz">
        <div className={'quiz-result' + (passed ? ' pass' : ' fail')}>
          <span className="quiz-result-icon">{passed ? <Ic.DoubleCheck width="30" height="30" /> : <Ic.Repeat width="28" height="28" />}</span>
          <p className="quiz-score">{finished.score}/{tasks.length}</p>
          <h2 className="quiz-result-title">{passed ? 'Lesson completed!' : 'Not passed yet'}</h2>
          <p className="quiz-result-sub">
            {passed
              ? (finished.firstPass ? '+' + LW_XP_LESSON_BONUS + ' XP bonus. ' : '') + (next ? 'The next lesson is unlocked.' : 'You finished this topic.')
              : 'You need ' + tasks.length + ' of ' + tasks.length + ' to complete the lesson. Review the mistakes and try again.'}
          </p>
          <div className="quiz-result-btns">
            {passed ? (
              <>
                <button className="btn btn-soft" onClick={onHome}>All lessons</button>
                {next && <button className="btn btn-primary" onClick={() => onNext(next)}>Next lesson <Ic.Arrow width="16" height="16" /></button>}
              </>
            ) : (
              <>
                <button className="btn btn-soft" onClick={onReview}>Review lesson</button>
                <button className="btn btn-primary" onClick={onRetake}>Retake test</button>
              </>
            )}
          </div>
        </div>
        {wrong.length > 0 && (
          <section className="quiz-mistakes">
            <h3 className="csheet-h">Your mistakes</h3>
            {wrong.map((r, i) => (
              <div className="ls-card quiz-mistake" key={i}>
                <p className="quiz-q">{r.task.q}</p>
                <p className="quiz-your"><Ic.Close width="14" height="14" /> {r.task.type === 'choice' ? r.task.options[r.given] : r.given}</p>
                <p className="quiz-right"><Ic.Check width="14" height="14" /> {r.task.type === 'choice' ? r.task.options[r.task.answer] : r.task.answers[0]}</p>
                {r.task.why && <p className="quiz-why">{r.task.why}</p>}
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }
  if (!task) return null;

  const ok = given != null && (results[results.length - 1] || {}).ok;
  const right = task.type === 'choice' ? task.options[task.answer] : task.answers[0];
  return (
    <div className="grammar quiz">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onReview}>
          <Ic.Close width="15" height="15" /> Quit test
        </button>
        <span className="ls-pos">{lesson.title}</span>
      </div>
      <div className="colloc-head">
        <span className="colloc-kicker">Task {idx + 1} of {tasks.length}</span>
        <span className="colloc-count">{results.filter((r) => r.ok).length} correct</span>
      </div>
      <div className="colloc-segs">
        {tasks.map((_, i) => {
          const r = results[i];
          return <span key={i} className={'colloc-seg' + (r ? (r.ok ? ' on' : ' bad') : i === idx ? ' cur' : '')} />;
        })}
      </div>
      <div className="ls-card quiz-card">
        <p className="quiz-type">{task.type === 'choice' ? 'Choose the right option' : 'Fill in the gap'}</p>
        <p className="quiz-q quiz-q-big">{task.q}</p>
        {task.type === 'choice' ? (
          <div className="quiz-options">
            {task.options.map((o, i) => {
              const cls = given == null ? '' : i === task.answer ? ' right' : i === given ? ' wrong' : ' dim';
              return (
                <button key={i} type="button" className={'quiz-option' + cls} disabled={given != null} onClick={() => answer(i)}>
                  <span className="quiz-letter">{'ABCD'[i]}</span>{o}
                </button>
              );
            })}
          </div>
        ) : (
          <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); answer(typed); }}>
            <input ref={inputRef} className={'input quiz-input' + (given == null ? '' : ok ? ' right' : ' wrong')} value={typed}
              disabled={given != null} placeholder="Type your answer" autoComplete="off" autoCapitalize="off" spellCheck="false"
              onChange={(e) => setTyped(e.target.value)} />
            {given == null && <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Check</button>}
          </form>
        )}
        {given != null && (
          <div className={'quiz-feedback' + (ok ? ' ok' : ' bad')} role="status">
            <p className="quiz-feedback-title">{ok ? 'Correct!' : 'Not quite — the answer is “' + right + '”'}</p>
            {task.why && <p className="quiz-why">{task.why}</p>}
          </div>
        )}
      </div>
      {given != null && (
        <button type="button" className="btn btn-primary quiz-next" onClick={goNext} autoFocus>
          {idx + 1 < tasks.length ? 'Next' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </div>
  );
}

export {
  GrammarScreen,
};
