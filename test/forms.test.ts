import { describe, expect, it } from 'vitest';
import {
  lwFormPrompts, lwFormSlots, lwFormsDeck, lwFormsId, lwFormsLabel, lwFormsToText,
  lwHasForms, lwNormForms, lwParseFormsText,
} from '../forms.ts';

const verb = { word: 'a lucra', pos: 'verb' as const, forms: { pres1: 'lucrez', pres3: 'lucrează', subj3: 'lucreze', part: 'lucrat' } };
const noun = { word: 'tren', pos: 'noun' as const, forms: { gender: 'n', pl: 'trenuri' } };

describe('slots', () => {
  it('depend on language and part of speech', () => {
    expect(lwFormSlots('ro', 'verb').map((s) => s.key)).toEqual(['pres1', 'pres3', 'subj3', 'part']);
    expect(lwFormSlots('ro', 'noun').map((s) => s.key)).toEqual(['gender', 'pl']);
    expect(lwFormSlots('en', 'verb')).toEqual([]);
    expect(lwFormSlots('en', 'noun')).toEqual([]);
    expect(lwFormSlots('ro', 'phrase')).toEqual([]);
    expect(lwFormSlots('ro', '')).toEqual([]);
  });
});

describe('lwNormForms', () => {
  it('keeps only the slots of the part of speech, trimmed', () => {
    expect(lwNormForms({ pres1: ' lucrez ', pl: 'x', junk: 1 }, 'ro', 'verb')).toEqual({ pres1: 'lucrez' });
  });
  it('accepts a gender as m / f / n only', () => {
    expect(lwNormForms({ gender: 'Feminine', pl: 'case' }, 'ro', 'noun')).toEqual({ gender: 'f', pl: 'case' });
    expect(lwNormForms({ gender: 'x' }, 'ro', 'noun')).toBeUndefined();
  });
  it('gives undefined when nothing is left', () => {
    expect(lwNormForms({}, 'ro', 'verb')).toBeUndefined();
    expect(lwNormForms(null, 'ro', 'verb')).toBeUndefined();
    expect(lwNormForms({ pres1: 'x' }, 'ro', 'adverb')).toBeUndefined();
  });
});

describe('import text', () => {
  it('round-trips in slot order', () => {
    const text = lwFormsToText(verb.forms, 'ro', 'verb');
    expect(text).toBe('lucrez, lucrează, lucreze, lucrat');
    expect(lwParseFormsText(text, 'ro', 'verb')).toEqual(verb.forms);
    expect(lwParseFormsText('f, case', 'ro', 'noun')).toEqual({ gender: 'f', pl: 'case' });
  });
  it('skips empty slots and drops trailing ones', () => {
    expect(lwParseFormsText(', lucrează', 'ro', 'verb')).toEqual({ pres3: 'lucrează' });
    expect(lwFormsToText({ pres1: 'lucrez' }, 'ro', 'verb')).toBe('lucrez');
    expect(lwParseFormsText('', 'ro', 'verb')).toBeUndefined();
    expect(lwParseFormsText('went, gone', 'en', 'verb')).toBeUndefined();
  });
});

describe('lwFormsLabel', () => {
  it('reads like the drill cues', () => {
    expect(lwFormsLabel(verb, 'ro')).toBe('eu lucrez · el lucrează · el să lucreze · am lucrat');
    expect(lwFormsLabel(noun, 'ro')).toBe('n. · pl. trenuri');
    expect(lwFormsLabel({ pos: 'verb' }, 'ro')).toBe('');
  });
});

describe('lwFormPrompts', () => {
  it('asks every filled verb form after its cue', () => {
    expect(lwFormPrompts(verb, 'ro').map((p) => [p.before, p.target, p.after]))
      .toEqual([['eu ', 'lucrez', ''], ['el ', 'lucrează', ''], ['el să ', 'lucreze', ''], ['am ', 'lucrat', '']]);
  });
  it('asks a noun gender as un / o and the plural after doi / două', () => {
    const ps = lwFormPrompts(noun, 'ro');
    expect(ps[0]).toMatchObject({ key: 'gender', before: '', target: 'un', after: ' tren' });
    expect(ps[1]).toMatchObject({ key: 'pl', before: 'două ', target: 'trenuri' });
    const f = lwFormPrompts({ word: 'casă', pos: 'noun', forms: { gender: 'f', pl: 'case' } }, 'ro');
    expect(f.map((p) => p.before + p.target + p.after)).toEqual(['o casă', 'două case']);
    const m = lwFormPrompts({ word: 'copil', pos: 'noun', forms: { gender: 'm', pl: 'copii' } }, 'ro');
    expect(m[1].before).toBe('doi ');
  });
  it('drops the "am" cue for a reflexive verb', () => {
    const ps = lwFormPrompts({ word: 'a se spăla', pos: 'verb', forms: { pres1: 'mă spăl', part: 'spălat' } }, 'ro');
    expect(ps.map((p) => p.before)).toEqual(['eu ', '']);
    const bare = lwFormPrompts({ word: 'se spăla', pos: 'verb', forms: { part: 'spălat' } }, 'ro');
    expect(bare[0].before).toBe('');
    const inForms = lwFormPrompts({ word: 'grăbi', pos: 'verb', forms: { pres1: 'mă grăbesc', part: 'grăbit' } }, 'ro');
    expect(inForms.map((p) => p.before)).toEqual(['eu ', '']);
  });
  it('has nothing for a word without forms', () => {
    expect(lwFormPrompts({ word: 'lucra', pos: 'verb' }, 'ro')).toEqual([]);
    expect(lwFormPrompts({ word: 'lucra', pos: 'verb', forms: {} }, 'ro')).toEqual([]);
  });
  it('lwHasForms: only when some word has forms, and never in English', () => {
    expect(lwHasForms([{ word: 'casă', pos: 'noun' }, verb], 'ro')).toBe(true);
    expect(lwHasForms([{ word: 'casă', pos: 'noun', forms: {} }], 'ro')).toBe(false);
    expect(lwHasForms([{ word: 'go', pos: 'verb', forms: { part: 'gone' } }], 'en')).toBe(false);
  });
});

describe('lwFormsDeck', () => {
  const T = 1_000_000;
  const words = [
    { id: 'a', groupId: 'g', ...verb },
    { id: 'b', groupId: 'g', ...noun },
    { id: 'c', groupId: 'g', word: 'casă', pos: 'noun' as const, forms: { gender: 'f', pl: 'case' } },
    { id: 'd', groupId: 'other', ...verb },
    { id: 'e', groupId: 'g', word: 'repede', pos: 'adverb' as const },
  ];
  it('plays studied words of the chosen groups whose forms are new or due', () => {
    const progress = {
      a: { due: T }, b: { due: T }, d: { due: T }, e: { due: T },
      [lwFormsId('b')]: { due: T + 5 },
    };
    const deck = lwFormsDeck(words, ['g'], progress, 'ro', T);
    expect(deck.ready.map((w) => w.id)).toEqual(['a', 'b']);
    expect(deck.due.map((w) => w.id)).toEqual(['a']);
    expect(deck.waiting).toBe(1); // c: forms, but not studied yet
    expect(deck.nextDue).toBe(T + 5);
  });
  it('keeps the forms memory under its own progress id', () => {
    expect(lwFormsId('w1')).toBe('w1~forms');
  });
});
