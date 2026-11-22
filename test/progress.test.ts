import { afterEach, describe, expect, it } from 'vitest';
import {
  LW_RELEARN_MS, LW_SRS_DEFAULTS, lwBestStreak, lwCheckFill, lwCollocPick, lwCollocRoundPhrases,
  lwFormatDuration, lwFormatInterval, lwGroupPaused, lwLessonStatus, lwLessonTopics, lwLevel,
  lwLevelTestResult, lwLocalDate, lwNextProgress, lwPracticeMs, lwRetrievability, lwReviewQueue,
  lwSetSrsSettings, lwSrsSettings, lwStatusCounts, lwStreak, lwWordMastery, lwWordStatus,
} from '../progress.ts';

const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 0, 5, 12); // Monday 12:00 UTC (tests run in UTC, see setup.ts)

afterEach(() => lwSetSrsSettings(LW_SRS_DEFAULTS));

/* Play answers on one word: [day, hour, known, mode?, easy?] from T0. */
type Step = [number, number, boolean, string?, boolean?];
function play(steps: Step[], wordId = 'w1') {
  let prog: any = null;
  return steps.map(([d, h, known, mode = 'cards', easy = false]) => {
    prog = lwNextProgress(prog, wordId, known, mode, T0 + d * DAY + h * HOUR, { easy });
    return prog;
  });
}

describe('FSRS memory state matches ts-fsrs 5 (default weights, no fuzz)', () => {
  /* Reference S and D from ts-fsrs 5.4.2 for the same answers. We store S and D
     rounded to 4 decimals and compute the next answer from the rounded values,
     so later steps drift in the 4th decimal: compare within 0.01 %. */
  const cases: [string, Step[], [number, number][]][] = [
    ['Good every time', [[0, 0, true], [2, 0, true], [9, 0, true], [30, 0, true], [90, 0, true]],
      [[2.3065, 2.1181], [10.9643, 2.1112], [36.1236, 2.1043], [99.2732, 2.0975], [250.6429, 2.0906]]],
    ['Again, relearn, lapse', [[0, 0, false], [0, 1, true], [1, 0, true], [5, 0, false], [5, 2, true], [12, 0, true]],
      [[0.212, 6.4133], [0.2467, 6.4021], [2.0215, 6.3909], [0.5749, 8.799], [0.6265, 8.7854], [3.4347, 8.7718]]],
    ['Hard (choice), Easy (fast fill), lapse', [[0, 0, true, 'choice'], [3, 0, true, 'fill', true], [20, 0, true, 'choice'], [60, 0, false]],
      [[1.2931, 5.1122], [13.9353, 3.4641], [39.1394, 5.6464], [2.5858, 8.5542]]],
    ['late review, then lapse', [[0, 0, true], [40, 0, true], [41, 0, false], [45, 0, true]],
      [[2.3065, 2.1181], [40.7204, 2.1112], [2.3761, 7.3922], [8.0457, 7.3801]]],
  ];
  it.each(cases)('%s', (_name, steps, expected) => {
    play(steps).forEach((p, i) => {
      expect(Math.abs(p.stability / expected[i][0] - 1)).toBeLessThan(1e-4);
      expect(Math.abs(p.difficulty / expected[i][1] - 1)).toBeLessThan(1e-4);
    });
  });
});

