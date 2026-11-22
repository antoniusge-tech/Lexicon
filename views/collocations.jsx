/* collocations.jsx — collocations: the Phrases game (CollocView) and the Library catalog. */

import { useState, useEffect, useMemo } from 'react';
import {
  LW_XP_CORRECT, LW_XP_WRONG, lwCollocLive, lwCollocPick, lwCollocPlayable,
  lwCollocRoundPhrases,
} from '../progress.ts';
import { Ic, Modal, SpeakButton } from '../components.jsx';
import { LW_LIB_PAGE, shuffle } from './shared.jsx';

/* ---------------- Collocations: catalog (Library), entry sheet, game (Learn) ---------------- */
const LW_COLLOC_OWNERS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'shared', label: 'Shared' },
];

const LW_COLLOC_SORTS = [
  { id: 'az', label: 'A–Z' },
  { id: 'recent', label: 'Recent' },
];

const lwCollocAuthor = (e) => (e.shared ? 'Admin' : 'You');

function CollocCatalog({ entries, wordsById, userId, query, owner, sort, setLibField, limit, setLimit, onOpen, onNew }) {
  const liveCards = (e) => lwCollocLive(e, wordsById).map((p) => wordsById[p.wordId]);
  const ownerOk = (e, o) => o === 'all' || (o === 'mine' ? e.userId === userId : !!e.shared);
  const matches = (e) => !query || e.word.includes(query)
    || liveCards(e).some((w) => w.word.toLowerCase().includes(query) || (w.tr || '').toLowerCase().includes(query));
  const counts = {};
  LW_COLLOC_OWNERS.forEach((o) => { counts[o.id] = entries.filter((e) => ownerOk(e, o.id) && matches(e)).length; });
  const list = entries.filter((e) => ownerOk(e, owner) && matches(e)).sort(sort === 'recent'
    ? (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    : (a, b) => a.word.localeCompare(b.word));

  return (
    <div className="colloc-pane">
      <div className="lib-filters">
        <div className="status-chips">
          {LW_COLLOC_OWNERS.map((o) => (
            <button key={o.id} type="button" className={'chip' + (owner === o.id ? ' chip-on' : '')}
              onClick={() => setLibField('collocOwner', o.id)}>
              {o.label} <span className="chip-count">{counts[o.id]}</span>
            </button>
          ))}
        </div>
        <div className="lib-selects">
          <select className="input input-sm" value={sort} onChange={(e) => setLibField('collocSort', e.target.value)} aria-label="Sort">
            {LW_COLLOC_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-card lib-empty">
          <Ic.Link width="26" height="26" />
          <p className="empty-title">{entries.length === 0 ? 'No collocations yet' : 'Nothing matches'}</p>
          <p className="empty-sub">{entries.length === 0
            ? 'Collect phrase cards around a word — “heavy rain”, “heavy traffic” — and practise them in Learn → Phrases.'
            : 'Try another filter or search.'}</p>
          {entries.length === 0 && <button className="btn btn-primary" onClick={onNew}><Ic.Plus /> New collocation</button>}
        </div>
      ) : (
        <div className="ccards">
          {list.slice(0, limit).map((e) => {
            const cards = liveCards(e);
            return (
              <button type="button" className="ccard" key={e.id} onClick={() => onOpen(e)}>
                <span className="ccard-top">
                  <span className="ccard-word">{e.word}</span>
                  {e.pattern && <span className="ccard-pattern">{e.pattern}</span>}
                  <span className={'ccard-author' + (e.shared ? ' admin' : '')}>{lwCollocAuthor(e)}</span>
                </span>
                <span className="ccard-phrases">{cards.map((w) => w.word).join(' · ') || '—'}</span>
                <span className="ccard-foot">
                  <span>{cards.length} {cards.length === 1 ? 'phrase' : 'phrases'} · {(e.wrong || []).length} wrong</span>
                  {cards.length < 2 && <span className="ccard-warn">Needs phrases</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {list.length > limit && (
        <button type="button" className="btn btn-soft lib-more" onClick={() => setLimit((n) => n + LW_LIB_PAGE)}>
          Show more ({list.length - limit})
        </button>
      )}
      <button type="button" className="fab" onClick={onNew} aria-label="New collocation"><Ic.Plus width="24" height="24" /></button>
    </div>
  );
}

function CollocSheet({ entry, wordsById, canEdit, onEdit, onDelete, onClose }) {
  const live = lwCollocLive(entry, wordsById);
  const meta = [entry.pattern, entry.pos].filter(Boolean).join(' · ');
  return (
    <Modal title={entry.word} sheet onClose={onClose}
      footer={canEdit ? <>
        <button className="btn btn-ghost danger-text" onClick={onDelete}><Ic.Trash width="16" height="16" /> Delete</button>
        <button className="btn btn-primary" onClick={onEdit}><Ic.Edit width="16" height="16" /> Edit</button>
      </> : null}>
      <div className="csheet">
        <div className="csheet-meta">
          {meta && <span>{meta}</span>}
          <span className={'ccard-author' + (entry.shared ? ' admin' : '')}>Created by {lwCollocAuthor(entry)}</span>
        </div>
        {live.length < 2 && <p className="ccard-warn csheet-warn">Needs at least 2 phrases to appear in the game.</p>}
        <div className="csheet-list">
          {live.map((p) => {
            const w = wordsById[p.wordId];
            return (
              <div className="csheet-item" key={p.wordId}>
                <div className="csheet-row">
                  <span className="csheet-phrase">{w.word}</span>
                  <span className="csheet-chip">{p.partner}</span>
                  <SpeakButton word={w.word} />
                </div>
                {w.ipa && <div className="csheet-ipa">{w.ipa}</div>}
                <div className="csheet-tr">{w.tr}</div>
                {w.example && <div className="csheet-ex">{w.example}{w.exampleTr && <span className="csheet-ex-tr">{w.exampleTr}</span>}</div>}
              </div>
            );
          })}
        </div>
        {(entry.wrong || []).length > 0 && (
          <div className="csheet-mist">
            <h4 className="csheet-h">Common mistakes</h4>
            {entry.wrong.map((m, i) => (
              <div className="csheet-mist-row" key={i}>
                <span className="csheet-bad"><Ic.Close width="14" height="14" /> {m.partner}</span>
                <span className="colloc-arrow">→</span>
                <span className="csheet-good">{m.fix}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* Game. A session is 5 entries; a round shows the entry's word in the middle and
   up to 8 chips around it (right partners + wrong ones). Answers go to the
   phrase cards' review progress: a right chip is Know for its card; a wrong
   chip is Again for every right phrase not found yet; Hint is Again for the
   hinted phrase. Each card is answered at most once per round. */
const LW_COLLOC_SESSION = 5;

/* chip slots in % of the board: sides first, then top and bottom rows */
const LW_COLLOC_SLOTS = [[22, 30], [78, 30], [22, 70], [78, 70], [27, 8], [73, 8], [27, 92], [73, 92]];

function lwBuildCollocRound(entry, progress, wordsById) {
  const phrases = lwCollocRoundPhrases(entry, progress, wordsById, Date.now(), 5);
  const wrongs = shuffle(entry.wrong || []).slice(0, Math.min(3, 8 - phrases.length));
  const chips = shuffle([
    ...phrases.map((p) => ({ id: 'p' + p.wordId, ok: true, wordId: p.wordId, text: p.partner })),
    ...wrongs.map((w, i) => ({ id: 'w' + i, ok: false, text: w.partner, fix: w.fix })),
  ]).map((c, i) => ({ ...c, x: LW_COLLOC_SLOTS[i][0], y: LW_COLLOC_SLOTS[i][1] }));
  return { entryId: entry.id, chips, found: [], wrong: [], hinted: [], answered: [], card: null, msg: null };
}

function CollocView({ entries, words, progress, now, recordAnswer, goCatalog, goStudy }) {
  const wordsById = useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  const [session, setSession] = useState(null); // { ids, idx, done, stats: { found, mistakes, xp } }
  const [round, setRound] = useState(null);
  const playable = entries.filter((e) => lwCollocPlayable(e, wordsById));
  const byId = (id) => entries.find((e) => e.id === id);

  const start = (exclude = []) => {
    const ids = lwCollocPick(entries, progress, wordsById, Date.now(), LW_COLLOC_SESSION, exclude).map((e) => e.id);
    if (!ids.length) { setSession(null); setRound(null); return; }
    setSession({ ids, idx: 0, done: false, stats: { found: 0, mistakes: 0, xp: 0 } });
    setRound(lwBuildCollocRound(byId(ids[0]), progress, wordsById));
  };
  /* start once entries and words have loaded */
  useEffect(() => { if (!session && playable.length) start(); }, [playable.length, session]); // eslint-disable-line

  const goNext = () => {
    const s = session;
    let idx = s.idx + 1;
    while (idx < s.ids.length && !(byId(s.ids[idx]) && lwCollocPlayable(byId(s.ids[idx]), wordsById))) idx++;
    if (idx >= s.ids.length) { setSession({ ...s, idx, done: true }); setRound(null); return; }
    setSession({ ...s, idx });
    setRound(lwBuildCollocRound(byId(s.ids[idx]), progress, wordsById));
  };
  /* the entry was deleted mid-round */
  const entry = round && byId(round.entryId);
  useEffect(() => { if (round && !entry) goNext(); }); // eslint-disable-line

  const answer = (wordId, known) => {
    recordAnswer(wordId, known, 'colloc');
    const xp = known ? LW_XP_CORRECT : LW_XP_WRONG;
    setSession((s) => ({ ...s, stats: { ...s.stats, xp: s.stats.xp + xp } }));
  };
  const okChips = round ? round.chips.filter((c) => c.ok) : [];
  const pendingIds = () => okChips.filter((c) => !round.found.includes(c.id) && !round.answered.includes(c.wordId)).map((c) => c.wordId);

  const tap = (chip) => {
    if (round.card || round.found.includes(chip.id) || round.wrong.includes(chip.id)) return;
    if (chip.ok) {
      const first = !round.answered.includes(chip.wordId);
      if (first) answer(chip.wordId, true);
      setRound((r) => ({ ...r, found: [...r.found, chip.id], answered: first ? [...r.answered, chip.wordId] : r.answered, card: chip.wordId, msg: null }));
      setSession((s) => ({ ...s, stats: { ...s.stats, found: s.stats.found + 1 } }));
    } else {
      const pending = pendingIds();
      pending.forEach((id) => answer(id, false));
      setRound((r) => ({ ...r, wrong: [...r.wrong, chip.id], answered: [...r.answered, ...pending], msg: chip.fix }));
      setSession((s) => ({ ...s, stats: { ...s.stats, mistakes: s.stats.mistakes + 1 } }));
    }
  };
  const hint = () => {
    const c = okChips.find((x) => !round.found.includes(x.id) && !round.hinted.includes(x.id));
    if (!c) return;
    const first = !round.answered.includes(c.wordId);
    if (first) answer(c.wordId, false);
    setRound((r) => ({ ...r, hinted: [...r.hinted, c.id], answered: first ? [...r.answered, c.wordId] : r.answered }));
  };
  const closeCard = () => {
    const allFound = okChips.every((c) => round.found.includes(c.id));
    if (allFound) goNext();
    else setRound((r) => ({ ...r, card: null }));
  };

  if (!session || (!round && !session.done)) {
    return (
      <div className="empty-card colloc-empty">
        <Ic.Link width="28" height="28" />
        <p className="empty-title">{entries.length === 0 ? 'No collocations yet' : 'Nothing to play yet'}</p>
        <p className="empty-sub">{entries.length === 0
          ? 'Create some in Library → Collocations: pick a word and the phrase cards that go with it.'
          : 'A collocation needs at least 2 phrases and 1 wrong partner to appear here.'}</p>
        <button className="btn btn-primary" onClick={goCatalog}>Open Collocations</button>
      </div>
    );
  }

  if (session.done) {
    const st = session.stats;
    return (
      <div className="colloc-done empty-card">
        <Ic.DoubleCheck width="30" height="30" />
        <p className="empty-title">Session complete</p>
        <div className="colloc-done-stats">
          <span><strong>{st.found}</strong> found</span>
          <span><strong>{st.mistakes}</strong> {st.mistakes === 1 ? 'mistake' : 'mistakes'}</span>
          <span><strong>+{st.xp}</strong> XP</span>
        </div>
        <div className="colloc-done-btns">
          <button className="btn btn-soft" onClick={goStudy}>Back to Cards</button>
          <button className="btn btn-primary" onClick={() => start(session.ids)}>Next {LW_COLLOC_SESSION}</button>
        </div>
      </div>
    );
  }
  if (!entry) return null;

  const cardWord = round.card && wordsById[round.card];
  const foundN = okChips.filter((c) => round.found.includes(c.id)).length;
  return (
    <div className="colloc">
      <div className="colloc-head">
        <span className="colloc-kicker"><Ic.Sparkle width="16" height="16" /> Collocations · Word {session.idx + 1}/{session.ids.length}</span>
        <span className="colloc-count">{foundN}/{okChips.length} found</span>
      </div>
      <div className="colloc-segs">
        {okChips.map((c, i) => <span key={c.id} className={'colloc-seg' + (i < foundN ? ' on' : '')} />)}
      </div>
      <h2 className="colloc-title">Which words go with <em>{entry.word}</em>?</h2>
      <p className="colloc-sub">Tap every word that makes a natural phrase{entry.pattern ? ' (' + entry.pattern + ')' : ''}.</p>

      <div className="cboard">
        <svg className="cboard-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="36" ry="38" className="cboard-orbit" />
          {round.chips.map((c) => (
            <line key={c.id} x1="50" y1="50" x2={c.x} y2={c.y} className={round.found.includes(c.id) ? 'on' : ''} />
          ))}
        </svg>
        <div className="cboard-center">
          <SpeakButton word={entry.word} />
          <span className="cboard-word">{entry.word}</span>
          {entry.pos && <span className="cboard-pos">{entry.pos}</span>}
        </div>
        {round.chips.map((c) => {
          const state = round.found.includes(c.id) ? ' ok' : round.wrong.includes(c.id) ? ' bad' : round.hinted.includes(c.id) ? ' hint' : '';
          return (
            <button key={c.id} type="button" className={'cchip' + state} style={{ left: c.x + '%', top: c.y + '%' }}
              onClick={() => tap(c)} disabled={!!round.card && !state}>
              {state === ' ok' ? <Ic.Check width="14" height="14" /> : state === ' bad' ? <Ic.Close width="14" height="14" /> : <span className="cchip-dot" />}
              {c.text}
            </button>
          );
        })}
      </div>

      {round.msg && !cardWord && (
        <p className="colloc-msg" role="status"><Ic.Close width="15" height="15" /><span>Not quite — we say <strong>{round.msg}</strong>.</span></p>
      )}

      {cardWord ? (
        <div className="cphrase" role="status">
          <div className="cphrase-head">
            <span className="cphrase-title">Great match!</span>
          </div>
          <div className="cphrase-box">
            <div className="cphrase-row">
              <span className="cphrase-phrase">{cardWord.word}</span>
              <SpeakButton word={cardWord.word} />
              {cardWord.ipa && <span className="cphrase-ipa">{cardWord.ipa}</span>}
            </div>
            <div className="cphrase-tr">{cardWord.tr}</div>
          </div>
          {entry.pattern && <span className="cphrase-pattern"><Ic.Sparkle width="14" height="14" /> {entry.pattern}</span>}
          {cardWord.example && (
            <div className="cphrase-ex">
              <span>{cardWord.example}</span>
              {cardWord.exampleTr && <span className="cphrase-ex-tr">{cardWord.exampleTr}</span>}
            </div>
          )}
          <button className="btn btn-primary cphrase-next" onClick={closeCard} autoFocus>
            Continue <Ic.Arrow width="16" height="16" />
          </button>
        </div>
      ) : (
        <div className="colloc-btns">
          <button type="button" className="btn btn-soft" onClick={hint}><Ic.Bulb width="16" height="16" /> Hint</button>
          <button type="button" className="btn btn-soft" onClick={goNext}><Ic.Repeat width="16" height="16" /> Skip</button>
        </div>
      )}
    </div>
  );
}

export {
  CollocCatalog, CollocSheet, CollocView,
};
