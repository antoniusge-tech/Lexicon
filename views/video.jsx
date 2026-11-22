/* video.jsx — Learn → Video: clip sessions and the clip modal. */

import { useState, useEffect, useRef } from 'react';
import { LW_KEYS, lwLoad, lwSave } from '../data.js';
import { LW_XP_CORRECT, LW_XP_WRONG, lwClipPick } from '../progress.ts';
import { lwFindCardForClip, lwSplitQuote, readingTokensMatch } from '../reading.ts';
import { Ic, Modal, SpeakButton, YouTubeClip } from '../components.jsx';
import { AnswerButtons, lwLazy } from './shared.jsx';

/* admin-only, loaded on demand */
const ClipsAdmin = lwLazy(() => import('./video-admin.jsx').then((m) => ({ default: m.ClipsAdmin })));

/* ---------------- Video clips: Learn → Video, admin editor, Library clip window ---------------- */
const LW_VIDEO_SESSION = 10;

const LW_VIDEO_RATES = [1, 0.75, 0.5];

/* the quote as a subtitle: the word or phrase highlighted, or hidden */
function ClipQuote({ clip, masked, plain }) {
  const q = lwSplitQuote(clip.quote);
  return (
    <span className={plain ? 'clip-quote' : 'yt-sub'}>
      “{q.before}{masked ? <span className="clip-gap">___</span> : <mark>{q.target}</mark>}{q.after}”
    </span>
  );
}

/* a typed answer matches the phrase said in the clip or its dictionary form,
   word by word, any form of each word (got the hang of it = get the hang of it) */