describe('lwNextProgress', () => {
  it('a new word answered Good is due at 04:00 two study days later', () => {
    const [p] = play([[0, 0, true]]);
    expect(p).toMatchObject({ wordId: 'w1', reps: 1, lapses: 0, lastSeen: T0, lastReview: T0, lastMode: 'cards' });
    expect(p.due).toBe(Date.UTC(2026, 0, 7, 4));
  });

  it('Again counts a lapse and brings the word back in 10 minutes', () => {
    const [p] = play([[0, 0, false]]);
    expect(p.lapses).toBe(1);
    expect(p.due).toBe(T0 + LW_RELEARN_MS);
  });

  it('Know on a word not due yet, on the same study day, changes nothing', () => {
    const [first, again] = play([[0, 0, true], [0, 3, true]]);
    expect(again.stability).toBe(first.stability);
    expect(again.difficulty).toBe(first.difficulty);
    expect(again.due).toBe(first.due);
    expect(again.lastReview).toBe(first.lastReview);
    expect(again.reps).toBe(2); // the answer itself is still counted
  });

  it('the study day starts at 04:00: 03:59 still belongs to the previous day', () => {
    const late = Date.UTC(2026, 0, 6, 3, 59);
    const first = lwNextProgress(null, 'w1', true, 'cards', T0);
    const next = lwNextProgress({ ...first, due: late - 1 }, 'w1', true, 'cards', late);
    const nextDay = lwNextProgress({ ...first, due: late - 1 }, 'w1', true, 'cards', late + 2 * MIN);
    expect(next.stability).toBeLessThan(nextDay.stability!); // same-day formula vs one elapsed day
  });

  it('fuzz is stable for the same word and rep, and differs between words', () => {
    const due = (id: string) => play([[0, 0, true], [2, 0, true], [9, 0, true]], id)[2].due;
    expect(due('a')).toBe(due('a'));
    const spread = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(due));
    expect(spread.size).toBeGreaterThan(1);
  });

  it('a higher target retention schedules the next review sooner', () => {
    const dueAt = (retention: number) => {
      lwSetSrsSettings({ ...LW_SRS_DEFAULTS, retention });
      return play([[0, 0, true], [2, 0, true], [9, 0, true], [30, 0, true]])[3].due;
    };
    const d85 = dueAt(0.85);
    const d90 = dueAt(0.9);
    const d95 = dueAt(0.95);
    expect(d95).toBeLessThan(d90);
    expect(d90).toBeLessThan(d85);
  });

  it('rewrites a legacy Leitner doc in FSRS form', () => {
    const legacy = { wordId: 'w1', box: 3, reps: 4, lapses: 1, lastSeen: T0 - 7 * DAY, due: T0 };
    const p = lwNextProgress(legacy, 'w1', true, 'cards', T0);
    expect(p.box).toBeUndefined();
    expect(p.stability).toBeGreaterThan(7);
    expect(p.reps).toBe(5);
  });
});

describe('word status and mastery', () => {
  it('new / review / learning / mastered', () => {
    expect(lwWordStatus(null, T0)).toBe('new');
    expect(lwWordStatus({ stability: 50, difficulty: 5, lastReview: T0 - DAY, due: T0 }, T0)).toBe('review');
    expect(lwWordStatus({ stability: 5, difficulty: 5, lastReview: T0, due: T0 + DAY }, T0)).toBe('learning');
    expect(lwWordStatus({ stability: 30, difficulty: 5, lastReview: T0, due: T0 + DAY }, T0)).toBe('mastered');
  });

  it('reads a legacy box as stability (box 5 = 30 days = mastered)', () => {
    expect(lwWordStatus({ box: 5, lastSeen: T0 - DAY, due: T0 + DAY }, T0)).toBe('mastered');
    expect(lwWordStatus({ box: 2, lastSeen: T0 - DAY, due: T0 + DAY }, T0)).toBe('learning');
  });

  it('mastery is 0 for new words and 1 from 30 days of stability', () => {
    expect(lwWordMastery(null)).toBe(0);
    expect(lwWordMastery({ stability: 30, difficulty: 5, lastReview: T0 })).toBe(1);
    const half = lwWordMastery({ stability: 4, difficulty: 5, lastReview: T0 });
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });

  it('recall chance is 90% after `stability` days and falls with time', () => {
    const p = { stability: 10, difficulty: 5, lastReview: T0 };
    expect(lwRetrievability(p, T0 + 10 * DAY)).toBeCloseTo(0.9, 6);
    expect(lwRetrievability(p, T0 + 20 * DAY)).toBeLessThan(0.9);
    expect(lwRetrievability(null, T0)).toBe(0);
  });

  it('counts statuses', () => {
    const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const progress = { a: { stability: 40, difficulty: 5, lastReview: T0, due: T0 + DAY }, b: { stability: 1, difficulty: 5, lastReview: T0 - 2 * DAY, due: T0 - DAY } };
    expect(lwStatusCounts(progress, words, T0)).toEqual({ new: 1, learning: 0, review: 1, mastered: 1 });
  });
});

