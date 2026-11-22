/* learn.jsx — Learn: Cards (StudyView), Review, Choice and Fill, inside LearnView. */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LW_KEYS, lwLoad, lwSave } from '../data.js';
import { lwFormatInterval } from '../progress.ts';
import { FillCard, Flashcard, Ic, SpeakButton, lwBlankSentence } from '../components.jsx';
import { LW_LEARN_MODES } from '../nav.ts';
import { AnswerButtons, shuffle } from './shared.jsx';

function LearnView({ mode, setMode, stats, studyStats, selectedCount, onPickGroups, reviewScope, setReviewScope, reviewPlan, children }) {
  /* on narrow screens the modes scroll sideways: keep the chosen one in view */
  const pillsRef = useRef(null);
  useEffect(() => {
    const on = pillsRef.current && pillsRef.current.querySelector('.mode-pill.on');
    if (on && pillsRef.current.scrollWidth > pillsRef.current.clientWidth) {
      pillsRef.current.scrollLeft = on.offsetLeft - (pillsRef.current.clientWidth - on.offsetWidth) / 2;
    }
  }, [mode]);
  const pct = Math.min(100, Math.round((stats.todayAnswers / stats.goal) * 100));
  return (
    <div className="learn">
      <div className="learn-head">
        <div className="goal">
          <div className="goal-row">
            <span className="goal-label">Daily goal</span>
            <span className={'goal-count' + (pct >= 100 ? ' met' : '')}>{stats.todayAnswers} / {stats.goal} answers</span>
          </div>
          <div className="goal-track"><div className="goal-fill" style={{ width: pct + '%' }} /></div>
        </div>
        <div className="mode-pills" role="tablist" ref={pillsRef}>
          {LW_LEARN_MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
              className={'mode-pill' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)}>
              {m.label}
              {m.id === 'review' && stats.dueCount > 0 && <span className="mode-pill-count">{stats.dueCount}</span>}
            </button>
          ))}
        </div>
        {mode === 'review' && (
          <div className="learn-sub learn-sub-review">
            <div className="seg seg-sm" role="radiogroup" aria-label="Which words to review">
              <button type="button" role="radio" aria-checked={reviewScope === 'focus'} className={'seg-btn' + (reviewScope === 'focus' ? ' on' : '')}
                onClick={() => setReviewScope('focus')}>Focus</button>
              <button type="button" role="radio" aria-checked={reviewScope === 'all'} className={'seg-btn' + (reviewScope === 'all' ? ' on' : '')}
                onClick={() => setReviewScope('all')}>All</button>
            </div>
            {reviewScope === 'focus' && (
              <button type="button" className="groups-chip" onClick={onPickGroups}>
                <Ic.Tag width="15" height="15" /> {selectedCount} {selectedCount === 1 ? 'group' : 'groups'} <Ic.Chevron width="15" height="15" />
              </button>
            )}
            <span className="learn-session">
              {reviewScope === 'focus' ? reviewPlan.focusDue + ' due here · ' + reviewPlan.allDue + ' in all' : reviewPlan.allDue + ' due'}
            </span>
          </div>
        )}
        {mode !== 'review' && mode !== 'colloc' && mode !== 'video' && (
          <div className="learn-sub">
            <button type="button" className="groups-chip" onClick={onPickGroups}>
              <Ic.Tag width="15" height="15" /> {selectedCount} {selectedCount === 1 ? 'group' : 'groups'} <Ic.Chevron width="15" height="15" />
            </button>
            {(mode === 'cards' || mode === 'choice' || mode === 'fill') && studyStats.poolCount > 0 && (
              <span className="learn-session">{studyStats.knownCount} / {studyStats.poolCount} known</span>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Study view ---------------- */
function StudyView({ groups, words, selected, groupById, onStatsChange, direction, progress: wordProgress, recordAnswer, goLibrary, goCategory }) {
  const pool = useMemo(() => words.filter((w) => selected.includes(w.groupId)), [words, selected]);

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({}); // { [wordId]: 'known' | 'unknown' }

  /* start or resume a study session for this pool of words */
  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    const saved = lwLoad(LW_KEYS.studySession, null);
    if (saved && saved.poolKey === poolKey) {
      setProgress(saved.progress || {});
      setQueue(saved.queue || []);
      setCurrent(saved.current ?? null);
    } else {
      const ids = shuffle(pool.map((w) => w.id));
      setProgress({});
      setQueue(ids.slice(1));
      setCurrent(ids[0] || null);
    }
    setFlipped(false);
    // eslint-disable-next-line
  }, [poolKey]);

  /* persist session progress so it survives reloads */
  useEffect(() => {
    if (!pool.length) return;
    lwSave(LW_KEYS.studySession, { poolKey, queue, current, progress });
  }, [poolKey, pool.length, queue, current, progress]);

  useEffect(() => { setFlipped(false); }, [direction]);

  const knownCount = useMemo(
    () => Object.values(progress).filter((s) => s === 'known').length,
    [progress]
  );

  useEffect(() => {
    onStatsChange({ knownCount, poolCount: pool.length, groupCount: selected.length });
  }, [onStatsChange, knownCount, pool.length, selected.length]);

  const advance = useCallback((nextQueue) => {
    setFlipped(false);
    const nq = nextQueue.slice();
    const id = nq.shift();
    setCurrent(id || null);
    setQueue(nq);
  }, []);

  const draw = useCallback(() => {
    advance(queue);
  }, [advance, queue]);

  const mark = useCallback((status) => {
    if (!current) return;
    if (status === 'skip') { draw(); return; }
    recordAnswer(current, status === 'known', 'study');
    setProgress((p) => ({ ...p, [current]: status }));
    const nq = status === 'unknown' ? [...queue, current] : queue;
    advance(nq);
  }, [current, queue, advance, draw, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    if (!current) return;
    const shuffled = shuffle([...queue, current]);
    setFlipped(false);
    setCurrent(shuffled[0] || null);
    setQueue(shuffled.slice(1));
  }, [current, queue]);

  const restart = useCallback(() => {
    const ids = shuffle(pool.map((w) => w.id));
    setProgress({});
    setQueue(ids.slice(1));
    setCurrent(ids[0] || null);
    setFlipped(false);
  }, [pool]);

  /* keyboard */
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); mark('known'); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); mark('unknown'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mark]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const allDone = pool.length > 0 && !entry;

  return (
    <div className="study">
      <div className="stage">
        {entry ? (
          <Flashcard entry={entry} group={group} flipped={flipped} direction={direction}
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : allDone ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">All words done!</p>
            <p className="empty-sub">{pool.length} / {pool.length} known</p>
            <button className="btn btn-primary" onClick={restart}><Ic.Shuffle /> Start over</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Cards width="30" height="30" />
            <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
            <p className="empty-sub">{selected.length === 0 ? 'Pick one or more study groups.' : 'Add words to these groups in the Library.'}</p>
            {selected.length === 0 ? (
              <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
            ) : (
              <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
            )}
          </div>
        )}
      </div>
      {entry && <AnswerButtons prog={wordProgress[entry.id]} wordId={entry.id} onAnswer={mark} />}
    </div>
  );
}

