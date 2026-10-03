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

Object.assign(window, {
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
