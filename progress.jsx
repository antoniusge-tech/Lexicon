/* progress.jsx — pure Leitner / streak / XP logic (no Firestore, no React).
   Storage lives in firebase.jsx (lwRecordAnswer); App wires the two together. */

const LW_MIN_MS = 60 * 1000;
const LW_DAY_MS = 24 * 60 * LW_MIN_MS;

/* Leitner boxes: how long a word rests after landing in box i.
   Box 5 (30 days, i.e. interval >= 21 days) counts as Mastered. */
const LW_BOXES = [10 * LW_MIN_MS, LW_DAY_MS, 3 * LW_DAY_MS, 7 * LW_DAY_MS, 14 * LW_DAY_MS, 30 * LW_DAY_MS];
const LW_MASTERED_BOX = LW_BOXES.length - 1;

const LW_DEFAULT_DAILY_GOAL = 20; // answers per day
const LW_XP_CORRECT = 10;
const LW_XP_WRONG = 5;
const LW_XP_GOAL_BONUS = 50;
const LW_GOAL_OPTIONS = [10, 20, 30, 50]; // daily goal choices, in answers
const LW_CEFR_ALL = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LW_PRACTICE_GAP_MS = 60 * 1000; // longer pauses between answers don't count as practice

/* Next progress doc for a word after one answer. `prev` is the stored doc or
   null for a word never studied. Know only moves the word up a box once it is
   due (or new) — reviewing early keeps the box, so a word can't be ground to
   Mastered in one evening. Again always drops it to box 0. */
function lwNextProgress(prev, wordId, known, mode, now) {
  const base = prev || { wordId, box: 0, due: now, reps: 0, lapses: 0 };
  const next = { ...base, wordId, reps: (base.reps || 0) + 1, lastSeen: now, lastMode: mode };
  if (!known) {
    next.box = 0;
    next.due = now + LW_BOXES[0];
    next.lapses = (base.lapses || 0) + 1;
  } else if (!prev) {
    next.box = 1;
    next.due = now + LW_BOXES[1];
  } else if (prev.due <= now) {
    next.box = Math.min((prev.box || 0) + 1, LW_MASTERED_BOX);
    next.due = now + LW_BOXES[next.box];
  }
  return next;
}

/* 'new' | 'learning' | 'review' (due now) | 'mastered' */
function lwWordStatus(prog, now) {
  if (!prog) return 'new';
  if (prog.due <= now) return 'review';
  return prog.box >= LW_MASTERED_BOX ? 'mastered' : 'learning';
}

/* compact duration for button labels: 10m, 5h, 3d */
function lwFormatInterval(ms) {
  if (ms < 60 * LW_MIN_MS) return Math.max(1, Math.round(ms / LW_MIN_MS)) + 'm';
  if (ms < LW_DAY_MS) return Math.round(ms / (60 * LW_MIN_MS)) + 'h';
  return Math.round(ms / LW_DAY_MS) + 'd';
}

