/* grammar.jsx — Grammar: lesson list, lesson and its test. */

import { useState, useEffect, useMemo, useRef } from 'react';
import { LW_KEYS, lwLoad, lwSave } from '../data.js';
import {
  LW_GRAMMAR_REVIEW_LESSONS, LW_GRAMMAR_REVIEW_TASKS, LW_LESSON_TASKS, LW_XP_LESSON_BONUS,
  lwCheckFill, lwFormatInterval, lwLessonStatus, lwLessonTopics,
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
  reviewPlan, now, gradeReview, saveLesson, moveLesson, saveProgress, finishTest, deleteLesson }) {
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
  if (nav.view === 'review') {
    return (
      <GrammarReview lessons={lessons} plan={reviewPlan} now={now} recordAnswer={recordAnswer} gradeReview={gradeReview}
        onOpen={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onHome={home} />
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
      reviewPlan={reviewPlan} now={now} onReview={() => setGrammar({ view: 'review' })}
      onOpen={(l) => setGrammar({ view: 'lesson', lessonId: l.id })} onNew={() => setGrammar({ view: 'edit' })}
      onMove={moveLesson} onToggleSave={(l) => saveProgress(l.id, { saved: !(progressBy[l.id] || {}).saved })} />
  );
}

function GrammarHome({ topics, progressBy, isAdmin, userLevel, statusOf, reviewPlan, now, onReview, onOpen, onNew, onMove, onToggleSave }) {
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

      {done > 0 && <ReviewCard plan={reviewPlan} now={now} onReview={onReview} />}

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

/* a test task with a choice's options in a new random order */
function lwShuffleOptions(t) {
  if (t.type !== 'choice') return t;
  const order = shuffle([0, 1, 2, 3]);
  return { ...t, options: order.map((i) => t.options[i]), answer: order.indexOf(t.answer) };
}

/* One task: the question, its options or a gap to type in, and the feedback
   once answered (`given`: the option index or the typed text). */
function QuizTaskCard({ task, given, ok, typed, setTyped, onAnswer, inputRef }) {
  const right = task.type === 'choice' ? task.options[task.answer] : task.answers[0];
  return (
    <div className="ls-card quiz-card">
      <p className="quiz-type">{task.type === 'choice' ? 'Choose the right option' : 'Fill in the gap'}</p>
      <p className="quiz-q quiz-q-big">{task.q}</p>
      {task.type === 'choice' ? (
        <div className="quiz-options">
          {task.options.map((o, i) => {
            const cls = given == null ? '' : i === task.answer ? ' right' : i === given ? ' wrong' : ' dim';
            return (
              <button key={i} type="button" className={'quiz-option' + cls} disabled={given != null} onClick={() => onAnswer(i)}>
                <span className="quiz-letter">{'ABCD'[i]}</span>{o}
              </button>
            );
          })}
        </div>
      ) : (
        <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); onAnswer(typed); }}>
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
  );
}

/* The test: tasks and options shuffled per attempt; feedback after each answer;
   10/10 completes the lesson. Every answer counts toward XP and the daily goal. */
function LessonQuiz({ lesson, recordAnswer, finishTest, next, onRetake, onReview, onNext, onHome }) {
  const [tasks] = useState(() => shuffle(lesson.quiz || []).map(lwShuffleOptions));
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
      <QuizTaskCard task={task} given={given} ok={ok} typed={typed} setTyped={setTyped} onAnswer={answer} inputRef={inputRef} />
      {given != null && (
        <button type="button" className="btn btn-primary quiz-next" onClick={goNext} autoFocus>
          {idx + 1 < tasks.length ? 'Next' : 'See result'} <Ic.Arrow width="16" height="16" />
        </button>
      )}
    </div>
  );
}

/* Grammar home: lessons whose rule is due for a review (spaced repetition) */
function ReviewCard({ plan, now, onReview }) {
  const n = plan.ids.length;
  return (
    <section className={'gr-review' + (n ? ' due' : '')}>
      <span className="gr-review-icon"><Ic.Repeat width="22" height="22" /></span>
      <div className="gr-review-text">
        <h2 className="gr-review-title">{n ? 'Time to review ' + n + (n === 1 ? ' lesson' : ' lessons') : 'Grammar review'}</h2>
        <p className="gr-review-sub">
          {n ? 'A few tasks from lessons you completed, so the rules stay with you.'
            : plan.nextDue ? 'Completed lessons come back for a short check. Next in ' + lwFormatInterval(plan.nextDue - now) + '.'
              : 'Completed lessons come back here for a short check.'}
        </p>
      </div>
      {n > 0 && <button type="button" className="btn btn-primary" onClick={onReview}>Review <Ic.Arrow width="16" height="16" /></button>}
    </section>
  );
}

/* Grammar → Review: LW_GRAMMAR_REVIEW_TASKS tasks from each of the first
   LW_GRAMMAR_REVIEW_LESSONS due lessons (most likely forgotten first), mixed
   together. The session is fixed when it opens. Once all of a lesson's tasks
   are answered, its rule is rescheduled (gradeReview → lesson_progress.srs).
   Every answer counts toward XP and the daily goal, like a lesson test. */
function GrammarReview({ lessons, plan, now, recordAnswer, gradeReview, onOpen, onHome }) {
  const [session, setSession] = useState(0); // bumps on "Review more"
  const [tasks, setTasks] = useState(null); // [{ task, lesson }]
  /* pick the session; again once lessons and progress have loaded (a cold start
     on #/grammar/review), but never while one is being played */
  const ready = lessons.length > 0 && plan.ids.length > 0;
  useEffect(() => {
    if (tasks && tasks.length) return;
    const picked = plan.ids.map((id) => lessons.find((l) => l.id === id)).filter((l) => l && (l.quiz || []).length)
      .slice(0, LW_GRAMMAR_REVIEW_LESSONS);
    setTasks(shuffle(picked.flatMap((l) => shuffle(l.quiz).slice(0, LW_GRAMMAR_REVIEW_TASKS)
      .map((t) => ({ task: lwShuffleOptions(t), lesson: l })))));
    // eslint-disable-next-line
  }, [session, ready]);
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState(null);
  const [typed, setTyped] = useState('');
  const [results, setResults] = useState([]); // { lessonId, ok }
  const [finished, setFinished] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); if (inputRef.current) inputRef.current.focus(); }, [idx, tasks]);

  if (!tasks) return null;
  const item = tasks[idx];
  const answer = (value) => {
    if (given != null || !item) return;
    const { task, lesson } = item;
    if (task.type === 'fill' && !String(value).trim()) return;
    const ok = task.type === 'choice' ? value === task.answer : lwCheckFill(value, task.answers);
    const next = [...results, { lessonId: lesson.id, ok }];
    setGiven(value);
    setResults(next);
    recordAnswer(null, ok, 'lesson');
    const mine = next.filter((r) => r.lessonId === lesson.id);
    if (mine.length === tasks.filter((t) => t.lesson.id === lesson.id).length) {
      gradeReview(lesson.id, mine.filter((r) => r.ok).length, mine.length);
    }
  };
  const goNext = () => {
    if (idx + 1 < tasks.length) { setIdx(idx + 1); setGiven(null); setTyped(''); return; }
    setFinished(true);
  };
  const again = () => { setSession((n) => n + 1); setTasks(null); setIdx(0); setGiven(null); setTyped(''); setResults([]); setFinished(false); };

  if (!tasks.length || finished) {
    const byLesson = [...new Set(tasks.map((t) => t.lesson))].map((l) => {
      const mine = results.filter((r) => r.lessonId === l.id);
      return { lesson: l, right: mine.filter((r) => r.ok).length, total: mine.length };
    });
    const right = results.filter((r) => r.ok).length;
    const more = plan.ids.filter((id) => !byLesson.some((b) => b.lesson.id === id)).length;
    return (
      <div className="grammar quiz">
        <div className={'quiz-result' + (right === results.length ? ' pass' : ' fail')}>
          <span className="quiz-result-icon">{right === results.length ? <Ic.DoubleCheck width="30" height="30" /> : <Ic.Repeat width="28" height="28" />}</span>
          {results.length > 0 && <p className="quiz-score">{right}/{results.length}</p>}
          <h2 className="quiz-result-title">{results.length ? 'Review done' : 'Nothing to review'}</h2>
          <p className="quiz-result-sub">
            {results.length ? 'Rules you got right come back later; the others come back sooner.'
              : plan.nextDue ? 'The next lesson comes back in ' + lwFormatInterval(plan.nextDue - now) + '.' : 'Complete a lesson first.'}
          </p>
          <div className="quiz-result-btns">
            <button className="btn btn-soft" onClick={onHome}>All lessons</button>
            {more > 0 && <button className="btn btn-primary" onClick={again}>Review {more} more <Ic.Arrow width="16" height="16" /></button>}
          </div>
        </div>
        {byLesson.length > 0 && (
          <section className="quiz-mistakes">
            <h3 className="csheet-h">Lessons</h3>
            {byLesson.map((b) => (
              <div className="ls-card gr-review-row" key={b.lesson.id}>
                <span className={'gr-review-mark' + (b.right === b.total ? ' ok' : '')}>
                  {b.right === b.total ? <Ic.Check width="15" height="15" /> : <Ic.Repeat width="14" height="14" />}
                </span>
                <span className="gr-review-row-title">{b.lesson.title}</span>
                <span className="gr-review-row-score">{b.right}/{b.total}</span>
                {b.right < b.total && <button type="button" className="btn btn-ghost sm" onClick={() => onOpen(b.lesson)}>Open lesson</button>}
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  const ok = given != null && (results[results.length - 1] || {}).ok;
  return (
    <div className="grammar quiz">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={() => setFinished(true)}>
          <Ic.Close width="15" height="15" /> Finish
        </button>
        <span className="ls-pos">Grammar review</span>
      </div>
      <div className="colloc-head">
        <span className="colloc-kicker">{item.lesson.title}</span>
        <span className="colloc-count">{idx + 1} / {tasks.length}</span>
      </div>
      <div className="colloc-segs">
        {tasks.map((_, i) => {
          const r = results[i];
          return <span key={i} className={'colloc-seg' + (r ? (r.ok ? ' on' : ' bad') : i === idx ? ' cur' : '')} />;
        })}
      </div>
      <QuizTaskCard task={item.task} given={given} ok={ok} typed={typed} setTyped={setTyped} onAnswer={answer} inputRef={inputRef} />
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
