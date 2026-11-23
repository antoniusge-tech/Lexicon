/* types.ts — shapes of the Firestore docs and of the app's in-memory data.
   Types only (no runtime code). A doc read from Firestore also carries its `id`.
   Collection names are LW_COLLECTIONS in firebase.js; the rules are firestore.rules. */

/* ---------------- Common ---------------- */

/** Learning languages (LW_LANGUAGES in data.js). Docs without `lang` are English. */
export type LangCode = 'en' | 'ro';
export type Role = 'user' | 'premium' | 'admin';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
/** LW_POS in data.js; '' when unknown. */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrasal verb' | 'phrase' | 'idiom' | 'other' | '';
/** Epoch milliseconds. */
export type Ms = number;
/** Device-local calendar date, 'YYYY-MM-DD' (lwLocalDate). */
export type LocalDate = string;

/** Fields of user content that is either private or shared by an admin. */
export interface Owned {
  id: string;
  userId: string;
  username?: string;
  /** true = visible to everyone; only admins create shared docs. */
  shared: boolean;
  lang?: LangCode;
}

/* ---------------- users, usernames ---------------- */

export interface SrsSettings {
  /** target chance to recall when a review comes due: 0.85 | 0.9 | 0.95 */
  retention: number;
  /** words per Review session, 0 = no limit */
  session: number;
  /** share of a Focus session given to at-risk words of other groups: 0 | 0.1 | 0.2 */
  background: number;
}

export interface LevelTestResult {
  level: CefrLevel;
  correct: number;
  total: number;
  byLevel: { level: CefrLevel; asked: number; right: number }[];
}

/** users/{uid}. Per-language fields use `<field>_<lang>` for non-English (lwLangField). */
export interface UserDoc {
  id: string;
  username: string;
  role: Role;
  langs?: LangCode[];
  /** language studied now; null right after sign-up */
  lang: LangCode | null;
  createdAt: unknown; // Firestore server timestamp
  dailyGoal?: number;
  cefr?: CefrLevel;
  cefrTarget?: CefrLevel;
  /** 256px JPEG data URL */
  avatar?: string;
  srs?: Partial<SrsSettings>;
  /** groupId → 'paused' (groupState_ro for Romanian) */
  groupState?: Record<string, 'paused'>;
  /** badge id → ms earned (badges_<lang> for non-English) */
  badges?: Record<string, Ms>;
  levelTest?: LevelTestResult & { at?: Ms };
  [langField: string]: unknown;
}

/** usernames/{lowercased username} — enforces unique usernames. */
export interface UsernameDoc {
  uid: string;
}

/* ---------------- groups, words ---------------- */

/** groups/{id}. Nests one level deep; only leaf groups hold words. */
export interface Group extends Owned {
  name: string;
  parentId?: string | null;
  color?: string;
}

/** Principal forms of a word (forms.ts, LW_FORM_SLOTS): what the paradigm follows
    from and can't be guessed (Romanian only). Verb: pres1, pres3, subj3 (without
    să), part; noun: gender (m | f | n), pl; adjective: f, mpl, fpl. */
export interface WordForms {
  pres1?: string;
  pres3?: string;
  subj3?: string;
  part?: string;
  gender?: 'm' | 'f' | 'n' | string;
  pl?: string;
  f?: string;
  mpl?: string;
  fpl?: string;
}

/** words/{id}. lwSetDoc replaces the whole doc, so edits start from the stored one. */
export interface Word extends Owned {
  groupId: string;
  word: string;
  tr?: string;
  ipa?: string;
  example?: string;
  exampleTr?: string;
  pos?: PartOfSpeech;
  /** principal forms, drilled in Learn → Forms (their memory: progress of `<id>~forms`) */
  forms?: WordForms;
  /** data URL or remote image */
  photo?: string;
  /** ms; only on words added since stage 4 */
  createdAt?: Ms;
}

/* ---------------- progress (FSRS), activity ---------------- */

/** How an answer was given; 'choice' grades Hard, a fast 'fill' Easy (lwAnswerGrade). */
export type AnswerMode = 'study' | 'cards' | 'review' | 'choice' | 'fill' | 'forms' | 'colloc' | 'lesson' | 'reading' | 'video';

/** progress/{uid}_{wordId}: the user's memory state for one word. A word's forms
    (Learn → Forms) have their own doc, with wordId = `<word id>~forms` (lwFormsId). */
