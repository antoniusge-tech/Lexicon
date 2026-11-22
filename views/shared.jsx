/* shared.jsx — helpers, constants and small components shared by several screens. */

import React, { Suspense } from 'react';
import { LW_RELEARN_MS, lwFormatInterval, lwNextProgress } from '../progress.ts';
import { Ic } from '../components.jsx';

/* A component whose code is a separate file, fetched the first time it renders
   (admin screens, editors, Import), so the main bundle stays smaller. A spinner
   shows while it loads. If the file can't load (offline, or a new deploy removed
   it), the error boundary offers a reload. */
function lwLazy(load) {
  const Inner = React.lazy(load);
  return function Lazy(props) {
    return (
      <Suspense fallback={<div className="lazy-loading"><span className="spinner" aria-hidden="true" /></div>}>
        <Inner {...props} />
      </Suspense>
    );
  };
}

/* Fisher–Yates */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LW_ROLE_LABEL = { admin: 'Admin', premium: 'Premium', user: 'User' };

/* Human-readable reading-generation errors, keyed by the .code set in data.js.
   Reused by the reading tab's inline hints and by the toast messages. */
const LW_READING_ERROR_MSG = {
  quota: 'Daily Gemini limit reached. Try again later.',
  'bad-key': 'Your Gemini key is invalid. Update it in Profile → Gemini API key.',
  refusal: 'The model could not write a text. Try again.',
  overload: 'Gemini is overloaded right now. Try again in a minute.',
  empty: 'This group has no words yet.',
  error: 'AI service error. Try again later.',
};

/* Same, but for the import tab's "Заполнить с AI" (batch word enrichment). */
const LW_IMPORT_ERROR_MSG = {
  quota: 'Daily Gemini limit reached. Try again later.',
  'bad-key': 'Your Gemini key is invalid. Update it in Profile → Gemini API key.',
  refusal: 'The model could not process the list. Try fewer words.',
  overload: 'Gemini is overloaded right now. Try again in a minute.',
  error: 'AI service error. Try again later.',
};

/* ---------------- Learn: header (daily goal, modes, groups) + answer buttons ---------------- */

/* Again / Know under a card — same as swiping left / right, but they show when
   the word comes back (FSRS, lwNextProgress). Know on a word reviewed early the
   same day changes nothing, so its label shows the time left until it is due. */
function AnswerButtons({ prog, wordId, onAnswer }) {
  const t = Date.now();
  const knowIn = lwNextProgress(prog || null, wordId, true, '', t).due - t;
  return (
    <div className="answer-btns">
      <button className="answer-btn answer-again" type="button" onClick={() => onAnswer('unknown')}>
        <span className="answer-icon"><Ic.Close width="22" height="22" /></span>
        <span className="answer-label">Again</span>
        <span className="answer-int">{lwFormatInterval(LW_RELEARN_MS)}</span>
      </button>
      <button className="answer-btn answer-know" type="button" onClick={() => onAnswer('known')}>
        <span className="answer-icon"><Ic.DoubleCheck width="22" height="22" /></span>
        <span className="answer-label">Know</span>
        <span className="answer-int">{lwFormatInterval(knowIn)}</span>
      </button>
    </div>
  );
}

const LW_READING_GROUP = '__from_reading__'; // "+ Add to cards" default: the auto-created "From reading" group

const LW_READING_GROUP_NAME = 'From reading';

const LW_COLLOC_GROUP_NAME = 'Collocations'; // where phrases added in Library → Collocations go

const LW_VIDEO_GROUP_NAME = 'From video'; // "+ Add to cards" in Learn → Video

/* ---------------- Library: Words view pieces ---------------- */
const LW_STATUS_LABEL = { new: 'New', learning: 'Learning', review: 'To review', mastered: 'Mastered' };

function StatusBadge({ status }) {
  return <span className={'st-badge st-badge-' + status}><span className={'status-swatch status-' + status} />{LW_STATUS_LABEL[status]}</span>;
}

/* ---------------- Library view ---------------- */
const LW_LIB_PAGE = 50; // word cards shown per "Show more"

export {
  lwLazy, AnswerButtons, LW_COLLOC_GROUP_NAME, LW_IMPORT_ERROR_MSG, LW_LIB_PAGE,
  LW_READING_ERROR_MSG, LW_READING_GROUP, LW_READING_GROUP_NAME, LW_ROLE_LABEL,
  LW_STATUS_LABEL, LW_VIDEO_GROUP_NAME, StatusBadge, shuffle,
};
