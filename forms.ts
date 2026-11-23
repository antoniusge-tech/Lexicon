/* forms.ts — word forms ("principal parts"), pure: no Firestore, no React.
   A word can carry `forms`: the few forms from which the whole paradigm follows
   and that can't be guessed from the dictionary form. A Romanian verb keeps
   eu / el present, the subjunctive and the participle (a lucra → lucrez,
   lucrează, să lucreze, lucrat); a noun its gender and plural; an adjective its
   feminine and plural forms. Only Romanian has slots: English words don't
   change enough to need a drill. Rules that hold for every word (numeral
   agreement, articles, cases) stay in grammar lessons.

   Learn → Forms drills them: each form is asked as a short cue (eu ___,
   el să ___, două ___) and the user types it. The forms have their own FSRS
   memory, separate from the word's meaning, in the progress doc of the word id
   plus LW_FORMS_SUFFIX (lwFormsId), so the progress rules need no change. */

import type { LangCode, PartOfSpeech, Word, WordForms } from './types.ts';

type FormsKind = 'verb' | 'noun' | 'adjective';

/** One form a word of this language and kind keeps. */
interface FormSlot {
  key: keyof WordForms & string;
  /** short label for the form field and the drill caption */
  label: string;
  /** the word typed in the drill comes after this cue ('' = no cue) */
  cue: string;
  /** a choice instead of free text (the noun gender) */
  options?: string[];
}

/** One drill prompt: type `target` between `before` and `after`. */
interface FormPrompt {
  key: string;
  label: string;
  before: string;
  target: string;
  after: string;
}

const LW_FORMS_SUFFIX = '~forms';
const lwFormsId = (wordId: string): string => wordId + LW_FORMS_SUFFIX;

const LW_GENDERS = ['m', 'f', 'n'];
const LW_GENDER_LABEL: Record<string, string> = { m: 'masculine', f: 'feminine', n: 'neuter' };

const LW_FORM_SLOTS: Partial<Record<LangCode, Partial<Record<FormsKind, FormSlot[]>>>> = {
  ro: {
    verb: [
      { key: 'pres1', label: 'eu · present', cue: 'eu' },
      { key: 'pres3', label: 'el, ea · present', cue: 'el' },
      { key: 'subj3', label: 'subjunctive', cue: 'el să' },
      { key: 'part', label: 'participle', cue: 'am' },
    ],
    noun: [
      { key: 'gender', label: 'gender', cue: '', options: LW_GENDERS },
      { key: 'pl', label: 'plural', cue: '' },
    ],
    adjective: [
      { key: 'f', label: 'feminine', cue: 'ea e' },
      { key: 'mpl', label: 'masculine plural', cue: 'ei sunt' },
      { key: 'fpl', label: 'feminine plural', cue: 'ele sunt' },
    ],
  },
};

/* the kind of forms a part of speech has (phrases, adverbs… have none) */
function lwFormsKind(pos: PartOfSpeech | string | null | undefined): FormsKind | null {
  return pos === 'verb' || pos === 'noun' || pos === 'adjective' ? pos : null;
}

/* the forms a word of this language and part of speech keeps, in order */
function lwFormSlots(lang: LangCode | string | null | undefined, pos: PartOfSpeech | string | null | undefined): FormSlot[] {
  const kind = lwFormsKind(pos);
  const byKind = LW_FORM_SLOTS[(lang || 'en') as LangCode];
  return (kind && byKind && byKind[kind]) || [];
}

const lwClean = (v: unknown): string => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);

/* Only the slots of this language and part of speech, trimmed; a gender must be
   m, f or n. undefined when nothing is left, so the field isn't stored. */
function lwNormForms(forms: unknown, lang: LangCode | string | null | undefined,
  pos: PartOfSpeech | string | null | undefined): WordForms | undefined {
  if (!forms || typeof forms !== 'object') return undefined;
  const src = forms as Record<string, unknown>;
  const out: Record<string, string> = {};
  lwFormSlots(lang, pos).forEach((s) => {
    let v = lwClean(src[s.key]);
    if (s.options) v = v.toLowerCase().charAt(0);
    if (v && (!s.options || s.options.includes(v))) out[s.key] = v;
  });
  return Object.keys(out).length ? out : undefined;
}

/* Import column: the forms in slot order, comma-separated ("lucrez, lucrează,
   lucreze, lucrat"; a noun "f, case"). Empty slots stay empty between commas. */
function lwFormsToText(forms: WordForms | null | undefined, lang: LangCode | string | null | undefined,
  pos: PartOfSpeech | string | null | undefined): string {
  if (!forms) return '';
  const vals = lwFormSlots(lang, pos).map((s) => (forms as Record<string, string | undefined>)[s.key] || '');
  while (vals.length && !vals[vals.length - 1]) vals.pop();
  return vals.join(', ');
}
function lwParseFormsText(text: string | null | undefined, lang: LangCode | string | null | undefined,
  pos: PartOfSpeech | string | null | undefined): WordForms | undefined {
  const t = String(text || '').trim();
  if (!t) return undefined;
  const parts = t.split(',').map((p) => p.trim());
  const raw: Record<string, string> = {};
  lwFormSlots(lang, pos).forEach((s, i) => { raw[s.key] = parts[i] || ''; });
  return lwNormForms(raw, lang, pos);
}

/* The forms as a learner reads them on a card: "eu lucrez · el lucrează ·
   el să lucreze · am lucrat"; a noun "f. · pl. case". */
