/* forms.jsx — Learn → Forms: type a word's principal forms (forms.ts).
   A verb is asked as eu ___ / el ___ / el să ___ / am ___, a noun as ___ casă
   (un / o) and două ___, an adjective as ea e ___ … One word = all its forms in a
   row. The forms have their own FSRS memory (progress of lwFormsId(word.id)):
   all typed right = Know (Easy when quick, like Fill), any after "Show answer" =
   Again, and the word comes back at the end of the round. Every typed form also
   counts as an answer for XP and the daily goal. Only words whose meaning was
   already studied come up, and only when their forms are new or due;
   "Practise all anyway" ignores the schedule. */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { lwFormatInterval } from '../progress.ts';
import { lwFormPrompts, lwFormsDeck, lwFormsId, lwFormsLabel } from '../forms.ts';
import { FillCard, Ic } from '../components.jsx';
import { shuffle } from './shared.jsx';

/* the dictionary form without the Romanian infinitive particle (a lucra → lucra),
   so typing it gets FillCard's "right word, other form" hint */
const lwBareLemma = (w) => String(w || '').trim().replace(/^a\s+/i, '');

function FormsView({ words, selected, groupById, progress, recordAnswer, onStatsChange, lang, goLibrary, goCategory, goStudy }) {
  const now = Date.now();
  const deck = useMemo(() => lwFormsDeck(words, selected, progress, lang, Date.now()), [words, selected, progress, lang]);

  const [queue, setQueue] = useState([]); // word ids still to play this round
  const [current, setCurrent] = useState(null); // { id, step, failed, easy }
  const [known, setKnown] = useState(() => new Set());
  const [answered, setAnswered] = useState(0);
  const [roundSize, setRoundSize] = useState(0);
  const [turn, setTurn] = useState(0); // remounts the card when the same word comes back

  const startWord = useCallback((id) => setCurrent(id ? { id, step: 0, failed: false, easy: true } : null), []);

  const begin = useCallback((all) => {
    const list = all ? deck.ready : deck.due;
    const ids = shuffle(list.map((w) => w.id));
    setKnown(new Set());
    setAnswered(0);
    setRoundSize(ids.length);
    setQueue(ids.slice(1));
    startWord(ids[0] || null);
  }, [deck, startWord]);

  /* a new round when the playable words change (groups picked, forms added, progress loaded) */
  const readyKey = deck.ready.map((w) => w.id).join(',');
  useEffect(() => { begin(false); /* eslint-disable-next-line */ }, [readyKey]);

  useEffect(() => {
    if (onStatsChange) onStatsChange({ knownCount: known.size, poolCount: roundSize, groupCount: selected.length });
  }, [onStatsChange, known, roundSize, selected.length]);

  const word = current ? words.find((w) => w.id === current.id) : null;
  const prompts = word ? lwFormPrompts(word, lang) : [];
  const prompt = current ? prompts[current.step] : null;

  const nextWord = useCallback((q) => {
    const nq = q.slice();
    const id = nq.shift();
    setQueue(nq);
    startWord(id || null);
    setTurn((t) => t + 1);
  }, [startWord]);

  /* the word was deleted or its forms changed mid-round: move on */
  useEffect(() => {
    if (current && !prompt) nextWord(queue);
    // eslint-disable-next-line
  }, [current, word, prompt]);

  const onAnswer = useCallback((dir, info) => {
    if (!current || !word) return;
    if (dir === 'skip') { nextWord(queue); return; }
    const ok = dir === 'known';
    const failed = current.failed || !ok;
    const easy = current.easy && ok && !!(info && info.easy);
    const last = current.step + 1 >= prompts.length;
    if (!last) {
      recordAnswer(null, ok, 'forms'); // activity only; the word's forms are graded once, below
      setCurrent({ ...current, step: current.step + 1, failed, easy });
      setTurn((t) => t + 1);
      return;
    }
    recordAnswer(lwFormsId(word.id), !failed, 'forms', { easy: !failed && easy });
    setAnswered((n) => n + 1);
    if (failed) { nextWord([...queue, word.id]); return; }
    setKnown((s) => new Set(s).add(word.id));
    nextWord(queue);
  }, [current, word, prompts.length, queue, recordAnswer, nextWord]);

  const shuffleDeck = useCallback(() => {
    if (!current) return;
    const ids = shuffle([...queue, current.id]);
    nextWord(ids);
  }, [current, queue, nextWord]);

  if (word && prompt) {
    const group = groupById[word.groupId];
    const entry = { id: word.id + ':' + prompt.key + ':' + turn, word: lwBareLemma(word.word), ipa: '', example: '', exampleTr: word.tr };
    const caption = (
      <>
        <span className="forms-lemma">{word.word}</span>
        <span className="forms-tr">{word.tr}</span>
        <span className="forms-step">{prompt.label} · {current.step + 1} / {prompts.length}</span>
      </>
    );
    return (
      <div className="fill forms">
        <div className="stage">
          <FillCard key={entry.id} entry={entry} group={group} caption={caption}
            blank={{ before: prompt.before, matched: prompt.target, after: prompt.after }}
            onAnswer={onAnswer} onShuffle={shuffleDeck} onGroupClick={goCategory} />
        </div>
        {current.step > 0 && (
          <p className="forms-so-far">{lwFormsLabel({ ...word, forms: Object.fromEntries(prompts.slice(0, current.step).map((p) => [p.key, word.forms[p.key]])) }, lang)}</p>
        )}
      </div>
    );
  }

  /* empty states */
  const nextDue = deck.nextDue;
  const dueNow = deck.due.length;
  return (
    <div className="fill forms">
      <div className="stage">
        {selected.length === 0 ? (
          <div className="empty-card">
            <Ic.Blank width="30" height="30" />
            <p className="empty-title">Select a group to begin</p>
            <p className="empty-sub">Pick one or more study groups.</p>
            <button className="btn btn-primary" onClick={goCategory}><Ic.Tag /> Choose groups</button>
          </div>
        ) : deck.ready.length === 0 && deck.waiting > 0 ? (
          <div className="empty-card">
            <Ic.Cards width="30" height="30" />
            <p className="empty-title">Learn the words first</p>
            <p className="empty-sub">{deck.waiting} {deck.waiting === 1 ? 'word here has' : 'words here have'} forms. They come to Forms once you have studied {deck.waiting === 1 ? 'it' : 'them'} in Cards.</p>
            <button className="btn btn-primary" onClick={goStudy}><Ic.Cards /> Study words</button>
          </div>
        ) : deck.ready.length === 0 ? (
          <div className="empty-card">
            <Ic.Blank width="30" height="30" />
            <p className="empty-title">No forms here yet</p>
            <p className="empty-sub">Verbs, nouns and adjectives with forms come here: eu lucrez, el lucrează, să lucreze, lucrat. Fill them in Library (“Fill forms with AI”) or in the word editor.</p>
            <button className="btn btn-primary" onClick={goLibrary}><Ic.Library /> Open Library</button>
          </div>
        ) : (
          <div className="empty-card">
            <Ic.Check width="30" height="30" />
            <p className="empty-title">{answered > 0 ? 'All forms done!' : 'All caught up!'}</p>
            <p className="empty-sub">
              {answered > 0 ? known.size + ' / ' + roundSize + ' words without a mistake. ' : ''}
              {dueNow === 0 && nextDue ? 'Next forms due in ' + lwFormatInterval(nextDue - now) + '.' : ''}
              {deck.waiting > 0 ? ' ' + deck.waiting + ' more ' + (deck.waiting === 1 ? 'word joins' : 'words join') + ' once studied in Cards.' : ''}
            </p>
            {dueNow > 0 ? (
              <button className="btn btn-primary" onClick={() => begin(false)}><Ic.Shuffle /> Start over</button>
            ) : (
              <button className="btn btn-primary" onClick={() => begin(true)}><Ic.Shuffle /> Practise all anyway</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { FormsView };
