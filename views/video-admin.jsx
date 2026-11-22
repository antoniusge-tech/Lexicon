/* video-admin.jsx — Learn → Video → Manage clips (admins). */

import { useState, useRef } from 'react';
import { LW_COLLECTIONS, lwDeleteDoc, lwSetDoc } from '../firebase.js';
import { LW_POS, lwLangInfo, lwUid } from '../data.js';
import {
  Ic, Modal, YouTubeClip, lwFormatTime, lwParseTime, lwParseYouTube,
} from '../components.jsx';
import { ClipQuote } from './video.jsx';

function ClipsAdmin({ clips, lang, uid, pushToast, onBack }) {
  const info = lwLangInfo(lang);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = clips.filter((c) => !q || c.word.toLowerCase().includes(q) || (c.scene || '').toLowerCase().includes(q) || c.quote.toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const fail = (title) => (e) => pushToast({ kind: 'error', title, msg: (e && e.message) || String(e) });
  const save = (c) => {
    const t = Date.now();
    lwSetDoc(LW_COLLECTIONS.clips, {
      ...c, id: c.id || lwUid() + lwUid(), lang, key: c.word.toLowerCase(),
      userId: c.userId || uid, shared: true, createdAt: c.createdAt || t, updatedAt: t,
    }).catch(fail('Could not save the clip'));
    setForm(null);
  };
  return (
    <div className="grammar">
      <div className="ls-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Chevron width="16" height="16" style={{ transform: 'rotate(90deg)' }} /> Video</button>
      </div>
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Video clips</h1>
          <p className="lib-sub">{info.name} · {clips.length} {clips.length === 1 ? 'clip' : 'clips'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({})}><Ic.Plus /> New clip</button>
      </div>
      {clips.length > 0 && (
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder="Search clips…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="gr-list">
        {list.map((c) => (
          <div className="gr-item clip-item" key={c.id}>
            <button type="button" className="gr-item-main" onClick={() => setForm(c)}>
              <img className="clip-thumb" src={'https://i.ytimg.com/vi/' + c.videoId + '/mqdefault.jpg'} alt="" loading="lazy" />
              <span className="gr-item-text">
                <span className="gr-item-title">{c.word}</span>
                <span className="gr-item-meta">{c.scene && <span>{c.scene}</span>}<span>{lwFormatTime(c.start)}–{lwFormatTime(c.end)}</span><span>{Math.round(c.end - c.start)} s</span></span>
              </span>
            </button>
            <div className="gr-item-tools">
              <button type="button" className="icon-btn sm danger" aria-label="Delete" onClick={() => setConfirm(c)}><Ic.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      {form && (
        <Modal title={form.id ? 'Edit clip' : 'New clip'} onClose={() => setForm(null)}>
          <ClipForm initial={form} onSave={save} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Delete clip" onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const c = confirm;
              setConfirm(null);
              lwDeleteDoc(LW_COLLECTIONS.clips, c.id).catch(fail('Could not delete the clip'));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete the clip for <strong>{confirm.word}</strong>? Cards made from it stay.</p>
        </Modal>
      )}
    </div>
  );
}

const LW_CLIP_MAX = 60; // seconds

function ClipForm({ initial, onSave, onCancel }) {
  const [url, setUrl] = useState(initial.videoId ? 'https://youtu.be/' + initial.videoId : '');
  const [startTxt, setStartTxt] = useState(initial.videoId ? lwFormatTime(initial.start) : '');
  const [endTxt, setEndTxt] = useState(initial.videoId ? lwFormatTime(initial.end) : '');
  const [f, setF] = useState(() => ({ quote: '', word: '', wordTr: '', ipa: '', pos: '', quoteTr: '', scene: '', ...initial }));
  const [wordTouched, setWordTouched] = useState(!!initial.id);
  const [preview, setPreview] = useState(false);
  const [tried, setTried] = useState(false);
  const pickRef = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const yt = lwParseYouTube(url);
  const startS = lwParseTime(startTxt);
  const endS = lwParseTime(endTxt);
  const marks = (f.quote.match(/\[\[(.+?)\]\]/g) || []).length;
  /* a new link with ?t= sets the start */
  const onUrl = (v) => {
    setUrl(v);
    const p = lwParseYouTube(v);
    if (p && p.t != null && !startTxt) setStartTxt(lwFormatTime(p.t));
  };
  const onQuote = (v) => {
    set('quote', v);
    const m = v.match(/\[\[(.+?)\]\]/);
    if (m && !wordTouched) set('word', m[1].trim());
  };
  const now = (setter) => { const t = pickRef.current ? pickRef.current.time() : 0; setter(lwFormatTime(Math.round(t * 10) / 10)); };

  const errors = [];
  if (!yt) errors.push('Paste a YouTube link.');
  if (startS == null || endS == null) errors.push('Set the start and the end (e.g. 0:04 and 0:09).');
  else if (endS <= startS) errors.push('The end must be after the start.');
  else if (endS - startS > LW_CLIP_MAX) errors.push('A clip can be at most ' + LW_CLIP_MAX + ' seconds.');
  if (marks !== 1) errors.push('Mark the word or phrase in the quote with [[double brackets]] — exactly once.');
  if (!f.word.trim()) errors.push('Enter the word or phrase.');
  if (!f.wordTr.trim()) errors.push('Enter its translation.');
  const clip = yt && startS != null && endS != null ? { ...f, videoId: yt.videoId, start: startS, end: endS } : null;

  const submit = () => {
    setTried(true);
    if (errors.length) return;
    onSave({ ...clip, quote: f.quote.trim(), word: f.word.trim(), wordTr: f.wordTr.trim(), ipa: f.ipa.trim().replace(/^\/|\/$/g, ''),
      quoteTr: f.quoteTr.trim(), scene: f.scene.trim() });
  };

  if (preview && clip && !errors.length) {
    return (
      <div className="form clip-form">
        <div className="lf-preview-bar">
          <span className="lf-preview-label">Preview</span>
          <button type="button" className="btn btn-soft sm" onClick={() => setPreview(false)}><Ic.Edit width="15" height="15" /> Back to editor</button>
        </div>
        <YouTubeClip key={'p' + clip.videoId + clip.start + clip.end} videoId={clip.videoId} start={clip.start} end={clip.end} overlay={<ClipQuote clip={clip} />} />
        <div className="ls-card video-card">
          <h2 className="video-word">{clip.word}</h2>
          {clip.ipa && <p className="video-ipa">/{clip.ipa}/</p>}
          <p className="video-tr">{clip.wordTr}</p>
          <div className="video-quote-box"><ClipQuote clip={clip} plain />{clip.quoteTr && <span className="video-quote-tr">{clip.quoteTr}</span>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="form clip-form">
      <label className="field">
        <span className="field-label">YouTube link</span>
        <input className="input" value={url} autoFocus={!initial.id} placeholder="https://www.youtube.com/watch?v=…&t=42s" onChange={(e) => onUrl(e.target.value)} />
        {url && !yt && <span className="field-hint">This doesn't look like a YouTube link.</span>}
      </label>
      {yt && (
        <>
          <YouTubeClip key={'f' + yt.videoId} videoId={yt.videoId} free apiRef={pickRef} />
          <p className="field-hint">Play the video, pause at the right moment and press “Set start” / “Set end”.</p>
          <div className="form-grid clip-times">
            <label className="field">
              <span className="field-label">Start</span>
              <div className="lf-row">
                <input className="input input-sm" value={startTxt} placeholder="0:04" onChange={(e) => setStartTxt(e.target.value)} />
                <button type="button" className="btn btn-soft sm" onClick={() => now(setStartTxt)}>Set start</button>
              </div>
            </label>
            <label className="field">
              <span className="field-label">End{startS != null && endS != null && endS > startS ? ' · ' + Math.round((endS - startS) * 10) / 10 + ' s' : ''}</span>
              <div className="lf-row">
                <input className="input input-sm" value={endTxt} placeholder="0:09" onChange={(e) => setEndTxt(e.target.value)} />
                <button type="button" className="btn btn-soft sm" onClick={() => now(setEndTxt)}>Set end</button>
              </div>
            </label>
          </div>
        </>
      )}
      <label className="field">
        <span className="field-label">Quote from the clip</span>
        <input className="input" value={f.quote} placeholder="Once you [[get the hang of it]], everything becomes much easier." onChange={(e) => onQuote(e.target.value)} />
        <span className="field-hint">Mark the word or phrase with [[double brackets]] — it is hidden in the hint and highlighted after flipping.</span>
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Word or phrase (dictionary form)</span>
          <input className="input" value={f.word} placeholder="get the hang of it" onChange={(e) => { setWordTouched(true); set('word', e.target.value); }} />
        </label>
        <label className="field">
          <span className="field-label">Translation</span>
          <input className="input" value={f.wordTr} placeholder="наловчиться" onChange={(e) => set('wordTr', e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Transcription</span>
          <input className="input mono" value={f.ipa} placeholder="ɡet ðə hæŋ əv ɪt" onChange={(e) => set('ipa', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Part of speech</span>
          <select className="input" value={f.pos || ''} onChange={(e) => set('pos', e.target.value)}>
            <option value="">—</option>
            {LW_POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Quote translation</span>
        <input className="input" value={f.quoteTr} placeholder="Как только наловчишься, всё станет гораздо проще." onChange={(e) => set('quoteTr', e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Scene (optional)</span>
        <input className="input" value={f.scene} placeholder="Cafe talk" onChange={(e) => set('scene', e.target.value)} />
      </label>
      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-soft" onClick={() => { setTried(true); if (!errors.length) setPreview(true); }}>Preview</button>
        <button type="button" className="btn btn-primary" onClick={submit}>{initial.id ? 'Save changes' : 'Add clip'}</button>
      </div>
    </div>
  );
}

export {
  ClipsAdmin,
};
