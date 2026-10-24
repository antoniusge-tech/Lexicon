/* progress.jsx — pure FSRS / streak / XP logic (no Firestore, no React).
   Storage lives in firebase.jsx (lwRecordAnswer); App wires the two together. */

const LW_MIN_MS = 60 * 1000;
const LW_DAY_MS = 24 * 60 * LW_MIN_MS;

const LW_DEFAULT_DAILY_GOAL = 20; // answers per day
const LW_XP_CORRECT = 10;
const LW_XP_WRONG = 5;
const LW_XP_GOAL_BONUS = 50;
const LW_GOAL_OPTIONS = [10, 20, 30, 50]; // daily goal choices, in answers
const LW_CEFR_ALL = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LW_PRACTICE_GAP_MS = 60 * 1000; // longer pauses between answers don't count as practice

/* ---------------- FSRS-6 scheduler ----------------
   Each word card carries a memory state: stability S (days until the chance to
   recall falls to 90%) and difficulty D (1..10). Every answer updates both, and
   the next review is set where the chance to recall drops to the user's target
   retention. Formulas and default weights follow ts-fsrs 5 (FSRS-6). */
const LW_FSRS_W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const LW_FSRS_DECAY = -LW_FSRS_W[20];
const LW_FSRS_FACTOR = Math.pow(0.9, 1 / LW_FSRS_DECAY) - 1;
const LW_FSRS_S_MIN = 0.001;
const LW_FSRS_S_MAX = 36500;

const LW_RELEARN_MS = 10 * LW_MIN_MS; // Again: the word comes back in this session
const LW_MASTERED_DAYS = 30; // stability from which a word counts as Mastered
const LW_DAY_START_MS = 4 * 60 * LW_MIN_MS; // a study day starts at 04:00 local time

/* Grade per answer: 1 Again, 2 Hard, 3 Good, 4 Easy. Picking the right option
   (choice) only proves recognition, so it is Hard; recall is Good; a word typed
   quickly with no mistake or hint (fill) is Easy. */
const LW_MODE_GRADE = { choice: 2 };
function lwAnswerGrade(known, mode, easy) {
  if (!known) return 1;
  if (mode === 'fill' && easy) return 4;
  return LW_MODE_GRADE[mode] || 3;
}

/* Review settings, stored as users/{uid}.srs (one set for every language).
   session: words per Review session (0 = no limit); background: share of a
   Focus session given to the most at-risk due words outside the focus groups. */
const LW_SRS_DEFAULTS = { retention: 0.9, session: 50, background: 0.1 };
const LW_RETENTION_OPTIONS = [0.85, 0.9, 0.95];
const LW_SESSION_OPTIONS = [20, 50, 100, 0];
const LW_BACKGROUND_OPTIONS = [0, 0.1, 0.2];
function lwSrsSettings(userDoc) {
  return { ...LW_SRS_DEFAULTS, ...((userDoc && userDoc.srs) || {}) };
}
/* App sets the current settings while rendering, like lwSetCurrentLang, so
   every lwNextProgress call (answers, button labels) uses the same retention */
let lwSrsCurrent = LW_SRS_DEFAULTS;
function lwSetSrsSettings(s) { lwSrsCurrent = s || LW_SRS_DEFAULTS; }

const lwClampD = (d) => Math.min(10, Math.max(1, d));
const lwClampS = (s) => Math.min(LW_FSRS_S_MAX, Math.max(LW_FSRS_S_MIN, s));
const lwFsrsInitDRaw = (g) => LW_FSRS_W[4] - Math.exp((g - 1) * LW_FSRS_W[5]) + 1;
const lwFsrsInitS = (g) => Math.max(LW_FSRS_W[g - 1], 0.1);

/* chance to recall after t days at stability s */
function lwFsrsRecall(t, s) {
  return Math.pow(1 + LW_FSRS_FACTOR * t / s, LW_FSRS_DECAY);
}
function lwFsrsNextD(d, g) {
  const w = LW_FSRS_W;
  const next = d + (-w[6] * (g - 3)) * (10 - d) / 9;
  return lwClampD(w[7] * lwFsrsInitDRaw(4) + (1 - w[7]) * next);
}
/* new stability: t whole days since the last review, r the chance to recall now */
function lwFsrsNextS(d, s, t, r, g) {
  const w = LW_FSRS_W;
  if (t === 0) { // again on the same day
    const inc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
    return lwClampS(s * (g >= 2 ? Math.max(inc, 1) : inc));
  }
  if (g === 1) {
    const forget = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return lwClampS(Math.min(s / Math.exp(w[17] * w[18]), forget));
  }
  const hard = g === 2 ? w[15] : 1;
  const easy = g === 4 ? w[16] : 1;
  return lwClampS(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard * easy));
}

