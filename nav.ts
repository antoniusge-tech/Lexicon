/* nav.ts — navigation state and its URL (pure, no React).
   App keeps `nav` in state and in localStorage (LW_KEYS.nav), and mirrors it in
   the location hash so screens have links and the browser's Back works:
     #/learn/review            #/reading            #/reading/book/<textId>
     #/reading/ai              #/grammar            #/grammar/lesson/<id>
     #/grammar/lesson/<id>/test                     #/grammar/edit[/<id>]
     #/grammar/review
     #/library  #/profile  #/import  #/admin  #/leveltest
   A hash (not a path) works on GitHub Pages without server rewrites. */

export type Screen = 'learn' | 'reading' | 'grammar' | 'library' | 'profile' | 'import' | 'admin' | 'leveltest';
export type LearnMode = 'cards' | 'review' | 'choice' | 'fill' | 'forms' | 'colloc' | 'video';

export type ReadingNav =
  | { view: 'home' }
  | { view: 'ai' }
  | { view: 'reader'; textId: string };

export type GrammarNav =
  | { view: 'home' }
  | { view: 'review' }
  | { view: 'lesson'; lessonId: string }
  | { view: 'quiz'; lessonId: string }
  | { view: 'edit'; lessonId?: string };

export interface Nav {
  tab: Screen;
  learnMode: LearnMode;
  reading: ReadingNav;
  grammar: GrammarNav;
}

const LW_SCREENS: Screen[] = ['learn', 'reading', 'grammar', 'library', 'profile', 'import', 'admin', 'leveltest'];

/* Learn sub-modes, in tab order. */
const LW_LEARN_MODES: { id: LearnMode; label: string }[] = [
  { id: 'cards', label: 'Cards' },
  { id: 'review', label: 'Review' },
  { id: 'choice', label: 'Choice' },
  { id: 'fill', label: 'Fill' },
  { id: 'forms', label: 'Forms' },
  { id: 'colloc', label: 'Phrases' },
  { id: 'video', label: 'Video' },
];

const isScreen = (s: unknown): s is Screen => LW_SCREENS.includes(s as Screen);
const isLearnMode = (m: unknown): m is LearnMode => LW_LEARN_MODES.some((x) => x.id === m);

function normReading(r: any): ReadingNav {
  if (r && r.view === 'reader' && typeof r.textId === 'string' && r.textId) return { view: 'reader', textId: r.textId };
  if (r && r.view === 'ai') return { view: 'ai' };
  return { view: 'home' };
}

function normGrammar(g: any): GrammarNav {
  const id = g && typeof g.lessonId === 'string' && g.lessonId ? g.lessonId : '';
  if (g && (g.view === 'lesson' || g.view === 'quiz') && id) return { view: g.view, lessonId: id };
  if (g && g.view === 'edit') return id ? { view: 'edit', lessonId: id } : { view: 'edit' };
  if (g && g.view === 'review') return { view: 'review' };
  return { view: 'home' };
}

/** A valid Nav from anything (a saved one, a partial one); bad parts get defaults. */
function lwNormNav(saved: any): Nav {
  const s = saved || {};
  return {
    tab: isScreen(s.tab) ? s.tab : 'learn',
    learnMode: isLearnMode(s.learnMode) ? s.learnMode : 'cards',
    reading: normReading(s.reading),
    grammar: normGrammar(s.grammar),
  };
}

const enc = encodeURIComponent;

/** The hash for a nav state: only the open screen and its sub-screen. */
function lwNavToHash(nav: Nav): string {
  switch (nav.tab) {
    case 'learn':
      return '#/learn/' + nav.learnMode;
    case 'reading':
      if (nav.reading.view === 'reader') return '#/reading/book/' + enc(nav.reading.textId);
      if (nav.reading.view === 'ai') return '#/reading/ai';
      return '#/reading';
    case 'grammar': {
      const g = nav.grammar;
      if (g.view === 'lesson') return '#/grammar/lesson/' + enc(g.lessonId);
      if (g.view === 'quiz') return '#/grammar/lesson/' + enc(g.lessonId) + '/test';
      if (g.view === 'edit') return '#/grammar/edit' + (g.lessonId ? '/' + enc(g.lessonId) : '');
      if (g.view === 'review') return '#/grammar/review';
      return '#/grammar';
    }
    default:
      return '#/' + nav.tab;
  }
}

/** Nav for a hash, keeping the parts the hash doesn't name (the Learn mode while
    on Reading, an open book while on Grammar…) from `prev`. null = not a nav hash. */
function lwHashToNav(hash: string, prev: Nav): Nav | null {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  const [tab, a, b, c] = parts;
  if (!isScreen(tab)) return null;
  const next: Nav = { ...prev, tab };
  if (tab === 'learn' && isLearnMode(a)) next.learnMode = a;
  if (tab === 'reading') {
    if (a === 'book' && b) next.reading = { view: 'reader', textId: b };
    else if (a === 'ai') next.reading = { view: 'ai' };
    else next.reading = { view: 'home' };
  }
  if (tab === 'grammar') {
    if (a === 'lesson' && b) next.grammar = c === 'test' ? { view: 'quiz', lessonId: b } : { view: 'lesson', lessonId: b };
    else if (a === 'edit') next.grammar = b ? { view: 'edit', lessonId: b } : { view: 'edit' };
    else if (a === 'review') next.grammar = { view: 'review' };
    else next.grammar = { view: 'home' };
  }
  return next;
}

export { LW_SCREENS, LW_LEARN_MODES, lwNormNav, lwNavToHash, lwHashToNav };