/* ---------------- Review view (FSRS: words whose due time has come) ----------------
   Scope 'focus' plays the groups selected in Learn plus a small background share
   of at-risk words from other groups; 'all' plays every due word. Paused groups
   never come up. The queue is fixed when the view opens (most likely forgotten
   first) and holds at most the session size; "Continue" loads the next session.
   Again sends the word to the back of this session's queue, Know drops it.
   Space flips, ← / → answer. */
function ReviewView({ words, groupById, direction, progress, recordAnswer, now, plan, scope, session, showAll, goStudy, goCategory }) {
  const [queue, setQueue] = useState(null); // null until the first build
  const [budget, setBudget] = useState(session > 0 ? session : Infinity); // new words this session may still take
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [turn, setTurn] = useState(0); // remounts the card, so a re-queued single word animates in again

  /* due words in this scope, most likely forgotten first (lwReviewQueue) */
  const dueIds = plan.ids;
  const load = useCallback((room) => {
    const take = dueIds.slice(0, room);
    setQueue(take);
    setBudget(room - take.length);
  }, [dueIds]);

  /* build the queue on open; refill once it has run dry and more words came due,
     until the session size is used up ("Continue" starts another session) */
  useEffect(() => {
    const dry = queue === null || !queue.some((id) => words.some((w) => w.id === id));
    if (dry && (queue === null || (dueIds.length && budget > 0))) load(budget);
    // eslint-disable-next-line
  }, [dueIds]);

  useEffect(() => { setFlipped(false); }, [direction]);

  /* first queued word that still exists (words can be deleted mid-session) */
  const current = queue ? queue.find((id) => words.some((w) => w.id === id)) || null : null;

  const mark = useCallback((status) => {
    if (!current) return;
    setFlipped(false);
    setTurn((n) => n + 1);
    const rest = (q) => q.filter((id) => id !== current);
    if (status === 'skip') { setQueue((q) => [...rest(q), current]); return; }
    recordAnswer(current, status === 'known', 'review');
    setDone((n) => n + 1);
    setQueue((q) => (status === 'unknown' ? [...rest(q), current] : rest(q)));
  }, [current, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    setFlipped(false);
    setQueue((q) => shuffle(q));
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); mark('known'); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); mark('unknown'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mark]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;

  const nextDue = plan.nextDue;
  const moreDue = dueIds.length; // left after the session size was used up
  const otherDue = scope === 'focus' ? plan.allDue - plan.focusDue : 0;

  return (
    <div className="study">
      <div className="stage">
        {entry ? (
          <Flashcard key={turn} entry={entry} group={group} flipped={flipped} direction={direction}
            onFlip={() => setFlipped((f) => !f)} onSwipe={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : Object.keys(progress).length === 0 ? (
          <div className="empty-card">
            <Ic.Repeat width="30" height="30" />
            <p className="empty-title">Nothing to review yet</p>
            <p className="empty-sub">Study some words first — they come back here when it's time to repeat them.</p>
            <button className="btn btn-primary" onClick={goStudy}><Ic.Cards /> Start studying</button>
          </div>
        ) : budget === 0 && moreDue > 0 ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">Session done!</p>
            <p className="empty-sub">{done} reviewed. {moreDue} more {moreDue === 1 ? 'word is' : 'words are'} due.</p>
            <button className="btn btn-primary" onClick={() => load(session > 0 ? session : Infinity)}><Ic.Repeat /> Continue</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">{scope === 'focus' ? 'Focus groups caught up!' : 'All caught up!'}</p>
            <p className="empty-sub">
              {done > 0 ? done + ' reviewed this session. ' : ''}
              {otherDue > 0 ? otherDue + (otherDue === 1 ? ' word is' : ' words are') + ' due in other groups. '
                : nextDue ? 'Next review in ' + lwFormatInterval(nextDue - now) + '.' : ''}
            </p>
            {otherDue > 0 ? (
              <button className="btn btn-primary" onClick={showAll}><Ic.Repeat /> Review all groups</button>
            ) : (
              <button className="btn btn-primary" onClick={goStudy}><Ic.Cards /> Study new words</button>
            )}
          </div>
        )}
      </div>
      {entry && <AnswerButtons prog={progress[entry.id]} wordId={entry.id} onAnswer={mark} />}
    </div>
  );
}

/* ---------------- Choice view (multiple-choice translation quiz) ----------------
   Plays the selected groups in random order, but only words that are new or due
   by the review schedule: a right answer sets its next review (1 d or more),
   so it won't come back until then. A wrong answer re-queues it for this round.
   "Practise all anyway" ignores the schedule. Options come from the whole pool. */
const CHOICE_OPTIONS = 4;

const CHOICE_ADVANCE_DELAY = 700;

function ChoiceView({ words, selected, groupById, direction, progress, recordAnswer, onStatsChange, goLibrary, goCategory }) {
  const pool = useMemo(() => words.filter((w) => selected.includes(w.groupId)), [words, selected]);

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [optionIds, setOptionIds] = useState([]);
  const [pickedId, setPickedId] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [roundSize, setRoundSize] = useState(0); // words in this round
  const [knownIds, setKnownIds] = useState(() => new Set()); // answered right this round
  const advanceTimer = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const ignoreDueRef = useRef(false); // "Practise all anyway"
  const retryRef = useRef(new Set()); // missed this round, stay in the queue though not due

  /* checked when a word comes up, so progress that loads late still filters */
  const playable = useCallback((id) => {
    if (ignoreDueRef.current || retryRef.current.has(id)) return true;
    const p = progressRef.current[id];
    return !p || p.due <= Date.now();
  }, []);

  const buildOptions = useCallback((entryId) => {
    const others = shuffle(pool.filter((w) => w.id !== entryId)).slice(0, CHOICE_OPTIONS - 1);
    return shuffle([entryId, ...others.map((w) => w.id)]);
  }, [pool]);

  const startRound = useCallback((id) => {
    setPickedId(null);
    setCurrent(id);
    setOptionIds(id ? buildOptions(id) : []);
  }, [buildOptions]);

  const begin = useCallback((all) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    ignoreDueRef.current = all;
    retryRef.current = new Set();
    const ids = shuffle(pool.map((w) => w.id)).filter(playable);
    setCorrectCount(0);
    setAnsweredCount(0);
    setRoundSize(ids.length);
    setKnownIds(new Set());
    setQueue(ids.slice(1));
    startRound(ids[0] || null);
  }, [pool, playable, startRound]);

  /* "N / M known" in the Learn header, like Cards */
  useEffect(() => {
    if (onStatsChange) onStatsChange({ knownCount: knownIds.size, poolCount: roundSize, groupCount: selected.length });
  }, [onStatsChange, knownIds, roundSize, selected.length]);

  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    begin(false);
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
    // eslint-disable-next-line
  }, [poolKey]);

  const advance = useCallback(() => {
    setQueue((q) => {
      const nq = q.filter(playable);
      /* words that turned out not due (progress loaded late) leave the round */
      if (nq.length < q.length) setRoundSize((n) => n - (q.length - nq.length));
      const id = nq.shift();
      startRound(id || null);
      return nq;
    });
  }, [playable, startRound]);

  /* progress arrived after the round started: skip a word that isn't due */
  useEffect(() => {
    if (current && !pickedId && !playable(current)) {
      setRoundSize((n) => n - 1);
      advance();
    }
    // eslint-disable-next-line
  }, [progress]);

  const pick = useCallback((id) => {
    if (pickedId || !current) return;
    const right = id === current;
    setPickedId(id);
    setAnsweredCount((n) => n + 1);
    if (right) {
      setCorrectCount((n) => n + 1);
      setKnownIds((s) => new Set(s).add(current));
    } else {
      retryRef.current.add(current);
      setQueue((q) => [...q, current]);
    }
    recordAnswer(current, right, 'choice');
    advanceTimer.current = setTimeout(advance, CHOICE_ADVANCE_DELAY);
  }, [pickedId, current, advance, recordAnswer]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const allDone = pool.length > 0 && !entry;
  const askEnglish = direction === 'ru-en'; // prompt shows translation, options are English words

  /* for the empty state: words due now and the next one coming due */
  const now = Date.now();
  let dueNow = 0;
  let nextDue = null;
  if (allDone) {
    pool.forEach((w) => {
      const p = progress[w.id];
      if (!p || p.due <= now) dueNow++;
      else if (nextDue === null || p.due < nextDue) nextDue = p.due;
    });
  }

  return (
    <div className="choice">
      {entry ? (
        <div className="choice-card">
          {group && (
            <button type="button" className="choice-tag choice-tag-btn"
              onClick={() => goCategory()} title="Choose study groups">
              <span className="dot" style={{ background: group.color }} />{group.name}
            </button>
          )}
          <div className="choice-prompt-row">
            <div className="choice-prompt">{askEnglish ? entry.tr : entry.word}</div>
            {!askEnglish && <SpeakButton word={entry.word} />}
          </div>
          {!askEnglish && entry.ipa && <div className="choice-ipa">{entry.ipa}</div>}
          <div className="choice-options">
            {optionIds.map((id) => {
              const opt = words.find((w) => w.id === id);
              if (!opt) return null;
              const label = askEnglish ? opt.word : opt.tr;
              let cls = 'choice-opt';
              if (pickedId) {
                if (id === current) cls += ' choice-opt-correct';
                else if (id === pickedId) cls += ' choice-opt-wrong';
              }
              return (
                <button key={id} type="button" className={cls} disabled={!!pickedId} onClick={() => pick(id)}>
                  <span className="choice-opt-label">{label}</span>
                  {askEnglish && <SpeakButton word={opt.word} />}
                </button>
              );
            })}
          </div>
        </div>
      ) : allDone ? (
        <div className="empty-card">
          <Ic.Check width="30" height="30" />
          <p className="empty-title">{answeredCount > 0 ? 'Round complete!' : 'All caught up!'}</p>
          <p className="empty-sub">
            {answeredCount > 0 ? correctCount + ' / ' + answeredCount + ' correct. ' : ''}
            {dueNow === 0 && nextDue ? 'Next word due in ' + lwFormatInterval(nextDue - now) + '.' : ''}
          </p>
          {dueNow > 0 ? (
            <button className="btn btn-primary" onClick={() => begin(false)}><Ic.Shuffle /> Start over</button>
          ) : (
            <button className="btn btn-primary" onClick={() => begin(true)}><Ic.Shuffle /> Practise all anyway</button>
          )}
        </div>
      ) : (
        <div className="empty-card">
          <Ic.ListCheck width="30" height="30" />
          <p className="empty-title">{pool.length === 0 && selected.length === 0 ? 'Select a group to begin' : 'No words here yet'}</p>
          <p className="empty-sub">{selected.length === 0 ? 'Pick one or more study groups.' : 'Add words to these groups in the Library.'}</p>
          {selected.length === 0 ? (
            <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
          ) : (
            <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Fill view (blank-the-word-in-a-sentence cards) ----------------
   Same deck mechanics as Study, but only over words that have an example
   sentence AND that sentence contains a recognisable form of the word (so we can
   actually blank it out). The word is typed into the blank: right on the first
   go = Know (drops from the deck), after "Show answer" = Again (re-queued, so it
   comes up again). Like Choice, a round has only new or due words (a right answer
   keeps a word away for 1 d or more); "Practise all anyway" ignores that. */
function FillView({ words, selected, groupById, progress: wordProgress, recordAnswer, onStatsChange, goLibrary, goCategory }) {
  /* eligible: has an example whose text contains a form of the word to blank */
  const pool = useMemo(
    () => words.filter((w) => selected.includes(w.groupId)
      && w.example && w.example.trim()
      && lwBlankSentence(w.example, w.word)),
    [words, selected]
  );

  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [progress, setProgress] = useState({}); // { [wordId]: 'known' | 'unknown' }
  const [roundSize, setRoundSize] = useState(0); // words in this round
  const progressRef = useRef(wordProgress);
  progressRef.current = wordProgress;
  const ignoreDueRef = useRef(false); // "Practise all anyway"
  const retryRef = useRef(new Set()); // missed this round, stay in the queue though not due

  /* checked when a word comes up, so progress that loads late still filters */
  const playable = useCallback((id) => {
    if (ignoreDueRef.current || retryRef.current.has(id)) return true;
    const p = progressRef.current[id];
    return !p || p.due <= Date.now();
  }, []);

  const begin = useCallback((all) => {
    ignoreDueRef.current = all;
    retryRef.current = new Set();
    const ids = shuffle(pool.map((w) => w.id)).filter(playable);
    setProgress({});
    setRoundSize(ids.length);
    setQueue(ids.slice(1));
    setCurrent(ids[0] || null);
  }, [pool, playable]);

  const poolKey = pool.map((w) => w.id).join(',');
  useEffect(() => {
    begin(false);
    // eslint-disable-next-line
  }, [poolKey]);

  const knownCount = useMemo(
    () => Object.values(progress).filter((s) => s === 'known').length,
    [progress]
  );

  /* "N / M known" in the Learn header, like Cards */
  useEffect(() => {
    if (onStatsChange) onStatsChange({ knownCount, poolCount: roundSize, groupCount: selected.length });
  }, [onStatsChange, knownCount, roundSize, selected.length]);

  const advance = useCallback((nextQueue) => {
    const nq = nextQueue.filter(playable);
    /* words that turned out not due (progress loaded late) leave the round */
    if (nq.length < nextQueue.length) setRoundSize((n) => n - (nextQueue.length - nq.length));
    const id = nq.shift();
    setCurrent(id || null);
    setQueue(nq);
  }, [playable]);

  /* progress arrived after the round started: skip a word that isn't due */
  useEffect(() => {
    if (current && !playable(current)) {
      setRoundSize((n) => n - 1);
      advance(queue);
    }
    // eslint-disable-next-line
  }, [wordProgress]);

  const draw = useCallback(() => {
    advance(queue);
  }, [advance, queue]);

  /* known = typed right (drop it); unknown = typed after "Show answer" (send to
     the back, so it repeats); skip = move on without recording a status.
     info.easy: typed quickly with no mistake, graded Easy */
  const mark = useCallback((status, info) => {
    if (!current) return;
    if (status === 'skip') { draw(); return; }
    recordAnswer(current, status === 'known', 'fill', info);
    if (status === 'unknown') retryRef.current.add(current);
    setProgress((p) => ({ ...p, [current]: status }));
    const nq = status === 'unknown' ? [...queue, current] : queue;
    advance(nq);
  }, [current, queue, advance, draw, recordAnswer]);

  const shuffleDeck = useCallback(() => {
    if (!current) return;
    const shuffled = shuffle([...queue, current]);
    setCurrent(shuffled[0] || null);
    setQueue(shuffled.slice(1));
  }, [current, queue]);

  const entry = current ? words.find((w) => w.id === current) : null;
  const group = entry ? groupById[entry.groupId] : null;
  const blank = entry ? lwBlankSentence(entry.example, entry.word) : null;
  const allDone = pool.length > 0 && !entry;
  const answered = Object.keys(progress).length;

  /* for the empty state: words due now and the next one coming due */
  const now = Date.now();
  let dueNow = 0;
  let nextDue = null;
  if (allDone) {
    pool.forEach((w) => {
      const p = wordProgress[w.id];
      if (!p || p.due <= now) dueNow++;
      else if (nextDue === null || p.due < nextDue) nextDue = p.due;
    });
  }

  return (
    <div className="fill">
      <div className="stage">
        {entry ? (
          <FillCard entry={entry} group={group} blank={blank}
            onAnswer={mark} onShuffle={shuffleDeck}
            onGroupClick={goCategory} />
        ) : allDone ? (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">{answered > 0 ? 'All sentences done!' : 'All caught up!'}</p>
            <p className="empty-sub">
              {answered > 0 ? knownCount + ' / ' + roundSize + ' known. ' : ''}
              {dueNow === 0 && nextDue ? 'Next word due in ' + lwFormatInterval(nextDue - now) + '.' : ''}
            </p>
            {dueNow > 0 ? (
              <button className="btn btn-primary" onClick={() => begin(false)}><Ic.Shuffle /> Start over</button>
            ) : (
              <button className="btn btn-primary" onClick={() => begin(true)}><Ic.Shuffle /> Practise all anyway</button>
            )}
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Blank width="30" height="30" />
            <p className="empty-title">{selected.length === 0 ? 'Select a group to begin' : 'No sentences here yet'}</p>
            <p className="empty-sub">
              {selected.length === 0
                ? 'Pick one or more study groups.'
                : 'Add words with example sentences to these groups (the AI fill can write examples for you).'}
            </p>
            {selected.length === 0 ? (
              <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
            ) : (
              <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export {
  ChoiceView, FillView, LearnView, ReviewView, StudyView,
};