describe('review queue', () => {
  const now = T0;
  const p = (stability: number, daysAgo: number, dueIn: number) => ({ stability, difficulty: 5, lastReview: now - daysAgo * DAY, due: now + dueIn * DAY });
  const words = [
    { id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g2' },
    { id: 'd', groupId: 'g1' }, { id: 'e', groupId: 'g3' }, { id: 'f', groupId: 'g1' },
  ];
  const progress = {
    a: p(1, 10, -1), // due, low recall
    b: p(10, 3, -1), // due, high recall
    c: p(0.5, 10, -1), // due outside the focus, lowest recall
    d: p(10, 1, 5), // not due yet
    e: p(1, 10, -1), // due, but its group is paused
    // f: never studied
  };
  const base = { words, progress, now, focus: ['g1'], isPaused: (g: string) => g === 'g3' };

  it('all: every due word, least likely recalled first, paused groups skipped', () => {
    const q = lwReviewQueue({ ...base, scope: 'all', srs: LW_SRS_DEFAULTS });
    expect(q.ids).toEqual(['c', 'a', 'b']);
    expect(q).toMatchObject({ focusDue: 2, allDue: 3, nextDue: progress.d.due });
  });

  it('focus: due focus words, with a background share of other groups mixed in by risk', () => {
    const q = lwReviewQueue({ ...base, scope: 'focus', srs: { retention: 0.9, session: 50, background: 0.1 } });
    expect(q.ids).toEqual(['c', 'a', 'b']);
    const none = lwReviewQueue({ ...base, scope: 'focus', srs: { retention: 0.9, session: 50, background: 0 } });
    expect(none.ids).toEqual(['a', 'b']);
  });

  it('a paused parent pauses its subgroups', () => {
    const groupById = { child: { id: 'child', parentId: 'top' }, top: { id: 'top' } };
    expect(lwGroupPaused('child', groupById, { top: 'paused' })).toBe(true);
    expect(lwGroupPaused('top', groupById, { child: 'paused' })).toBe(false);
    expect(lwGroupPaused('child', groupById, null)).toBe(false);
  });

  it('review settings fall back to the defaults', () => {
    expect(lwSrsSettings(null)).toEqual(LW_SRS_DEFAULTS);
    expect(lwSrsSettings({ srs: { session: 20 } })).toEqual({ ...LW_SRS_DEFAULTS, session: 20 });
  });
});

describe('streak, XP, time', () => {
  const now = Date.UTC(2026, 0, 10, 12);
  const days = (...ds: number[]) => Object.fromEntries(ds.map((d) => {
    const date = lwLocalDate(Date.UTC(2026, 0, d, 12));
    return [date, { date, answers: 3 }];
  }));

  it('lwLocalDate is the device calendar date', () => {
    expect(lwLocalDate(now)).toBe('2026-01-10');
  });

  it('streak ends today, or yesterday when nothing is answered yet today', () => {
    expect(lwStreak(days(8, 9, 10), now)).toBe(3);
    expect(lwStreak(days(7, 8, 9), now)).toBe(3);
    expect(lwStreak(days(7, 8, 10), now)).toBe(1);
    expect(lwStreak(days(5, 6), now)).toBe(0);
  });

  it('best streak is the longest run ever', () => {
    expect(lwBestStreak(days(1, 2, 3, 4, 7, 8, 10))).toBe(4);
    expect(lwBestStreak({})).toBe(0);
  });

  it('levels: 50 XP → 2, 200 → 3, 450 → 4', () => {
    expect([0, 49, 50, 199, 200, 449, 450].map(lwLevel)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('practice time per answer is capped at a minute', () => {
    expect(lwPracticeMs(null, now)).toBe(0);
    expect(lwPracticeMs(now - 20e3, now)).toBe(20e3);
    expect(lwPracticeMs(now - 10 * MIN, now)).toBe(MIN);
  });

  it('formats intervals and durations', () => {
    expect([10 * MIN, 5 * HOUR, 3 * DAY].map(lwFormatInterval)).toEqual(['10m', '5h', '3d']);
    expect(lwFormatDuration(12 * MIN)).toBe('12m');
    expect(lwFormatDuration(95 * MIN)).toBe('1h 35m');
    expect(lwFormatDuration(120 * MIN)).toBe('2h');
  });
});

describe('grammar lessons', () => {
  it('a typed answer ignores case, spaces, apostrophe style and final punctuation', () => {
    expect(lwCheckFill('  Don’t   go. ', ["don't go"])).toBe(true);
    expect(lwCheckFill('went', ['go', 'went'])).toBe(true);
    expect(lwCheckFill('', [''])).toBe(false);
    expect(lwCheckFill('goes', ['go'])).toBe(false);
  });

  it('topics are sorted A–Z and lessons by order', () => {
    const t = lwLessonTopics([
      { id: '3', topic: 'Verbs', order: 2, title: 'b' }, { id: '1', topic: 'Articles', order: 1, title: 'a' },
      { id: '2', topic: 'Verbs', order: 1, title: 'a' }, { id: '4', title: 'x' },
    ]);
    expect(t.map((x) => x.topic)).toEqual(['Articles', 'Other', 'Verbs']);
    expect(t[2].lessons.map((l) => l.id)).toEqual(['2', '3']);
  });

  it('a lesson opens once the previous one is completed', () => {
    const lessons = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }];
    const prog = { l1: { completedAt: 1 }, l3: { studiedAt: 1 } };
    expect(lessons.map((l) => lwLessonStatus(l, lessons, prog, false))).toEqual(['completed', 'new', 'studied']);
    expect(lwLessonStatus(lessons[2], lessons, {}, false)).toBe('locked');
    expect(lwLessonStatus(lessons[2], lessons, {}, true)).toBe('new');
  });
});

describe('level test result', () => {
  const ans = (level: string, target: number, ok: boolean) => ({ level, target, ok });

  it('is the mean staircase step of the last 10 answers', () => {
    const answers = [...Array(10)].map(() => ans('A2', 1, true))
      .concat([...Array(10)].map((_, i) => ans('B2', 3, i % 3 !== 0)));
    const r = lwLevelTestResult(answers);
    expect(r.level).toBe('B2');
    expect(r).toMatchObject({ total: 20, correct: 16 });
    expect(r.byLevel).toEqual([{ level: 'A2', asked: 10, right: 10 }, { level: 'B2', asked: 10, right: 6 }]);
  });

  it('drops a step when fewer than half the answers at that level were right', () => {
    const answers = [...Array(10)].map((_, i) => ans('B2', 3, i < 4));
    expect(lwLevelTestResult(answers).level).toBe('B1');
  });
});

describe('collocations game', () => {
  const wordsById = { p1: { id: 'p1' }, p2: { id: 'p2' }, p3: { id: 'p3' } };
  const entry = (id: string, phrases: string[], wrong = 1) => ({
    id, phrases: phrases.map((wordId) => ({ wordId, partner: wordId })), wrong: [...Array(wrong)].map(() => ({ partner: 'x' })),
  });

  it('plays only entries with 2+ live phrases and a wrong partner; most due first', () => {
    const entries = [entry('dead', ['p1', 'gone']), entry('nowrong', ['p1', 'p2'], 0), entry('e1', ['p1', 'p2']), entry('e2', ['p2', 'p3'])];
    const progress = { p1: { due: T0 + DAY, lastSeen: T0 }, p2: { due: T0 + DAY, lastSeen: T0 } };
    expect(lwCollocPick(entries, progress, wordsById, T0, 5).map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(lwCollocPick(entries, progress, wordsById, T0, 5, ['e2']).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('a round puts due or new phrases first', () => {
    const progress = { p1: { due: T0 + DAY } };
    expect(lwCollocRoundPhrases(entry('e', ['p1', 'p2', 'p3']), progress, wordsById, T0).map((p) => p.wordId)).toEqual(['p2', 'p3', 'p1']);
  });
});
