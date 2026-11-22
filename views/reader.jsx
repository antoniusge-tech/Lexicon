/* reader.jsx — Reading: books list, reader, word sheet, AI reading cards. */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { lwGetChapter, lwSaveReadingProgress } from '../firebase.js';
import {
  LW_CEFR_LEVELS, LW_KEYS, LW_TEXT_LENGTHS, LW_TEXT_TOPICS, lwAiLookupWord,
  lwAiTranslateSentences, lwHasGeminiKey, lwLoad, lwSave, lwUid, lwUtterance,
} from '../data.js';
import { LW_CEFR_ALL, lwWordStatus } from '../progress.ts';
import {
  LW_LETTERS, lwCleanGutenberg, lwFindCardForClip, lwMatchOwnWord, lwPaginate,
  lwSplitChapters, lwSplitSentences, lwTokenize, lwWordCount, readingTokensMatch,
} from '../reading.ts';
import {
  GeminiKeyModal, Ic, Modal, PronunciationCheck, SpeakButton, WordForm, lwCanRecognize,
  lwLeafGroups,
} from '../components.jsx';
import {
  LW_IMPORT_ERROR_MSG, LW_READING_ERROR_MSG, LW_READING_GROUP, LW_READING_GROUP_NAME,
  StatusBadge,
} from './shared.jsx';
import { ChapterPractice, ChapterPracticeMenu } from './chapter-practice.jsx';

/* ---------------- Reading view (AI-generated text from a category) ---------------- */

/* split the highlight phrase into meaningful sub-words (drops filler like "on") */
function readingPhraseTokens(highlight) {
  return String(highlight || '').match(new RegExp('[' + LW_LETTERS + '0-9’\']+', 'g')) || [];
}

/* render a sentence, wrapping tokens that match the active highlighted word/phrase in <mark>.
   Supports multi-word phrases (on cloud 9, work out) by matching a run of tokens. */
function ReadingSentenceText({ text, highlight }) {
  if (!highlight) return text;
  const target = readingPhraseTokens(highlight);
  if (target.length === 0) return text;

  /* split keeping delimiters so we can re-join verbatim */
  const parts = String(text).split(new RegExp('([' + LW_LETTERS + '0-9’\']+)'));
  /* map word-part indices (odd positions) to their token order */
  const wordIdx = [];
  for (let i = 1; i < parts.length; i += 2) wordIdx.push(i);

  /* mark which parts belong to a match */
  const marked = new Array(parts.length).fill(false);
  for (let k = 0; k <= wordIdx.length - target.length; k++) {
    let ok = true;
    for (let t = 0; t < target.length; t++) {
      if (!readingTokensMatch(parts[wordIdx[k + t]], target[t])) { ok = false; break; }
    }
    if (!ok) continue;
    /* mark the words and any delimiters between them (so "work out" highlights as one) */
    const from = wordIdx[k];
    const to = wordIdx[k + target.length - 1];
    for (let p = from; p <= to; p++) marked[p] = true;
  }

  /* collapse consecutive marked parts into single <mark> spans */
  const out = [];
  let buf = '';
  let bufKey = null;
  const flush = () => {
    if (bufKey !== null) { out.push(<mark key={'m' + bufKey} className="reading-hl">{buf}</mark>); buf = ''; bufKey = null; }
  };
  parts.forEach((part, i) => {
    if (marked[i]) {
      if (bufKey === null) bufKey = i;
      buf += part;
    } else {
      flush();
      out.push(part);
    }
  });
  flush();
  return out;
}

