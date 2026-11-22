import { describe, expect, it } from 'vitest';
import { lwHashToNav, lwNavToHash, lwNormNav, type Nav } from '../nav.ts';

const base: Nav = lwNormNav(null);

describe('lwNormNav', () => {
  it('defaults to Learn → Cards with home sub-screens', () => {
    expect(base).toEqual({ tab: 'learn', learnMode: 'cards', reading: { view: 'home' }, grammar: { view: 'home' } });
  });

  it('keeps valid saved parts and drops bad ones', () => {
    expect(lwNormNav({ tab: 'grammar', learnMode: 'nope', reading: { view: 'reader' }, grammar: { view: 'quiz', lessonId: 'L1' } }))
      .toEqual({ tab: 'grammar', learnMode: 'cards', reading: { view: 'home' }, grammar: { view: 'quiz', lessonId: 'L1' } });
    expect(lwNormNav({ tab: 'admin', reading: { view: 'reader', textId: 'T1' } }).reading).toEqual({ view: 'reader', textId: 'T1' });
  });
});

describe('nav ↔ hash', () => {
  const cases: [string, Partial<Nav>][] = [
    ['#/learn/review', { tab: 'learn', learnMode: 'review' }],
    ['#/reading', { tab: 'reading', reading: { view: 'home' } }],
    ['#/reading/ai', { tab: 'reading', reading: { view: 'ai' } }],
    ['#/reading/book/abc123', { tab: 'reading', reading: { view: 'reader', textId: 'abc123' } }],
    ['#/grammar', { tab: 'grammar', grammar: { view: 'home' } }],
    ['#/grammar/lesson/L1', { tab: 'grammar', grammar: { view: 'lesson', lessonId: 'L1' } }],
    ['#/grammar/lesson/L1/test', { tab: 'grammar', grammar: { view: 'quiz', lessonId: 'L1' } }],
    ['#/grammar/edit', { tab: 'grammar', grammar: { view: 'edit' } }],
    ['#/grammar/edit/L1', { tab: 'grammar', grammar: { view: 'edit', lessonId: 'L1' } }],
    ['#/library', { tab: 'library' }],
    ['#/leveltest', { tab: 'leveltest' }],
  ];

  it.each(cases)('%s', (hash, part) => {
    const nav = { ...base, ...part } as Nav;
    expect(lwNavToHash(nav)).toBe(hash);
    expect(lwHashToNav(hash, base)).toEqual(nav);
  });

  it('keeps what the hash does not name from the previous state', () => {
    const prev: Nav = { ...base, learnMode: 'fill', reading: { view: 'reader', textId: 'T1' } };
    expect(lwHashToNav('#/grammar/lesson/L2', prev)).toEqual({ ...prev, tab: 'grammar', grammar: { view: 'lesson', lessonId: 'L2' } });
    expect(lwHashToNav('#/learn', prev)).toEqual({ ...prev, tab: 'learn' });
  });

  it('encodes ids', () => {
    const nav: Nav = { ...base, tab: 'reading', reading: { view: 'reader', textId: 'a b/c' } };
    expect(lwNavToHash(nav)).toBe('#/reading/book/a%20b%2Fc');
    expect(lwHashToNav(lwNavToHash(nav), base)).toEqual(nav);
  });

  it('ignores hashes that are not screens', () => {
    expect(lwHashToNav('', base)).toBeNull();
    expect(lwHashToNav('#', base)).toBeNull();
    expect(lwHashToNav('#/nowhere', base)).toBeNull();
    expect(lwHashToNav('#section-2', base)).toBeNull();
  });
});