/* study-day number of a timestamp (local date, days start at 04:00) */
function lwSrsDay(t) {
  const d = new Date(t - LW_DAY_START_MS);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / LW_DAY_MS);
}
/* 04:00 local time, `days` study days after the one containing `now` */
function lwSrsDayStart(now, days) {
  const d = new Date(now - LW_DAY_START_MS);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime() + LW_DAY_START_MS;
}

/* stable pseudo-random number in [0, 1) for a string (interval fuzz) */
function lwHash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/* days until the next review for stability s, with ts-fsrs' fuzz so words
   learnt together don't all come back on the same day */
function lwFsrsInterval(s, elapsed, seed, retention) {
  const modifier = (Math.pow(retention, 1 / LW_FSRS_DECAY) - 1) / LW_FSRS_FACTOR;
  const ivl = Math.min(LW_FSRS_S_MAX, Math.max(1, Math.round(s * modifier)));
  if (ivl < 2.5) return ivl;
  let delta = 1;
  [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]].forEach(([from, to, f]) => {
    delta += f * Math.max(Math.min(ivl, to) - from, 0);
  });
  let lo = Math.max(2, Math.round(ivl - delta));
  const hi = Math.min(Math.round(ivl + delta), LW_FSRS_S_MAX);
  if (ivl > elapsed) lo = Math.max(lo, elapsed + 1);
  lo = Math.min(lo, hi);
  return Math.floor(lwHash01(seed) * (hi - lo + 1) + lo);
}

/* Memory state of a progress doc. Docs written before FSRS have only a Leitner
   `box` (10 min, 1, 3, 7, 14, 30 days): the box interval becomes the stability
   and each lapse (up to 3) raises the difficulty, as FSRS would after Again. */
const LW_LEGACY_BOX_DAYS = [LW_FSRS_W[0], 1, 3, 7, 14, 30];
function lwCardMemory(prog) {
  if (prog.stability) return { s: prog.stability, d: prog.difficulty || lwClampD(lwFsrsInitDRaw(3)), last: prog.lastReview || prog.lastSeen || 0 };
  let d = lwClampD(lwFsrsInitDRaw(3));
  for (let i = 0; i < Math.min(prog.lapses || 0, 3); i++) d = lwFsrsNextD(d, 1);
  const s = LW_LEGACY_BOX_DAYS[Math.min(prog.box || 0, LW_LEGACY_BOX_DAYS.length - 1)];
  return { s, d, last: prog.lastSeen || (prog.due ? prog.due - s * LW_DAY_MS : 0) };
}

/* chance (0..1) that the word is recalled now; 0 for a word never studied */
function lwRetrievability(prog, now) {
  if (!prog) return 0;
  const m = lwCardMemory(prog);
  return lwFsrsRecall(Math.max(0, (now - m.last) / LW_DAY_MS), m.s);
}

const lwRound4 = (x) => Math.round(x * 1e4) / 1e4;

/* Next progress doc for a word after one answer. `prev` is the stored doc or
   null for a word never studied. `opts.easy`: a fill answer typed quickly with
   no mistake. Know on a word that isn't due yet, on the same study day as its
   last review, changes nothing, so a word can't be ground to Mastered in one
   evening. Again always counts as a lapse and brings the word back in 10 min. */