function ReadingView({ groups, words, countByGroup, reading, setReading, startGenerate, defaultLevel, wordIndex, progress, now, addWord, onBack, goLibrary }) {
  const leafGroups = useMemo(
    () => (lwLeafGroups ? lwLeafGroups(groups) : groups).filter((g) => countByGroup[g.id] > 0),
    [groups, countByGroup]
  );

  const [groupId, setGroupId] = useState('');
  const [levels, setLevels] = useState(() => [LW_CEFR_LEVELS.includes(defaultLevel) ? defaultLevel : defaultLevel === 'A1' ? 'A2' : 'B1']);
  const [topicIds, setTopicIds] = useState([LW_TEXT_TOPICS[0].id]);
  const [keyModal, setKeyModal] = useState(false);

  const toggleLevel = (lv) =>
    setLevels((sel) => (sel.includes(lv) ? sel.filter((x) => x !== lv) : [...sel, lv]));
  const toggleTopic = (id) =>
    setTopicIds((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  /* transient UI state for the text side */
  const [activeWord, setActiveWord] = useState(null);   // word highlighted in the text
  const [openSentence, setOpenSentence] = useState(-1); // index of sentence whose RU is shown
  const [showFullRu, setShowFullRu] = useState(false);  // lightbulb: whole-text translation
  const [sheet, setSheet] = useState(null);              // tapped word: { token, sentence, sentenceTr }

  const cards = reading.cards || [];
  const index = Math.min(reading.index || 0, Math.max(0, cards.length - 1));
  const result = cards[index] || null; // текущая карточка
  /* сторона определяется наличием текстов: пока пачка непустая — показываем
     тексты, как только все прочитаны (пачка пуста) — открываются настройки. */
  const showText = cards.length > 0;
  /* generation status/error live in App (survive tab switches) */
  const state = reading.status === 'loading' ? 'loading' : (reading.error || 'idle');
  const atLast = index === cards.length - 1;

  /* переключение между карточками: сбрасываем UI-состояние показа текста */
  const goToCard = (i) => {
    if (i < 0 || i >= cards.length || i === index) return;
    resetTextUi();
    setReading((r) => ({ ...r, index: i }));
  };

  /* «Дальше»: листаем к следующему тексту пачки (автодогрузки нет — когда
     все тексты прочитаны, пользователь сам запускает новую генерацию). */
  const goNext = () => {
    if (index < cards.length - 1) goToCard(index + 1);
  };

  /* default to the first available category once groups load */
  useEffect(() => {
    if (!groupId && leafGroups.length) setGroupId(leafGroups[0].id);
  }, [leafGroups, groupId]);

  /* перелистывание карточек пачки стрелками клавиатуры, когда открыт текст */
  useEffect(() => {
    if (!showText || !cards.length) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' && index < cards.length - 1) { goToCard(index + 1); }
      else if (e.key === 'ArrowLeft' && index > 0) { goToCard(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showText, cards.length, index]);

  const activeGroup = leafGroups.find((g) => g.id === groupId) || null;
  const groupWords = useMemo(
    () => (activeGroup ? words.filter((w) => w.groupId === activeGroup.id) : []),
    [words, activeGroup]
  );

  const resetTextUi = () => { setActiveWord(null); setOpenSentence(-1); setShowFullRu(false); };

  const runGenerate = () => {
    if (!activeGroup || reading.status === 'loading') return;
    const pool = groupWords.map((w) => w.word).filter(Boolean);
    if (!pool.length) {
      setReading((r) => ({ ...r, error: 'empty' }));
      return;
    }
    /* передаём весь набор выбранных уровней и тем — batch раскидает их
       случайно по текстам пачки (свой случайный срез до 60 слов на каждый). */
    const pickedLevels = levels.length ? levels : ['B1'];
    const chosenTopics = LW_TEXT_TOPICS.filter((t) => topicIds.includes(t.id));
    const topics = chosenTopics.length ? chosenTopics : [LW_TEXT_TOPICS[0]];
    const topicPrompts = topics.map((t) => t.prompt);
    resetTextUi();
    /* fire-and-forget: App owns the promise and the toast on completion */
    startGenerate({ pool, levels: pickedLevels, topicPrompts, lengthWords: LW_TEXT_LENGTHS[1].words });
  };

  const generate = () => {
    if (!activeGroup) return;
    if (!lwHasGeminiKey()) { setKeyModal(true); return; }
    runGenerate();
  };

  /* "Прочитано": удалить текущий текст из пачки. Когда пачка опустеет,
     showText станет false и автоматически откроются настройки. */
  const markRead = () => {
    resetTextUi();
    setReading((r) => {
      const rest = (r.cards || []).filter((_, i) => i !== index);
      if (!rest.length) return { cards: [], index: 0, status: 'idle', error: null };
      return { ...r, cards: rest, index: Math.min(index, rest.length - 1), status: 'idle', error: null };
    });
  };

  if (leafGroups.length === 0) {
    return (
      <div className="reading">
      <div className="reading-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Reading</button>
        <span className="reading-back-title">AI practice</span>
      </div>
        <div className="empty-card">
          <Ic.Book width="30" height="30" />
          <p className="empty-title">No words yet</p>
          <p className="empty-sub">Add words to a group first, then generate a text from them.</p>
          <button className="btn btn-primary" onClick={goLibrary}><Ic.Plus /> Add words</button>
        </div>
      </div>
    );
  }

  /* show only the words we asked for that actually appear in the generated text */
  const usedSet = result ? new Set(result.used.map((w) => w.toLowerCase())) : null;
  const usedWords = result && result.source
    ? result.source.filter((w) => usedSet.has(w.toLowerCase()))
    : [];
  const sentences = (result && result.sentences) || [];

  const toggleWord = (w) => setActiveWord((cur) => (cur === w ? null : w));

  return (
    <div className="reading">
      <div className="reading-back-row">
        <button type="button" className="btn btn-ghost sm" onClick={onBack}><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Reading</button>
        <span className="reading-back-title">AI practice</span>
      </div>
      <div className={'reading-scene' + (showText ? ' is-flipped' : '')}>
        <div className="reading-inner">
          {/* ---------- FRONT: settings ---------- */}
          <div className="reading-face reading-front">
            <div className="reading-controls">
              <label className="field">
                <span className="field-label">Group</span>
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {leafGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({countByGroup[g.id]})</option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span className="field-label">Level (CEFR)</span>
                <div className="chips">
                  {LW_CEFR_LEVELS.map((lv) => (
                    <button key={lv} type="button"
                      className={'chip' + (levels.includes(lv) ? ' chip-on' : '')}
                      onClick={() => toggleLevel(lv)}>{lv}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Topic</span>
                <div className="chips">
                  {LW_TEXT_TOPICS.map((t) => (
                    <button key={t.id} type="button"
                      className={'chip' + (topicIds.includes(t.id) ? ' chip-on' : '')}
                      onClick={() => toggleTopic(t.id)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-cta-study"
                disabled={state === 'loading' || !activeGroup || !levels.length || !topicIds.length}
                onClick={generate}>
                {state === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="16" height="16" />}
                {state === 'loading' ? 'Generating...' : 'Generate cards'}
              </button>

              {state === 'bad-key' ? (
                <p className="field-hint">Your Gemini key is invalid.{' '}
                  <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Change key</button>
                </p>
              ) : state !== 'idle' && state !== 'loading' && (
                <p className="field-hint">{LW_READING_ERROR_MSG[state] || LW_READING_ERROR_MSG.error}</p>
              )}
            </div>
          </div>

          {/* ---------- BACK: generated text ---------- */}
          <div className="reading-face reading-back">
            {result && (
              <article className="reading-result">
                <div className="reading-head">
                  <div className="reading-head-main">
                    {result.title && <h2 className="reading-title">{result.title}</h2>}
                    <div className="reading-meta">
                      {result.level && <span className="reading-level">{result.level}</span>}
                      {cards.length > 1 && (
                        <span className="reading-counter">{index + 1} / {cards.length}</span>
                      )}
                    </div>
                  </div>
                  <button className="reading-bulb" type="button" title="Translate the whole text"
                    aria-pressed={showFullRu}
                    onClick={() => { setShowFullRu((v) => !v); setOpenSentence(-1); }}>
                    <Ic.Bulb width="18" height="18" />
                  </button>
                </div>

                <p className="reading-text">
                  {sentences.map((s, i) => (
                    <React.Fragment key={i}>
                      <span
                        className={'reading-sentence' + (openSentence === i ? ' open' : '')}
                        onClick={() => { setOpenSentence((cur) => (cur === i ? -1 : i)); setShowFullRu(false); }}>
                        {activeWord ? <ReadingSentenceText text={s.en} highlight={activeWord} /> : (
                          <TapText text={s.en} wordIndex={wordIndex} progress={progress} now={now}
                            activeToken={sheet && sheet.sentence === s.en ? sheet.token : null}
                            onTap={(tok) => setSheet({ token: tok, sentence: s.en, sentenceTr: s.ru || '' })} />
                        )}
                      </span>
                      {openSentence === i && s.ru && (
                        <span className="reading-sentence-ru">{s.ru}</span>
                      )}
                      {i < sentences.length - 1 ? ' ' : null}
                    </React.Fragment>
                  ))}
                </p>

                {showFullRu && result.textRu && (
                  <p className="reading-text reading-text-ru">{result.textRu}</p>
                )}

                {usedWords.length > 0 && (
                  <div className="reading-words">
                    <span className="field-label">Words from the group (tap to highlight):</span>
                    <div className="reading-word-tags">
                      {usedWords.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={'reading-word-tag used'
                            + (activeWord === w ? ' active' : '')}
                          onClick={() => toggleWord(w)}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {cards.length > 1 && (
                  <div className="reading-nav">
                    <button className="reading-nav-btn" type="button" title="Previous text"
                      disabled={index === 0}
                      onClick={() => goToCard(index - 1)}>
                      <Ic.Arrow style={{ transform: 'scaleX(-1)' }} />
                    </button>
                    <div className="reading-dots">
                      {cards.map((c, i) => (
                        <button key={c.id || i} type="button"
                          className={'reading-dot' + (i === index ? ' on' : '')}
                          title={'Text ' + (i + 1)}
                          aria-current={i === index}
                          onClick={() => goToCard(i)} />
                      ))}
                    </div>
                    <button className="reading-nav-btn" type="button" title="Next text"
                      disabled={atLast}
                      onClick={goNext}>
                      <Ic.Arrow />
                    </button>
                  </div>
                )}

                <div className="reading-actions">
                  <button className="btn btn-primary sm" onClick={markRead} type="button">
                    <Ic.Check width="15" height="15" /> Done reading
                  </button>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      {keyModal && (
        <GeminiKeyModal
          onClose={() => setKeyModal(false)}
          onSaved={(ok) => { if (ok) runGenerate(); }}
        />
      )}
      {sheet && (
        <WordSheet key={sheet.token + '|' + sheet.sentence} token={sheet.token} sentence={sheet.sentence} sentenceTr={sheet.sentenceTr}
          wordIndex={wordIndex} progress={progress} now={now} groups={groups} addWord={addWord} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ---------------- Reading: library home, add text, reader, tappable words ---------------- */
const LW_LEVEL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'A', label: 'A1–A2' },
  { id: 'B', label: 'B1–B2' },
  { id: 'C', label: 'C1+' },
];

const LW_LOOKUP_CACHE = new Map(); // tapped word + sentence -> Gemini lookup, for this session

const LW_TR_CACHE_MAX = 200;

/* tiny stable hash for cache keys */
function lwHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function lwReadTrCache() { return lwLoad(LW_KEYS.trCache, null) || {}; }

function lwWriteTrCache(key, value) {
  const c = lwReadTrCache();
  delete c[key];
  c[key] = value; // re-insert = newest
  const keys = Object.keys(c);
  keys.slice(0, Math.max(0, keys.length - LW_TR_CACHE_MAX)).forEach((k) => { delete c[k]; });
  lwSave(LW_KEYS.trCache, c);
}

/* A sentence whose words can be tapped; words already in the user's cards are
   underlined in their status colour. Separators stay plain text. */
function TapText({ text, wordIndex, progress, now, onTap, activeToken }) {
  const parts = lwTokenize(text);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const own = lwMatchOwnWord(part, wordIndex);
    const status = own ? lwWordStatus(progress[own.id], now) : null;
    return (
      <span key={i} role="button" tabIndex={0}
        className={'tw' + (own ? ' tw-known tw-' + status : '') + (activeToken === part ? ' tw-active' : '')}
        onClick={(e) => { e.stopPropagation(); onTap(part); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onTap(part); } }}>
        {part}
      </span>
    );
  });
}

/* Bottom sheet for a tapped word: the user's own card if they have it (instant),
   otherwise a Gemini lookup in the context of the sentence, with "+ Add to cards". */
function WordSheet({ token, sentence, sentenceTr, wordIndex, progress, now, groups, addWord, onClose }) {
  const own = lwMatchOwnWord(token, wordIndex);
  const cacheKey = token.toLowerCase() + '|' + sentence;
  const [look, setLook] = useState(() => (LW_LOOKUP_CACHE.has(cacheKey)
    ? { status: 'done', data: LW_LOOKUP_CACHE.get(cacheKey) } : { status: own ? 'own' : 'idle', data: null }));
  const [keyModal, setKeyModal] = useState(false);
  const [manual, setManual] = useState(false);
  const [added, setAdded] = useState(null);
  const [busy, setBusy] = useState(false);
  const leafGroups = lwLeafGroups(groups);
  const readingGroup = groups.find((g) => g.name === LW_READING_GROUP_NAME && leafGroups.includes(g));
  const [groupId, setGroupId] = useState(() => {
    const saved = lwLoad(LW_KEYS.readerGroup, LW_READING_GROUP);
    return saved === LW_READING_GROUP || leafGroups.some((g) => g.id === saved) ? saved : LW_READING_GROUP;
  });

  const lookup = () => {
    if (own) return;
    if (!lwHasGeminiKey()) { setLook({ status: 'no-key', data: null }); return; }
    setLook({ status: 'loading', data: null });
    lwAiLookupWord(token, sentence)
      .then((data) => { LW_LOOKUP_CACHE.set(cacheKey, data); setLook({ status: 'done', data }); })
      .catch((e) => setLook({ status: (e && e.code) || 'error', data: null }));
  };
  useEffect(() => { if (look.status === 'idle') lookup(); /* eslint-disable-next-line */ }, []);

  const d = look.data;
  const chooseGroup = (id) => { setGroupId(id); lwSave(LW_KEYS.readerGroup, id); };
  const add = async () => {
    if (!d || busy) return;
    setBusy(true);
    try {
      const w = await addWord({ word: d.lemma, ipa: d.ipa, tr: d.tr, pos: d.pos, example: sentence, exampleTr: d.sentenceTr || sentenceTr || '' }, groupId);
      setAdded(w);
    } catch (e) {
      setLook((l) => ({ ...l, status: 'add-error' }));
    }
    setBusy(false);
  };
  const ruSentence = (d && d.sentenceTr) || sentenceTr;
  const errMsg = LW_IMPORT_ERROR_MSG[look.status] || (look.status === 'add-error' ? 'Could not save the word.' : LW_IMPORT_ERROR_MSG.error);

  if (manual) {
    return (
      <Modal title="New word" onClose={onClose}>
        <WordForm initial={{ id: lwUid(), word: token.toLowerCase(), example: sentence, exampleTr: ruSentence || '' }} groups={groups}
          onSave={(w) => { addWord(w, w.groupId).then(onClose, () => setManual(false)); }} onCancel={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title={own ? own.word : d ? d.lemma : token} sheet onClose={onClose}>
      <div className="wsheet">
        <div className="wsheet-head">
          <SpeakButton word={own ? own.word : d ? d.lemma : token} />
          <span className="wsheet-meta">
            {own ? [own.ipa, own.pos].filter(Boolean).join(' · ') : d ? [d.ipa, d.pos].filter(Boolean).join(' · ') : ''}
          </span>
          {own && <StatusBadge status={lwWordStatus(progress[own.id], now)} />}
        </div>

        {own ? (
          <p className="wsheet-tr">{own.tr}</p>
        ) : look.status === 'loading' ? (
          <p className="wsheet-loading"><span className="spinner" /> Looking it up…</p>
        ) : d ? (
          <p className="wsheet-tr">{d.tr}</p>
        ) : look.status === 'no-key' ? (
          <p className="field-hint">Add a Gemini key to translate words you don't have yet.</p>
        ) : (
          <p className="field-hint" style={{ color: 'var(--error)' }}>{errMsg}</p>
        )}

        <PronunciationCheck target={own ? own.word : d ? d.lemma : token} />

        <div className="wsheet-sentence">
          <p className="wsheet-en"><ReadingSentenceText text={sentence} highlight={token} /></p>
          {ruSentence && <p className="wsheet-ru">{ruSentence}</p>}
        </div>

        {own ? (
          <p className="wsheet-note"><Ic.Check width="16" height="16" /> Already in your cards</p>
        ) : added ? (
          <p className="wsheet-note"><Ic.Check width="16" height="16" /> Added “{added.word}” to your cards</p>
        ) : d ? (
          <div className="wsheet-add">
            <select className="input input-sm" value={groupId} onChange={(e) => chooseGroup(e.target.value)} aria-label="Group">
              <option value={LW_READING_GROUP}>{readingGroup ? LW_READING_GROUP_NAME : LW_READING_GROUP_NAME + ' (new group)'}</option>
              {leafGroups.filter((g) => g !== readingGroup).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={add}>
              {busy ? <span className="spinner" /> : <Ic.Plus width="16" height="16" />} Add to cards
            </button>
          </div>
        ) : look.status === 'no-key' ? (
          <div className="wsheet-add">
            <button type="button" className="btn btn-primary" onClick={() => setKeyModal(true)}><Ic.Key width="16" height="16" /> Add Gemini key</button>
            <button type="button" className="btn btn-soft" onClick={() => setManual(true)}>Add manually</button>
          </div>
        ) : look.status !== 'loading' && (
          <div className="wsheet-add">
            <button type="button" className="btn btn-soft" onClick={lookup}>Try again</button>
            <button type="button" className="btn btn-soft" onClick={() => setManual(true)}>Add manually</button>
          </div>
        )}
      </div>
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(false)} onSaved={(ok) => { if (ok) lookup(); }} />}
    </Modal>
  );
}

/* cover placeholder: gradient by level + the title's initials */
function TextCover({ text }) {
  const band = (text.level || 'B')[0];
  const initials = (text.title || '?').split(/\s+/).filter((w) => new RegExp('[' + LW_LETTERS + ']').test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <span className={'tcover tcover-' + band}>{initials}</span>;
}

function lwReadMinutes(words) { return Math.max(1, Math.round(words / 200)); }

function TextCard({ text, prog, canDelete, onOpen, onDelete }) {
  const mins = lwReadMinutes(text.wordCount || 0);
  return (
    <article className="tcard" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <TextCover text={text} />
      <div className="tcard-main">
        <div className="tcard-tags">
          <span className="reading-level">{text.level}</span>
          {text.shared && <span className="tcard-tag">Library</span>}
        </div>
        <h3 className="tcard-title">{text.title}</h3>
        {text.author && <p className="tcard-author">{text.author}</p>}
        <p className="tcard-meta">
          {(text.chapters || []).length > 1 ? text.chapters.length + ' chapters · ' : ''}
          {mins >= 60 ? '~' + Math.round(mins / 60) + 'h' : '~' + mins + ' min'}
          {prog ? ' · ' + (prog.pct || 0) + '% read' : ''}
        </p>
        {prog && <span className="mastery-track"><span className="mastery-fill tcard-fill" style={{ width: (prog.pct || 0) + '%' }} /></span>}
      </div>
      {canDelete && (
        <button type="button" className="icon-btn sm danger tcard-del" aria-label="Delete text"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}><Ic.Trash /></button>
      )}
    </article>
  );
}

function ReadingHome({ texts, progressByText, userId, isAdmin, aiReady, onOpen, onOpenAi, onAdd, onDelete }) {
  const [level, setLevel] = useState('all');
  const matchLevel = (t) => level === 'all' || (t.level || '')[0] === level || (level === 'C' && (t.level || '')[0] === 'C');
  const byRecent = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const books = texts.filter((t) => t.shared && matchLevel(t)).sort((a, b) => a.title.localeCompare(b.title));
  const mine = texts.filter((t) => !t.shared && t.userId === userId && matchLevel(t)).sort(byRecent);
  const last = Object.values(progressByText)
    .filter((p) => texts.some((t) => t.id === p.textId) && (p.pct || 0) < 100)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const lastText = last && texts.find((t) => t.id === last.textId);
  const canDelete = (t) => t.userId === userId || isAdmin;

  return (
    <div className="rhome">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Reading</h1>
          <p className="lib-sub">Tap any word to translate it and add it to your cards.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onAdd}><Ic.Plus /> Add text</button>
      </div>

      {lastText && (
        <section className="continue-card" onClick={() => onOpen(lastText.id)} role="button" tabIndex={0}>
          <TextCover text={lastText} />
          <div className="continue-main">
            <span className="wotd-kicker">Continue reading</span>
            <h2 className="continue-title">{lastText.title}</h2>
            <p className="continue-sub">
              {(lastText.chapters[last.chapter] && lastText.chapters[last.chapter].title) || 'Chapter ' + (last.chapter + 1)} · {last.pct || 0}%
            </p>
            <span className="goal-track"><span className="goal-fill" style={{ width: (last.pct || 0) + '%', display: 'block' }} /></span>
          </div>
          <Ic.ChevronRight className="continue-arrow" />
        </section>
      )}

      <section className="ai-card" onClick={onOpenAi} role="button" tabIndex={0}>
        <span className="tile-icon tile-icon-blue"><Ic.Bulb width="18" height="18" /></span>
        <div className="ai-card-main">
          <h2 className="dash-title">AI practice</h2>
          <p className="dash-sub">Short texts written by Gemini from the words of a group.</p>
        </div>
        {aiReady > 0 ? <span className="dash-badge">{aiReady} ready</span> : <Ic.ChevronRight />}
      </section>

      <div className="status-chips">
        {LW_LEVEL_FILTERS.map((f) => (
          <button key={f.id} type="button" className={'chip' + (level === f.id ? ' chip-on' : '')} onClick={() => setLevel(f.id)}>{f.label}</button>
        ))}
      </div>

      <h2 className="section-label">Books</h2>
      {books.length ? (
        <div className="tcards">{books.map((t) => (
          <TextCard key={t.id} text={t} prog={progressByText[t.id]} canDelete={isAdmin} onOpen={() => onOpen(t.id)} onDelete={() => onDelete(t)} />
        ))}</div>
      ) : (
        <p className="row-empty">{isAdmin ? 'No books yet — add a public-domain book with “Add text” → “Publish for everyone”.' : 'No books at this level yet.'}</p>
      )}

      <h2 className="section-label">My texts</h2>
      {mine.length ? (
        <div className="tcards">{mine.map((t) => (
          <TextCard key={t.id} text={t} prog={progressByText[t.id]} canDelete={canDelete(t)} onOpen={() => onOpen(t.id)} onDelete={() => onDelete(t)} />
        ))}</div>
      ) : (
        <p className="row-empty">Paste an article or upload a .txt file with “Add text”.</p>
      )}
    </div>
  );
}

/* Add a text: paste or .txt upload, split into chapters, optionally publish (admins). */
function AddTextModal({ isAdmin, onSave, onClose }) {
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [level, setLevel] = useState('B1');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const isGutenberg = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(raw);
  const clean = useMemo(() => (isGutenberg ? lwCleanGutenberg(raw) : raw.trim()), [raw, isGutenberg]);
  const chapters = useMemo(() => (clean ? lwSplitChapters(clean, { dropFrontMatter: isGutenberg }) : []), [clean, isGutenberg]);
  const wordCount = chapters.reduce((n, c) => n + c.paragraphs.reduce((m, p) => m + lwWordCount(p), 0), 0);

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((t) => {
      setRaw(t);
      /* Gutenberg files carry "Title:" / "Author:" lines in their header */
      const tm = t.match(/^Title:\s*(.+)$/m);
      const am = t.match(/^Author:\s*(.+)$/m);
      if (tm && !title) setTitle(tm[1].trim());
      else if (!title) setTitle(file.name.replace(/\.txt$/i, ''));
      if (am && !author) setAuthor(am[1].trim());
    });
  };

  const save = async () => {
    if (!title.trim() || !chapters.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ title: title.trim(), author: author.trim(), level, shared: isAdmin && shared, source: isGutenberg ? 'gutenberg' : 'user', wordCount }, chapters);
      onClose();
    } catch (e) {
      setError('Could not save the text: ' + ((e && e.message) || e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add text" onClose={busy ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim() || !chapters.length}>
          {busy ? <><span className="spinner" /> Saving…</> : 'Save'}
        </button>
      </>}>
      <div className="form">
        <label className="field">
          <span className="field-label-row">
            <span className="field-label">Text</span>
            <button type="button" className="btn btn-soft sm" onClick={() => fileRef.current && fileRef.current.click()}><Ic.Plus width="15" height="15" /> Upload .txt</button>
          </span>
          <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onFile} />
          <textarea className="input" rows={7} value={raw} placeholder="Paste an article, a story or a book chapter…" onChange={(e) => setRaw(e.target.value)} />
        </label>
        {chapters.length > 0 && (
          <p className="field-hint">
            {isGutenberg ? 'Project Gutenberg header and licence removed. ' : ''}
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · {wordCount.toLocaleString('en-US')} words
            {chapters.length > 1 ? ': ' + chapters.slice(0, 3).map((c) => c.title).join(', ') + (chapters.length > 3 ? '…' : '') : ''}
          </p>
        )}
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Alice's Adventures in Wonderland" />
          </label>
          <label className="field">
            <span className="field-label">Author <span className="opt">(optional)</span></span>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Level</span>
          <div className="cefr-pills">
            {LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (level === lv ? ' on' : '')} onClick={() => setLevel(lv)}>{lv}</button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <label className="check-row">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            <span><strong>Publish for everyone</strong> — shows in Books for all users. Only public-domain texts.</span>
          </label>
        )}
        {error && <p className="field-hint" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </Modal>
  );
}

/* The reader: one page (~250 words) of a chapter at a time. Words are tappable,
   paragraphs can be read aloud and translated; position syncs to reading_progress. */
function ReaderView({ text, prog, uid, words, wordIndex, progress, now, groups, addWord, recordAnswer, onBack }) {
  const chapters = text.chapters || [];
  const [at, setAt] = useState(() => ({
    chapter: Math.min(Math.max(0, (prog && prog.chapter) || 0), Math.max(0, chapters.length - 1)),
    page: (prog && prog.page) || 0,
  }));
  const [chapter, setChapter] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const cache = useRef({});
  const [tr, setTr] = useState({}); // paragraph key -> { status, ru: [] }
  const [speaking, setSpeaking] = useState(null); // { para, sent }
  const [sheet, setSheet] = useState(null); // { token, sentence, sentenceTr }
  const [practicePara, setPracticePara] = useState(-1); // paragraph open for "Read aloud"
  const [practice, setPractice] = useState(null); // exercise kind open for this chapter

  /* load the chapter (kept in memory while the reader is open) */
  useEffect(() => {
    let alive = true;
    setChapter(cache.current[at.chapter] || null);
    setLoadError(false);
    if (cache.current[at.chapter]) return;
    lwGetChapter(text.id, at.chapter)
      .then((c) => { if (!alive) return; cache.current[at.chapter] = c; setChapter(c); if (!c) setLoadError(true); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [text.id, at.chapter]);

  const pages = useMemo(() => (chapter ? lwPaginate(chapter.paragraphs) : []), [chapter]);
  const page = Math.min(at.page, Math.max(0, pages.length - 1));
  const paragraphs = pages[page] || [];
  const sentences = useMemo(() => paragraphs.map((p) => lwSplitSentences(p)), [paragraphs]);
  const paraKey = (p) => text.id + '|' + at.chapter + '|' + lwHash(p);

  /* remember where we are (debounced); pct is over the whole text by word count */
  useEffect(() => {
    if (!pages.length) return;
    const t = setTimeout(() => {
      const before = chapters.slice(0, at.chapter).reduce((n, c) => n + (c.words || 0), 0);
      const inChapter = ((chapters[at.chapter] && chapters[at.chapter].words) || 0) * ((page + 1) / pages.length);
      const pct = Math.min(100, Math.round(((before + inChapter) / Math.max(1, text.wordCount || 1)) * 100));
      lwSaveReadingProgress(uid, text.id, { chapter: at.chapter, page, pct }).catch((e) => console.error('reading progress', e));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [at.chapter, page, pages.length]);

  /* stop speech when leaving the page */
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, [at.chapter, page]);
  useEffect(() => { window.scrollTo(0, 0); setSpeaking(null); setPracticePara(-1); }, [at.chapter, page]);
  useEffect(() => { setPractice(null); }, [at.chapter]);
  useEffect(() => { window.scrollTo(0, 0); }, [practice]);

  const lastPage = page >= pages.length - 1;
  const goNext = () => {
    if (!pages.length) return;
    if (!lastPage) setAt({ chapter: at.chapter, page: page + 1 });
    else if (at.chapter < chapters.length - 1) setAt({ chapter: at.chapter + 1, page: 0 });
  };
  const goPrev = () => {
    if (page > 0) setAt({ chapter: at.chapter, page: page - 1 });
    else if (at.chapter > 0) setAt({ chapter: at.chapter - 1, page: 1e6 }); // clamps to the last page
  };
  useEffect(() => {
    const h = (e) => {
      if (sheet || practice || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const speak = (pi) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speaking && speaking.para === pi) { setSpeaking(null); return; }
    const list = sentences[pi];
    list.forEach((s, si) => {
      const u = lwUtterance(s, 0.9); // chosen voice, a bit slower for reading along
      u.onstart = () => setSpeaking({ para: pi, sent: si });
      if (si === list.length - 1) u.onend = () => setSpeaking((cur) => (cur && cur.para === pi && cur.sent === si ? null : cur));
      window.speechSynthesis.speak(u);
    });
  };

  const translate = (pi) => {
    const key = paraKey(paragraphs[pi]);
    const cur = tr[key];
    if (cur && cur.status === 'done') { setTr((t) => ({ ...t, [key]: { ...cur, open: !cur.open } })); return; }
    const cached = lwReadTrCache()[key];
    if (cached) { setTr((t) => ({ ...t, [key]: { status: 'done', ru: cached, open: true } })); return; }
    if (!lwHasGeminiKey()) { setTr((t) => ({ ...t, [key]: { status: 'no-key', open: true } })); return; }
    setTr((t) => ({ ...t, [key]: { status: 'loading', open: true } }));
    lwAiTranslateSentences(sentences[pi])
      .then((ru) => { lwWriteTrCache(key, ru); setTr((t) => ({ ...t, [key]: { status: 'done', ru, open: true } })); })
      .catch((e) => setTr((t) => ({ ...t, [key]: { status: (e && e.code) || 'error', open: true } })));
  };

  const tap = (pi, si, token) => {
    const key = paraKey(paragraphs[pi]);
    const ru = (tr[key] && tr[key].ru) || lwReadTrCache()[key];
    setSheet({ token, sentence: sentences[pi][si], sentenceTr: ru ? ru[si] : '' });
  };

  /* how many of the user's words appear on this page */
  const known = useMemo(() => {
    const ids = new Set();
    paragraphs.forEach((p) => lwTokenize(p).forEach((tok, i) => {
      if (i % 2) { const w = lwMatchOwnWord(tok, wordIndex); if (w) ids.add(w.id); }
    }));
    return ids.size;
  }, [paragraphs, wordIndex]);

  const chMeta = chapters[at.chapter] || {};
  const ex = chapter && chapter.exercises;
  const practiceScores = prog && prog.practice && prog.practice[at.chapter];
  /* an exercise answer: to the user's card for that word, else activity only */
  const practiceAnswer = (target, ok) => {
    const card = target ? lwFindCardForClip({ word: target }, words) : null;
    recordAnswer(card ? card.id : null, ok, 'reading');
  };
  const savePractice = (kind, pct) => lwSaveReadingProgress(uid, text.id, { practice: { [at.chapter]: { [kind]: pct } } })
    .catch((e) => console.error('practice score', e));
  return (
    <div className="reader">
      <header className="reader-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to Reading"><Ic.Arrow style={{ transform: 'scaleX(-1)' }} /></button>
        <div className="reader-titles">
          <h1 className="reader-title">{text.title}</h1>
          {chapters.length > 1 ? (
            <select className="reader-chapter" value={at.chapter} onChange={(e) => setAt({ chapter: +e.target.value, page: 0 })} aria-label="Chapter">
              {chapters.map((c, i) => <option key={i} value={i}>{c.title || 'Chapter ' + (i + 1)}</option>)}
            </select>
          ) : text.author ? <span className="reader-author">{text.author}</span> : null}
        </div>
        {ex && (
          <button type="button" className={'btn btn-soft sm reader-practice-btn' + (practice ? ' on' : '')}
            onClick={() => setPractice(practice ? null : 'menu')}>
            <Ic.ListCheck width="15" height="15" /> {practice ? 'Text' : 'Practice'}
          </button>
        )}
      </header>
      {practice === 'menu' ? (
        <>
          <ChapterPracticeMenu ex={ex} scores={practiceScores} onPick={setPractice} />
          <button type="button" className="btn btn-ghost" onClick={() => setPractice(null)}>Back to the text</button>
        </>
      ) : practice ? (
        <ChapterPractice key={practice} kind={practice} ex={ex} onAnswer={practiceAnswer}
          onSave={(pct) => savePractice(practice, pct)} onBack={() => setPractice('menu')} />
      ) : <>
      <div className="reader-progress">
        <span>{pages.length ? 'Page ' + (page + 1) + ' of ' + pages.length : 'Loading…'}</span>
        <span className="goal-track"><span className="goal-fill" style={{ display: 'block', width: (pages.length ? ((page + 1) / pages.length) * 100 : 0) + '%' }} /></span>
        <span className="reader-known" title="Words from your cards on this page">In your cards: {known}</span>
      </div>

      <article className="reader-page">
        {loadError ? (
          <p className="row-empty">Could not load this chapter. Check your connection and try again.</p>
        ) : !chapter ? (
          <p className="row-empty"><span className="spinner" /> Loading…</p>
        ) : (
          <>
            {page === 0 && chMeta.title && <h2 className="reader-chapter-title">{chMeta.title}</h2>}
            {paragraphs.map((p, pi) => {
              const key = paraKey(p);
              const t = tr[key];
              return (
                <div key={pi + key} className="rpara">
                  <p className="rpara-text">
                    {sentences[pi].map((s, si) => (
                      <React.Fragment key={si}>
                        <span className={'rsent' + (speaking && speaking.para === pi && speaking.sent === si ? ' speaking' : '')}>
                          <TapText text={s} wordIndex={wordIndex} progress={progress} now={now}
                            activeToken={sheet && sheet.sentence === s ? sheet.token : null}
                            onTap={(tok) => tap(pi, si, tok)} />
                        </span>{' '}
                      </React.Fragment>
                    ))}
                  </p>
                  <div className="rpara-tools">
                    <button type="button" className="rtool" onClick={() => speak(pi)} aria-pressed={!!(speaking && speaking.para === pi)}>
                      {speaking && speaking.para === pi ? <Ic.Pause width="15" height="15" /> : <Ic.Play width="15" height="15" />} Listen
                    </button>
                    <button type="button" className="rtool" onClick={() => translate(pi)} aria-pressed={!!(t && t.open)}>
                      {t && t.status === 'loading' ? <span className="spinner" /> : <Ic.Translate width="15" height="15" />} Translate
                    </button>
                    {lwCanRecognize() && (
                      <button type="button" className="rtool" onClick={() => setPracticePara((cur) => (cur === pi ? -1 : pi))} aria-pressed={practicePara === pi}>
                        <Ic.Mic width="15" height="15" /> Read aloud
                      </button>
                    )}
                  </div>
                  {practicePara === pi && (
                    <div className="rpara-practice">
                      <p className="field-hint">Read the paragraph out loud, then tap Stop. Words we didn't hear are marked.</p>
                      <PronunciationCheck target={p} label="Start reading" passage />
                    </div>
                  )}
                  {t && t.open && t.status === 'done' && (
                    <div className="rpara-ru">{t.ru.map((r, i) => <p key={i}>{r}</p>)}</div>
                  )}
                  {t && t.open && t.status !== 'done' && t.status !== 'loading' && (
                    <p className="field-hint">{t.status === 'no-key' ? 'Add a Gemini key in Profile to translate.' : LW_IMPORT_ERROR_MSG[t.status] || LW_IMPORT_ERROR_MSG.error}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </article>

      <nav className="reader-nav">
        <button type="button" className="btn btn-soft" onClick={goPrev} disabled={at.chapter === 0 && page === 0}>
          <Ic.Arrow style={{ transform: 'scaleX(-1)' }} /> Previous
        </button>
        <button type="button" className="btn btn-primary" onClick={goNext} disabled={!pages.length || (lastPage && at.chapter >= chapters.length - 1)}>
          {lastPage && at.chapter < chapters.length - 1 ? 'Next chapter' : 'Next'} <Ic.Arrow />
        </button>
      </nav>
      {ex && lastPage && <ChapterPracticeMenu ex={ex} scores={practiceScores} onPick={setPractice} />}
      </>}

      {sheet && (
        <WordSheet key={sheet.token + '|' + sheet.sentence} token={sheet.token} sentence={sheet.sentence} sentenceTr={sheet.sentenceTr}
          wordIndex={wordIndex} progress={progress} now={now} groups={groups} addWord={addWord} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

export {
  AddTextModal, ReaderView, ReadingHome, ReadingView,
};