function lwVideoAnswerOk(input, clip) {
  const toks = (x) => String(x || '').toLowerCase().replace(/[’]/g, "'").match(/[\p{L}\p{N}']+/gu) || [];
  const got = toks(input);
  if (!got.length) return false;
  return [lwSplitQuote(clip.quote).target, clip.word].some((t) => {
    const want = toks(t);
    return want.length === got.length && want.every((w, i) => w === got[i] || readingTokensMatch(w, got[i]));
  });
}

const lwPlainQuote = (q) => String(q || '').replace(/\[\[|\]\]/g, '');

function VideoView({ clips, words, progress, now, online, recordAnswer, addWord, isAdmin, uid, lang, pushToast }) {
  const [manage, setManage] = useState(false);
  const [mode, setMode] = useState(() => (lwLoad(LW_KEYS.videoMode, 'flip') === 'type' ? 'type' : 'flip'));
  useEffect(() => { lwSave(LW_KEYS.videoMode, mode); }, [mode]);
  const [rate, setRate] = useState(1);
  const [broken, setBroken] = useState([]); // clips whose video failed to load this session
  const [session, setSession] = useState(null); // { ids, idx, done, stats: { right, wrong, xp } }
  const blank = { flipped: false, hint: false, typed: '', answered: null, added: false };
  const [st, setSt] = useState(blank); // the current clip's card state
  const apiRef = useRef(null);
  const cardOf = (c) => lwFindCardForClip(c, words);
  const playable = clips.filter((c) => !broken.includes(c.id));

  const start = (exclude = []) => {
    const ids = lwClipPick(playable, cardOf, progress, Date.now(), LW_VIDEO_SESSION, exclude).map((c) => c.id);
    setSession(ids.length ? { ids, idx: 0, done: false, stats: { right: 0, wrong: 0, xp: 0 } } : null);
    setSt(blank);
  };
  useEffect(() => { if (!session && playable.length) start(); }, [playable.length]); // eslint-disable-line

  const clip = session && !session.done ? clips.find((c) => c.id === session.ids[session.idx]) : null;
  const next = () => {
    setSt(blank);
    setSession((s) => {
      let idx = s.idx + 1;
      while (idx < s.ids.length && !clips.some((c) => c.id === s.ids[idx] && !broken.includes(c.id))) idx++;
      return idx >= s.ids.length ? { ...s, idx, done: true } : { ...s, idx };
    });
  };
  /* the clip was deleted meanwhile */
  useEffect(() => { if (session && !session.done && !clip) next(); }); // eslint-disable-line

  if (manage && isAdmin) return <ClipsAdmin clips={clips} lang={lang} uid={uid} pushToast={pushToast} onBack={() => setManage(false)} />;

  const adminBtn = isAdmin && (
    <button type="button" className="btn btn-soft sm" onClick={() => setManage(true)}><Ic.Edit width="15" height="15" /> Manage clips ({clips.length})</button>
  );
  if (!online) {
    return (
      <div className="empty-card video-empty">
        <Ic.CloudOff width="28" height="28" />
        <p className="empty-title">You're offline</p>
        <p className="empty-sub">Video clips need an internet connection.</p>
      </div>
    );
  }
  if (!clips.length) {
    return (
      <div className="empty-card video-empty">
        <Ic.Play width="28" height="28" />
        <p className="empty-title">No video clips yet</p>
        <p className="empty-sub">{isAdmin ? 'Add clips from YouTube: a short fragment and the phrase said in it.' : 'Clips will appear here soon.'}</p>
        {adminBtn}
      </div>
    );
  }
  if (session && session.done) {
    const x = session.stats;
    return (
      <div className="colloc-done empty-card">
        <Ic.DoubleCheck width="30" height="30" />
        <p className="empty-title">Session complete</p>
        <div className="colloc-done-stats">
          <span><strong>{x.right}</strong> known</span>
          <span><strong>{x.wrong}</strong> to repeat</span>
          <span><strong>+{x.xp}</strong> XP</span>
        </div>
        <div className="colloc-done-btns">
          <button className="btn btn-primary" onClick={() => start(session.ids)}>Next {LW_VIDEO_SESSION} clips</button>
        </div>
        {adminBtn}
      </div>
    );
  }
  if (!clip) return null;

  const card = cardOf(clip);
  const q = lwSplitQuote(clip.quote);
  const answer = (known) => {
    recordAnswer(card ? card.id : null, known, 'video'); // no card: XP and the daily goal only
    setSession((s) => ({ ...s, stats: { ...s.stats, right: s.stats.right + (known ? 1 : 0), wrong: s.stats.wrong + (known ? 0 : 1),
      xp: s.stats.xp + (known ? LW_XP_CORRECT : LW_XP_WRONG) } }));
    if (card && mode === 'flip') next();
    else setSt((x) => ({ ...x, answered: known ? 'known' : 'unknown', flipped: true }));
  };
  const check = () => { if (st.typed.trim()) answer(lwVideoAnswerOk(st.typed, clip)); };
  const add = () => {
    addWord({ word: clip.word, tr: clip.wordTr || '', ipa: clip.ipa || '', pos: clip.pos || '', example: lwPlainQuote(clip.quote), exampleTr: clip.quoteTr || '' })
      .then(() => setSt((x) => ({ ...x, added: true })))
      .catch((e) => pushToast({ kind: 'error', title: 'Could not add the card', msg: (e && e.message) || String(e) }));
  };
  const revealed = st.flipped || st.answered;

  return (
    <div className="video">
      <div className="colloc-head">
        <span className="colloc-kicker"><Ic.Play width="14" height="14" /> Clip {session.idx + 1} / {session.ids.length}</span>
        <div className="seg video-mode">
          <button type="button" className={'seg-btn' + (mode === 'flip' ? ' on' : '')} onClick={() => { setMode('flip'); setSt(blank); }}>Flip</button>
          <button type="button" className={'seg-btn' + (mode === 'type' ? ' on' : '')} onClick={() => { setMode('type'); setSt(blank); }}>Type</button>
        </div>
      </div>
      <div className="colloc-segs">
        {session.ids.map((id, i) => <span key={id} className={'colloc-seg' + (i < session.idx ? ' on' : i === session.idx ? ' cur' : '')} />)}
      </div>

      <YouTubeClip key={clip.id} videoId={clip.videoId} start={clip.start} end={clip.end} rate={rate} apiRef={apiRef}
        overlay={revealed ? <ClipQuote clip={clip} /> : null}
        onError={() => setBroken((b) => (b.includes(clip.id) ? b : [...b, clip.id]))} />

      <div className="video-tools">
        <button type="button" className="btn btn-soft sm" onClick={() => apiRef.current && apiRef.current.replay()}><Ic.Repeat width="15" height="15" /> Replay</button>
        <div className="seg">
          {LW_VIDEO_RATES.map((r) => (
            <button key={r} type="button" className={'seg-btn' + (rate === r ? ' on' : '')} onClick={() => setRate(r)}>{r}×</button>
          ))}
        </div>
        {!revealed && <span className="video-masked"><Ic.Close width="13" height="13" /> Subtitles hidden</span>}
        {broken.includes(clip.id) && <button type="button" className="btn btn-primary sm" onClick={next}>Skip</button>}
      </div>

      <section className="ls-card video-card">
        <p className="quiz-type">{clip.scene ? clip.scene + ' · ' : ''}{clip.pos || (/\s/.test(clip.word) ? 'phrase' : 'word')}</p>
        {mode === 'flip' ? (
          <>
            <h2 className="video-word">{clip.word}</h2>
            {clip.ipa && <p className="video-ipa">/{clip.ipa}/</p>}
            {!revealed ? (
              st.hint ? (
                <p className="video-quote"><ClipQuote clip={clip} masked plain /></p>
              ) : (
                <div className="video-mask">
                  <span className="video-dots">[ • • • • • • • • • • ]</span>
                  <span className="video-mask-sub">Listen to the clip — what is said around it?</span>
                  <button type="button" className="btn btn-ghost sm" onClick={() => setSt((x) => ({ ...x, hint: true }))}><Ic.Bulb width="15" height="15" /> Show hint</button>
                </div>
              )
            ) : (
              <>
                <p className="video-tr">{clip.wordTr}</p>
                <SpeakButton word={clip.word} />
                <div className="video-quote-box">
                  <ClipQuote clip={clip} plain />
                  {clip.quoteTr && <span className="video-quote-tr">{clip.quoteTr}</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="video-tr video-tr-hint">{clip.wordTr}</p>
            <p className="video-quote"><ClipQuote clip={clip} masked={!st.answered} plain /></p>
            {!st.answered ? (
              <form className="quiz-fill" onSubmit={(e) => { e.preventDefault(); check(); }}>
                <input className="input quiz-input" value={st.typed} placeholder="Type the missing words" autoComplete="off" autoCapitalize="off" spellCheck="false"
                  onChange={(e) => setSt((x) => ({ ...x, typed: e.target.value }))} />
                <button type="submit" className="btn btn-primary" disabled={!st.typed.trim()}>Check</button>
              </form>
            ) : (
              <div className={'quiz-feedback' + (st.answered === 'known' ? ' ok' : ' bad')} role="status">
                <p className="quiz-feedback-title">{st.answered === 'known' ? 'Correct!' : 'Not quite — it is “' + q.target + '”'}</p>
                {clip.quoteTr && <p className="quiz-why">{clip.quoteTr}</p>}
              </div>
            )}
          </>
        )}
      </section>

      {mode === 'flip' && !st.flipped && (
        <div className="colloc-btns">
          <button type="button" className="btn btn-soft" onClick={() => apiRef.current && apiRef.current.replay()}><Ic.Repeat width="16" height="16" /> Replay</button>
          <button type="button" className="btn btn-primary" onClick={() => setSt((x) => ({ ...x, flipped: true }))}>Flip card <Ic.Arrow width="16" height="16" /></button>
        </div>
      )}
      {mode === 'flip' && st.flipped && !st.answered && (
        <AnswerButtons prog={card ? progress[card.id] : null} wordId={card ? card.id : clip.id} onAnswer={(a) => answer(a === 'known')} />
      )}
      {st.answered && (
        <div className="video-after">
          {card ? (
            <span className="video-note"><Ic.Check width="15" height="15" /> Saved to your card “{card.word}”</span>
          ) : st.added ? (
            <span className="video-note"><Ic.Check width="15" height="15" /> Added to “From video”</span>
          ) : (
            <button type="button" className="btn btn-soft" onClick={add}><Ic.Plus width="16" height="16" /> Add to cards</button>
          )}
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>Next <Ic.Arrow width="16" height="16" /></button>
        </div>
      )}
      {isAdmin && <div className="video-admin">{adminBtn}</div>}
    </div>
  );
}

/* Library: a word's clip in a window */
function ClipModal({ clip, onClose }) {
  return (
    <Modal title={clip.word} onClose={onClose}>
      <div className="clip-modal">
        <YouTubeClip videoId={clip.videoId} start={clip.start} end={clip.end} overlay={<ClipQuote clip={clip} />} />
        {clip.wordTr && <p className="video-tr">{clip.wordTr}</p>}
        {clip.quoteTr && <p className="video-quote-tr">{clip.quoteTr}</p>}
      </div>
    </Modal>
  );
}

export {
  ClipModal, ClipQuote, VideoView,
};