/* local calendar date of the device, 'YYYY-MM-DD' */
function lwLocalDate(now) {
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/* Consecutive days (ending today, or yesterday if nothing answered yet today)
   with at least one answer. `activityByDate` maps 'YYYY-MM-DD' -> activity doc. */
function lwStreak(activityByDate, now) {
  const active = (date) => activityByDate[date] && activityByDate[date].answers > 0;
  const d = new Date(now);
  if (!active(lwLocalDate(d.getTime()))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (active(lwLocalDate(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function lwTotalXp(activityByDate) {
  return Object.values(activityByDate).reduce((sum, a) => sum + (a.xp || 0), 0);
}

/* 50 XP -> level 2, 200 -> 3, 450 -> 4, ... */
function lwLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

/* Practice time credited for one answer: time since the previous answer,
   capped so that breaks don't count. 0 for the first answer of a visit. */
function lwPracticeMs(prevAt, now) {
  if (!prevAt) return 0;
  return Math.max(0, Math.min(now - prevAt, LW_PRACTICE_GAP_MS));
}

/* how many of the given words are in each status */
function lwStatusCounts(progress, words, now) {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  words.forEach((w) => { counts[lwWordStatus(progress[w.id], now)]++; });
  return counts;
}

/* the last n calendar days (oldest first) with their activity */
function lwLastDays(activityByDate, now, n) {
  const out = [];
  const d = new Date(now);
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const date = lwLocalDate(d.getTime());
    const a = activityByDate[date] || {};
    out.push({ date, weekday: d.getDay(), answers: a.answers || 0, goalMet: !!a.goalMet });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function lwTotalMs(activityByDate) {
  return Object.values(activityByDate).reduce((sum, a) => sum + (a.ms || 0), 0);
}

/* 95 min -> "1h 35m", 12 min -> "12m" */
function lwFormatDuration(ms) {
  const min = Math.round(ms / LW_MIN_MS);
  if (min < 60) return min + 'm';
  const h = Math.floor(min / 60);
  return h + 'h' + (min % 60 ? ' ' + (min % 60) + 'm' : '');
}

/* ---------------- Collocations game ---------------- */

/* phrases of an entry whose word cards still exist */
function lwCollocLive(entry, wordsById) {
  return (entry.phrases || []).filter((p) => wordsById[p.wordId]);
}
function lwCollocPlayable(entry, wordsById) {
  return lwCollocLive(entry, wordsById).length >= 2 && (entry.wrong || []).length >= 1;
}

/* Entries for one session: playable ones with the most phrase cards due or new
   first, then the least recently practised. `exclude` (ids just played) go last. */
function lwCollocPick(entries, progress, wordsById, now, n, exclude = []) {
  const scored = entries.filter((e) => lwCollocPlayable(e, wordsById)).map((e) => {
    const live = lwCollocLive(e, wordsById);
    const due = live.filter((p) => { const pr = progress[p.wordId]; return !pr || pr.due <= now; }).length;
    const last = Math.max(0, ...live.map((p) => (progress[p.wordId] && progress[p.wordId].lastSeen) || 0));
    return { e, due, last, ex: exclude.includes(e.id) ? 1 : 0 };
  });
  scored.sort((a, b) => a.ex - b.ex || b.due - a.due || a.last - b.last || (a.e.id < b.e.id ? -1 : 1));
  return scored.slice(0, n).map((s) => s.e);
}

/* Up to `max` phrases for a round, due or new ones first. */
function lwCollocRoundPhrases(entry, progress, wordsById, now, max = 5) {
  const isDue = (p) => { const pr = progress[p.wordId]; return !pr || pr.due <= now; };
  return lwCollocLive(entry, wordsById).slice().sort((a, b) => isDue(b) - isDue(a)).slice(0, max);
}

/* ---------------- Grammar lessons ---------------- */

const LW_LESSON_TASKS = 10; // every lesson test has exactly 10 tasks; 10/10 passes
const LW_XP_LESSON_BONUS = 50; // first completion of a lesson

/* lessons grouped by topic, each topic in `order` (then title), topics A–Z */
function lwLessonTopics(lessons) {
  const by = new Map();
  lessons.forEach((l) => {
    const t = (l.topic || 'Other').trim() || 'Other';
    if (!by.has(t)) by.set(t, []);
    by.get(t).push(l);
  });
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([topic, list]) => ({
    topic,
    lessons: list.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
  }));
}

/* 'locked' | 'new' | 'studied' | 'completed'. A lesson opens once the previous
   lesson of its topic is completed; one the user already studied or completed
   stays open even if an earlier lesson is added later. Admins see all open. */
function lwLessonStatus(lesson, topicLessons, progressByLesson, isAdmin) {
  const p = progressByLesson[lesson.id] || {};
  if (p.completedAt) return 'completed';
  if (p.studiedAt) return 'studied';
  const i = topicLessons.findIndex((l) => l.id === lesson.id);
  const prev = i > 0 ? topicLessons[i - 1] : null;
  if (!isAdmin && prev && !(progressByLesson[prev.id] || {}).completedAt) return 'locked';
  return 'new';
}

/* a typed answer matches when equal ignoring case, extra spaces, apostrophe
   style and trailing punctuation */
const lwNormAnswer = (s) => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'")
  .replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
function lwCheckFill(input, answers) {
  const v = lwNormAnswer(input);
  return !!v && (answers || []).some((a) => lwNormAnswer(a) === v);
}

Object.assign(window, {
  LW_LESSON_TASKS,
  LW_XP_LESSON_BONUS,
  lwLessonTopics,
  lwLessonStatus,
  lwCheckFill,
  lwCollocLive,
  lwCollocPlayable,
  lwCollocPick,
  lwCollocRoundPhrases,
  LW_GOAL_OPTIONS,
  LW_CEFR_ALL,
  lwPracticeMs,
  lwStatusCounts,
  lwLastDays,
  lwTotalMs,
  lwFormatDuration,
  LW_BOXES,
  LW_MASTERED_BOX,
  LW_DEFAULT_DAILY_GOAL,
  LW_XP_CORRECT,
  LW_XP_WRONG,
  LW_XP_GOAL_BONUS,
  lwNextProgress,
  lwWordStatus,
  lwFormatInterval,
  lwLocalDate,
  lwStreak,
  lwTotalXp,
  lwLevel,
});