function lwFormsLabel(word: Pick<Word, 'forms' | 'pos'>, lang: LangCode | string | null | undefined): string {
  const forms = word.forms;
  if (!forms) return '';
  return lwFormSlots(lang, word.pos).map((s) => {
    const v = (forms as Record<string, string | undefined>)[s.key];
    if (!v) return '';
    if (s.options) return v + '.';
    if (s.key === 'pl') return 'pl. ' + v;
    return s.cue ? s.cue + ' ' + v : v;
  }).filter(Boolean).join(' · ');
}

/* a reflexive verb (a se spăla / se spăla, a-și aminti / își aminti, or a bare
   lemma whose forms carry the pronoun: grăbi → mă grăbesc) takes its pronoun in
   every form, so the participle isn't asked after "am" (m-am grăbit) */
const lwReflexive = (lemma: string, forms: Record<string, string | undefined>) =>
  /^(?:a\s+)?(?:se|își)\s|^a-și\s/i.test(lemma.trim())
  || /^(?:mă|îmi|se|își)\s/i.test(String(forms.pres1 || forms.pres3 || '').trim());

/* Drill prompts for a word: one per filled form. The noun gender is asked as
   the article (un / o; a neuter noun is "un" in the singular), the plural after
   doi / două, which also shows the agreement. */
function lwFormPrompts(word: Pick<Word, 'word' | 'forms' | 'pos'>, lang: LangCode | string | null | undefined): FormPrompt[] {
  const forms = (word.forms || {}) as Record<string, string | undefined>;
  const gender = forms.gender;
  const out: FormPrompt[] = [];
  lwFormSlots(lang, word.pos).forEach((s) => {
    const v = forms[s.key];
    if (!v) return;
    if (s.key === 'gender') {
      const lemma = String(word.word || '').trim();
      if (!lemma) return;
      out.push({ key: s.key, label: 'un or o?', before: '', target: v === 'f' ? 'o' : 'un', after: ' ' + lemma });
      return;
    }
    let cue = s.cue;
    if (lang === 'ro' && s.key === 'pl') cue = gender === 'm' ? 'doi' : gender ? 'două' : '';
    if (lang === 'ro' && s.key === 'part' && lwReflexive(String(word.word || ''), forms)) cue = '';
    out.push({ key: s.key, label: s.label, before: cue ? cue + ' ' : '', target: v, after: '' });
  });
  return out;
}

/* does any of these words have forms to drill? (Learn shows the Forms mode only then) */
function lwHasForms(words: Pick<Word, 'word' | 'forms' | 'pos'>[], lang: LangCode | string | null | undefined): boolean {
  return lwFormSlots(lang, 'verb').length > 0 && words.some((w) => lwFormPrompts(w, lang).length > 0);
}

/* Words Learn → Forms plays from the chosen groups: forms filled in and the
   meaning already studied (the word has its own progress doc), so forms come
   after the word itself. `due`: those whose forms are new or due now; `waiting`:
   words with forms whose meaning hasn't been studied yet. */
interface FormsDeck<W> { ready: W[]; due: W[]; waiting: number; nextDue: number | null }
function lwFormsDeck<W extends Pick<Word, 'id' | 'groupId' | 'word' | 'forms' | 'pos'>>(words: W[], selected: string[],
  progress: Record<string, { due: number } | undefined>, lang: LangCode | string | null | undefined, now: number): FormsDeck<W> {
  const ready: W[] = [];
  const due: W[] = [];
  let waiting = 0;
  let nextDue: number | null = null;
  words.forEach((w) => {
    if (!selected.includes(w.groupId) || !lwFormPrompts(w, lang).length) return;
    if (!progress[w.id]) { waiting++; return; }
    ready.push(w);
    const p = progress[lwFormsId(w.id)];
    if (!p || p.due <= now) due.push(w);
    else if (nextDue === null || p.due < nextDue) nextDue = p.due;
  });
  return { ready, due, waiting, nextDue };
}

/* What Gemini is asked to fill, per language (Russian, like the other prompts). */
const LW_FORMS_AI_HINT: Partial<Record<LangCode, string>> = {
  ro: 'forms — основные формы слова, по которым строится всё изменение. '
    + 'Для глагола: pres1 — настоящее время, eu (lucrez; у возвратного с местоимением: mă spăl); '
    + 'pres3 — настоящее время, el (lucrează; se spală); subj3 — конъюнктив 3-го лица БЕЗ «să» (lucreze; se spele); '
    + 'part — причастие (lucrat). '
    + 'Для существительного: gender — род: m, f или n (n — средний род, ambigen: un tren — două trenuri); '
    + 'pl — множественное число без артикля (case, trenuri, copii). '
    + 'Для прилагательного: f — женский род ед. ч. (frumoasă), mpl — мужской род мн. ч. (frumoși), fpl — женский род мн. ч. (frumoase). '
    + 'Для остальных частей речи и для словосочетаний — пустой объект.',
};

/* the Gemini response schema of `forms` (every slot of every language, optional) */
const LW_FORMS_AI_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(['pres1', 'pres3', 'subj3', 'part', 'gender', 'pl', 'f', 'mpl', 'fpl']
    .map((k) => [k, { type: 'STRING' }])),
};

export type { FormSlot, FormPrompt, FormsKind, FormsDeck };
export {
  LW_FORMS_SUFFIX, LW_GENDERS, LW_GENDER_LABEL, LW_FORMS_AI_HINT, LW_FORMS_AI_SCHEMA,
  lwFormsId, lwFormsKind, lwFormSlots, lwNormForms, lwFormsToText,
  lwParseFormsText, lwFormsLabel, lwFormPrompts, lwFormsDeck, lwHasForms,
};