export interface Progress {
  userId?: string;
  wordId: string;
  /** days until the chance to recall falls to 90% */
  stability?: number;
  /** 1..10 */
  difficulty?: number;
  lastReview?: Ms;
  due: Ms;
  reps: number;
  lapses: number;
  lastSeen?: Ms;
  lastMode?: AnswerMode | string;
  /** legacy Leitner box (0..5) on docs written before FSRS; dropped on the next answer */
  box?: number;
}

/** activity/{uid}_{date} (English) or activity/{uid}_{lang}_{date}. */
export interface Activity {
  userId: string;
  lang: LangCode;
  date: LocalDate;
  answers: number;
  correct: number;
  xp: number;
  goalMet?: boolean;
  /** practice time */
  ms?: number;
}

/* ---------------- reading ---------------- */

export interface ChapterMeta {
  title: string;
  words: number;
  /** the chapter has exercises (Chapter practice) */
  practice?: boolean;
}

/** texts/{id}: meta only; the body is in texts/{id}/chapters/{n}. */
export interface Text extends Owned {
  title: string;
  author?: string;
  level?: CefrLevel | string;
  source?: string;
  chapters: ChapterMeta[];
  wordCount: number;
  createdAt?: Ms;
}

export interface ChapterExercises {
  questions?: unknown[];
  fill?: unknown[];
  bank?: unknown;
  dialogue?: unknown[];
}

/** texts/{id}/chapters/{n} */
export interface Chapter {
  userId: string;
  shared: boolean;
  title: string;
  paragraphs: string[];
  exercises?: ChapterExercises;
}

/** reading_progress/{uid}_{textId} */
export interface ReadingProgress {
  userId: string;
  textId: string;
  chapter: number;
  page: number;
  pct: number;
  updatedAt?: Ms;
  /** practice[chapter][kind] = last score, % */
  practice?: Record<string, Record<string, number>>;
}

/* ---------------- collocations ---------------- */

/** collocations/{id}. Phrases are word cards linked by id; `partner` is the chip text. */
export interface Collocation extends Owned {
  word: string;
  key: string;
  pos?: PartOfSpeech;
  pattern?: string;
  phrases: { wordId: string; partner: string }[];
  wrong: { partner: string; fix?: string }[];
}

/* ---------------- grammar lessons ---------------- */

export type LessonTask =
  | { type: 'choice'; q: string; options: string[]; answer: number; why?: string }
  | { type: 'fill'; q: string; answers: string[]; why?: string };

/** lessons/{id}: shared content written only by admins. Text uses [[highlight]] marks. */
export interface Lesson {
  id: string;
  lang?: LangCode;
  title: string;
  topic: string;
  level?: CefrLevel | string;
  order?: number;
  minutes?: number;
  published?: boolean;
  focus?: string;
  formulas?: unknown[];
  compare?: string;
  compareTable?: { rows: unknown[]; tip?: string };
  examples?: unknown[];
  /** exactly LW_LESSON_TASKS (10) tasks */
  quiz?: LessonTask[];
}

/** lesson_progress/{uid}_{lessonId} */
export interface LessonProgress {
  userId?: string;
  lessonId?: string;
  studiedAt?: Ms;
  attempts?: number;
  last?: number;
  best?: number;
  completedAt?: Ms;
  saved?: boolean;
  /** spaced review of a completed lesson (Grammar → Review), FSRS like a word card */
  srs?: LessonSrs;
}

/** FSRS memory of a lesson's rule; set on completion, updated by each review */
export interface LessonSrs {
  stability: number;
  difficulty: number;
  due: Ms;
  lastReview: Ms;
  reps: number;
  lapses: number;
}

/* ---------------- level test, video clips ---------------- */

/** level_questions/{id} */
export interface LevelQuestion {
  id: string;
  lang: LangCode;
  level: CefrLevel;
  skill?: string;
  q: string;
  options: string[];
  answer: number;
  why?: string;
}

/** clips/{id}: a YouTube fragment (≤ 60 s) for a word or phrase marked [[…]] in the quote. */
export interface Clip {
  id: string;
  lang: LangCode;
  videoId: string;
  start: number;
  end: number;
  quote: string;
  word: string;
  key?: string;
  wordTr?: string;
  ipa?: string;
  pos?: PartOfSpeech;
  quoteTr?: string;
  scene?: string;
}