function lwNextProgress(prev, wordId, known, mode, now, opts = {}) {
  const g = lwAnswerGrade(known, mode, opts.easy);
  const base = prev || { wordId, reps: 0, lapses: 0 };
  const next = { ...base, wordId, reps: (base.reps || 0) + 1, lastSeen: now, lastMode: mode };
  delete next.box; // legacy Leitner field
  let s, d, t = 0;
  if (!prev) {
    s = lwFsrsInitS(g);
    d = lwClampD(lwFsrsInitDRaw(g));
  } else {
    const m = lwCardMemory(prev);
    t = Math.max(0, lwSrsDay(now) - lwSrsDay(m.last));
    if (known && prev.due > now && t === 0) {
      return { ...next, stability: lwRound4(m.s), difficulty: lwRound4(m.d), lastReview: m.last };
    }
    const r = lwFsrsRecall(t, m.s);
    s = lwFsrsNextS(m.d, m.s, t, r, g);
    d = lwFsrsNextD(m.d, g);
  }
  next.stability = lwRound4(s);
  next.difficulty = lwRound4(d);
  next.lastReview = now;
  if (!known) {
    next.lapses = (base.lapses || 0) + 1;
    next.due = now + LW_RELEARN_MS;
  } else {
    const retention = lwSrsCurrent.retention || LW_SRS_DEFAULTS.retention;
    next.due = lwSrsDayStart(now, lwFsrsInterval(s, t, wordId + ':' + next.reps, retention));
  }
  return next;
}

/* 'new' | 'learning' | 'review' (due now) | 'mastered' */
function lwWordStatus(prog, now) {
  if (!prog) return 'new';
  if (prog.due <= now) return 'review';
  return lwCardMemory(prog).s >= LW_MASTERED_DAYS ? 'mastered' : 'learning';
}

/* 0..1 for the Mastery bar: stability on a log scale, full at LW_MASTERED_DAYS */
function lwWordMastery(prog) {
  if (!prog) return 0;
  return Math.min(1, Math.log(1 + lwCardMemory(prog).s) / Math.log(1 + LW_MASTERED_DAYS));
}

/* ---------------- Review queue ----------------
   Due words, most likely forgotten first. Words of paused groups never come up.
   scope 'all': every due word. scope 'focus': due words of the focus groups,
   with `background` of the first session given to the most at-risk due words
   from other groups (mixed in by risk). Returns the ordered ids plus counts. */
function lwReviewQueue({ words, progress, now, focus, scope, isPaused, srs }) {
  const due = [];
  let nextDue = null; // soonest upcoming review in this scope, for the empty state
  words.forEach((w) => {
    const p = progress[w.id];
    if (!p || isPaused(w.groupId)) return;
    const inFocus = focus.includes(w.groupId);
    if (p.due > now) {
      if ((scope === 'all' || inFocus) && (nextDue === null || p.due < nextDue)) nextDue = p.due;
      return;
    }
    due.push({ id: w.id, focus: inFocus, r: lwRetrievability(p, now) });
  });
  due.sort((a, b) => a.r - b.r);
  const main = due.filter((x) => x.focus);
  const counts = { focusDue: main.length, allDue: due.length, nextDue };
  if (scope === 'all') return { ids: due.map((x) => x.id), ...counts };
  const others = due.filter((x) => !x.focus);
  const cap = srs.session > 0 ? Math.min(srs.session, main.length) : main.length;
  const bgN = Math.min(others.length, Math.ceil(cap * (srs.background || 0)));
  const room = Math.max(cap - bgN, Math.min(main.length, 1));
  const first = [...main.slice(0, room), ...others.slice(0, bgN)].sort((a, b) => a.r - b.r);
  return { ids: [...first, ...main.slice(room)].map((x) => x.id), ...counts };
}

/* a group's words skip Review while it, or its parent group, is paused */
function lwGroupPaused(groupId, groupById, groupState) {
  if (!groupState) return false;
  const g = groupById[groupId];
  return groupState[groupId] === 'paused' || !!(g && g.parentId && groupState[g.parentId] === 'paused');
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

/* ---------------- Badges ----------------
   Computed on the device from data the app already has; users/{uid}.badges
   only remembers when each one was earned, so it stays earned. */

/* longest run of consecutive active days ever */
function lwBestStreak(activityByDate) {
  const days = Object.values(activityByDate).filter((a) => a.answers > 0).map((a) => a.date).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  days.forEach((d) => {
    const t = Date.parse(d + 'T12:00:00');
    run = prev != null && Math.round((t - prev) / LW_DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  });
  return best;
}

const lwBadge = (id, group, icon, title, text, metric, target, unit) => ({ id, group, icon, title, text, metric, target, unit });
const LW_BADGES = [
  lwBadge('streak-3', 'Streak', '🔥', '3-day streak', 'Study 3 days in a row', 'bestStreak', 3, 'days'),
  lwBadge('streak-7', 'Streak', '🔥', 'Week streak', 'Study 7 days in a row', 'bestStreak', 7, 'days'),
  lwBadge('streak-30', 'Streak', '🔥', 'Month streak', 'Study 30 days in a row', 'bestStreak', 30, 'days'),
  lwBadge('streak-100', 'Streak', '☄️', '100-day streak', 'Study 100 days in a row', 'bestStreak', 100, 'days'),
  lwBadge('goal-1', 'Daily goal', '🎯', 'Goal reached', 'Reach your daily goal', 'goalDays', 1, 'days'),
  lwBadge('goal-7', 'Daily goal', '🎯', 'Goal ×7', 'Reach your daily goal on 7 days', 'goalDays', 7, 'days'),
  lwBadge('goal-30', 'Daily goal', '🏅', 'Goal ×30', 'Reach your daily goal on 30 days', 'goalDays', 30, 'days'),
  lwBadge('answers-100', 'Practice', '✅', '100 answers', 'Answer 100 cards and tasks', 'answers', 100, 'answers'),
  lwBadge('answers-1000', 'Practice', '✅', '1,000 answers', 'Answer 1,000 cards and tasks', 'answers', 1000, 'answers'),
  lwBadge('answers-5000', 'Practice', '💯', '5,000 answers', 'Answer 5,000 cards and tasks', 'answers', 5000, 'answers'),
  lwBadge('words-25', 'Words', '📝', 'Collector', 'Add 25 words of your own', 'ownWords', 25, 'words'),
  lwBadge('mastered-10', 'Words', '⭐', '10 mastered', 'Master 10 words', 'mastered', 10, 'words'),
  lwBadge('mastered-100', 'Words', '🌟', '100 mastered', 'Master 100 words', 'mastered', 100, 'words'),
  lwBadge('mastered-500', 'Words', '👑', '500 mastered', 'Master 500 words', 'mastered', 500, 'words'),
  lwBadge('time-1h', 'Time', '⏱️', 'First hour', 'Practise for 1 hour in total', 'hours', 1, 'h'),
  lwBadge('time-10h', 'Time', '⏳', '10 hours', 'Practise for 10 hours in total', 'hours', 10, 'h'),
  lwBadge('level-5', 'Level', '🚀', 'Level 5', 'Reach level 5', 'level', 5, 'level'),
  lwBadge('level-10', 'Level', '🏆', 'Level 10', 'Reach level 10', 'level', 10, 'level'),
  lwBadge('book-1', 'Reading', '📖', 'Bookworm', 'Finish a book', 'booksDone', 1, 'books'),
  lwBadge('book-3', 'Reading', '📚', 'Reader', 'Finish 3 books', 'booksDone', 3, 'books'),
  lwBadge('lesson-1', 'Grammar', '🎓', 'First lesson', 'Complete a grammar lesson', 'lessonsDone', 1, 'lessons'),
  lwBadge('topic-1', 'Grammar', '🧠', 'Topic master', 'Complete every lesson of a grammar topic', 'topicsDone', 1, 'topics'),
  lwBadge('colloc-1', 'Collocations', '🧩', 'Word partners', 'Create your first collocation', 'ownCollocs', 1, 'entries'),
  lwBadge('leveltest-1', 'Level', '🧭', 'Level checked', 'Take the level test', 'levelTests', 1, 'tests'),
];

/* metric values from the app's data */
function lwBadgeMetrics({ uid, activity, progress, words, readingProgress, lessons, lessonProgress, collocations, levelTest, now }) {
  const acts = Object.values(activity);
  const xp = lwTotalXp(activity);
  const done = (l) => (lessonProgress[l.id] || {}).completedAt;
  const topics = lwLessonTopics(lessons);
  return {
    bestStreak: lwBestStreak(activity),
    goalDays: acts.filter((a) => a.goalMet).length,
    answers: acts.reduce((n, a) => n + (a.answers || 0), 0),
    ownWords: words.filter((w) => w.userId === uid).length,
    mastered: lwStatusCounts(progress, words, now).mastered,
    hours: lwTotalMs(activity) / 3600000,
    level: lwLevel(xp),
    booksDone: Object.values(readingProgress).filter((r) => (r.pct || 0) >= 99).length,
    lessonsDone: lessons.filter(done).length,
    topicsDone: topics.filter((t) => t.lessons.length && t.lessons.every(done)).length,
    ownCollocs: collocations.filter((c) => c.userId === uid).length,
    levelTests: levelTest ? 1 : 0,
  };
}

/* every badge with its progress; earned = stored, or reached right now */
function lwBadgeStates(metrics, earned) {
  return LW_BADGES.map((b) => {
    const value = metrics[b.metric] || 0;
    const at = (earned || {})[b.id] || null;
    return { badge: b, value, target: b.target, reached: value >= b.target, earnedAt: at };
  });
}

/* ---------------- Level test (adaptive, any language) ----------------
   A staircase over the CEFR levels: right → the next question is one level
   up, wrong (or "I don't know") → one level down. Questions never repeat; when
   a level runs out the nearest level with questions is used. */
const LW_LEVEL_TEST_LEN = 20;
const LW_LEVEL_TEST_MIN_BANK = 30; // fewer questions in a language → the test isn't offered
const LW_CEFR_NAMES = { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-intermediate', C1: 'Advanced', C2: 'Proficient' };

/* next question at `level` (index 0–5) or the nearest one, from questions not asked yet */
function lwLevelTestPick(bank, askedIds, level) {
  const left = bank.filter((q) => !askedIds.includes(q.id));
  for (let d = 0; d < LW_CEFR_ALL.length; d++) {
    for (const i of d === 0 ? [level] : [level + d, level - d]) {
      const at = left.filter((q) => q.level === LW_CEFR_ALL[i]);
      if (at.length) return at[Math.floor(Math.random() * at.length)];
    }
  }
  return null;
}
const lwLevelIndex = (lv) => Math.max(0, LW_CEFR_ALL.indexOf(lv));

/* answers: [{ level, target, ok }] in order — `level` of the question asked,
   `target` the staircase step it was asked for (they differ when a level ran
   out of questions). Result: the mean target of the last 10 answers
   (rounded), one step lower if fewer than half of the answers at that level were
   right. Plus the per-level tally for the result screen. */
function lwLevelTestResult(answers) {
  const tail = answers.slice(-10);
  const step = (a) => (a.target != null ? a.target : lwLevelIndex(a.level));
  let idx = tail.length ? Math.round(tail.reduce((n, a) => n + step(a), 0) / tail.length) : 0;
  const at = answers.filter((a) => a.level === LW_CEFR_ALL[idx]);
  if (idx > 0 && at.length && at.filter((a) => a.ok).length * 2 < at.length) idx--;
  const byLevel = LW_CEFR_ALL.map((lv) => {
    const list = answers.filter((a) => a.level === lv);
    return { level: lv, asked: list.length, right: list.filter((a) => a.ok).length };
  }).filter((x) => x.asked);
  return { level: LW_CEFR_ALL[idx], correct: answers.filter((a) => a.ok).length, total: answers.length, byLevel };
}

/* ---------------- Video clips: session order ----------------
   Clips whose card is due first, then the ones that are new to the user (no
   card, or a card never studied), then the rest; random within each group.
   `cardOf(clip)` → the user's card or null. `exclude`: ids just played go last. */
function lwClipPick(clips, cardOf, progress, now, n, exclude = []) {
  const rank = (c) => {
    if (exclude.includes(c.id)) return 9;
    const card = cardOf(c);
    const p = card && progress[card.id];
    if (p && p.due <= now) return 0;
    if (!p) return 1;
    return 2;
  };
  return clips.map((c) => ({ c, r: rank(c), k: Math.random() }))
    .sort((a, b) => a.r - b.r || a.k - b.k).slice(0, n).map((x) => x.c);
}

Object.assign(window, {
  lwClipPick,
  LW_LEVEL_TEST_LEN,
  LW_LEVEL_TEST_MIN_BANK,
  LW_CEFR_NAMES,
  lwLevelTestPick,
  lwLevelIndex,
  lwLevelTestResult,
  LW_BADGES,
  lwBestStreak,
  lwBadgeMetrics,
  lwBadgeStates,
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
  LW_RELEARN_MS,
  LW_MASTERED_DAYS,
  LW_SRS_DEFAULTS,
  LW_RETENTION_OPTIONS,
  LW_SESSION_OPTIONS,
  LW_BACKGROUND_OPTIONS,
  lwSrsSettings,
  lwSetSrsSettings,
  lwRetrievability,
  lwWordMastery,
  lwReviewQueue,
  lwGroupPaused,
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
