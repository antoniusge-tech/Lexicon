/* components.jsx — icons, flashcard, chips, modals, forms */

/* ---------------- Icons ---------------- */
const Ic = {
  Sun: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>
  ),
  Close: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  Shuffle: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  Image: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>
  ),
  Cards: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="13" height="16" rx="2" /><path d="M8 5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1" /></svg>
  ),
  Library: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 6.5C10.3 5 7.8 4.5 3 4.5v14c4.8 0 7.3.5 9 2 1.7-1.5 4.2-2 9-2v-14c-4.8 0-7.3.5-9 2Z" /><path d="M12 6.5v14" /></svg>
  ),
  Book: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5Z" /><path d="M8 7h8M8 11h6" /></svg>
  ),
  Tag: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2H4v8l9.5 9.5a2 2 0 0 0 2.83 0l5.17-5.17a2 2 0 0 0 0-2.83L12 2Z" /><circle cx="8" cy="8" r="1.5" /></svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>
  ),
  MoreVertical: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
  ),
  Bulb: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.36.8.93.8 1.6v.5h5.4v-.5c0-.67.3-1.24.8-1.6A6 6 0 0 0 12 3z" />
    </svg>
  ),
  Speaker: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 8a5 5 0 0 1 0 8M19 5a8.5 8.5 0 0 1 0 14" />
    </svg>
  ),
  Menu: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Swap: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 4 4v1" />
      <path d="M17 20l4-4-4-4" /><path d="M21 16H8a4 4 0 0 1-4-4v-1" />
    </svg>
  ),
  ListCheck: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m4 6 1.5 1.5L8 5" /><path d="M11 6h9" />
      <path d="m4 12 1.5 1.5L8 11" /><path d="M11 12h9" />
      <path d="m4 18 1.5 1.5L8 17" /><path d="M11 18h9" />
    </svg>
  ),
  Blank: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 7h6M14 7h6M4 12h4M20 12h-4M4 17h6M14 17h6" />
      <rect x="9" y="9.5" width="6" height="5" rx="1.2" strokeDasharray="2 2" />
    </svg>
  ),
  Repeat: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" />
    </svg>
  ),
  Learn: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 9 12 4 2 9l10 5 10-5Z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /><path d="M22 9v6" />
    </svg>
  ),
  Person: (p) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Flame: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#F07B22" {...p}>
      <path d="M12 2c.6 3.2-1 5-2.6 6.7C7.8 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.4-1.2-4.2-2.3-5.5-.3 1.4-1 2.4-2.1 3 .4-3.6-.6-7.6-1.6-10.5Z" />
    </svg>
  ),
  Star: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
      <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" />
    </svg>
  ),
  DoubleCheck: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m2 13 4.5 4.5L14 10" /><path d="m10 16.5 1 1L21 7.5" />
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  Logout: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
    </svg>
  ),
  Key: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8" /><path d="m17 6 3 3" /><path d="m14.5 8.5 2 2" />
    </svg>
  ),
  ChevronRight: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6" /></svg>
  ),
  Google: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  ),
  Camera: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  CloudOff: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3l18 18" /><path d="M8.5 6.3A6 6 0 0 1 17.7 10h.3a4 4 0 0 1 2.6 7" /><path d="M17 19H7a5 5 0 0 1-1.6-9.7" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" {...p}>
      <path d="M12 2c.4 4.6 2.4 6.6 7 7-4.6.4-6.6 2.4-7 7-.4-4.6-2.4-6.6-7-7 4.6-.4 6.6-2.4 7-7Z" />
      <path d="M19 14c.2 2.2 1.1 3.1 3.3 3.3-2.2.2-3.1 1.1-3.3 3.3-.2-2.2-1.1-3.1-3.3-3.3 2.2-.2 3.1-1.1 3.3-3.3Z" />
    </svg>
  ),
  Play: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
  ),
  Pause: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
  ),
  Translate: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5h8M8 3v2M10.5 5c-.8 3.5-3 6.3-6.5 8" /><path d="M6 9c1 1.8 2.6 3.2 4.6 4" /><path d="m12 21 4-9 4 9M13.5 18h5" />
    </svg>
  ),
  Mic: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  Link: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.6 10.6 6.8-3.3M8.6 13.4l6.8 3.3" />
    </svg>
  ),
  Grammar: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="m9 13 2.5-6 2.5 6M9.8 11h3.4" />
    </svg>
  ),
  Bookmark: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3h12v18l-6-4-6 4V3Z" />
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  ),
  ArrowUp: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
  ),
  ArrowDown: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
  ),
  Flag: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  ),

};

/* ---------------- Fill-the-blank helpers ----------------
   Given a word and its example sentence, replace the (first) occurrence of the
   word — in any of its inflected forms — with a blank. Reuses the same set of
   word forms that Reading highlights with. Returns the sentence split around the
   blank ({ before, after, matched }) or null if no form was found. */
function lwWordForms(word) {
  const w = window.lwNormLetters(String(word || '').toLowerCase().trim());
  if (!w) return [];
  const forms = new Set([w]);
  forms.add(w + 's');
  forms.add(w + 'es');
  forms.add(w + 'ed');
  forms.add(w + 'ing');
  if (w.endsWith('e')) { forms.add(w.slice(0, -1) + 'ing'); forms.add(w + 'd'); }
  if (w.endsWith('y')) { forms.add(w.slice(0, -1) + 'ies'); forms.add(w.slice(0, -1) + 'ied'); }
  return [...forms];
}

/* Split `sentence` at the first token that matches a form of `word`. Returns
   { before, matched, after } or null when no whole-word match is found. */
function lwBlankSentence(sentence, word) {
  const text = String(sentence || '');
  if (!text.trim()) return null;
  const forms = new Set(lwWordForms(word));
  if (!forms.size) return null;
  /* split keeping delimiters (non-letters) so we can re-join verbatim */
  const parts = text.split(new RegExp('([' + window.LW_LETTERS + '’\']+)'));
  /* Romanian words change their ending a lot (casa, casei, casele): match by stem */
  const ro = window.lwCurrentLang() === 'ro' && !/\s/.test(String(word).trim());
  let idx = -1;
  for (let i = 1; i < parts.length; i += 2) {
    if (forms.has(window.lwNormLetters(parts[i].toLowerCase())) || (ro && window.readingTokensMatch(parts[i], word))) { idx = i; break; }
  }
  if (idx === -1) return null;
  return {
    before: parts.slice(0, idx).join(''),
    matched: parts[idx],
    after: parts.slice(idx + 1).join(''),
  };
}

/* ---------------- Speech synthesis helper ---------------- */
function lwSpeak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(window.lwUtterance(text)); // the voice and speed chosen in Profile
}

/* ---------------- Voice picker (Profile) ---------------- */
/* voices of the language being studied; Profile remounts it (key) when that changes */
function VoicePicker() {
  const [voices, setVoices] = React.useState(() => window.lwLangVoices());
  const [cfg, setCfg] = React.useState(() => window.lwVoiceSettings());
  React.useEffect(() => window.lwOnVoicesChanged(() => setVoices(window.lwLangVoices())), []);
  const langInfo = window.lwLangInfo();
  const set = (fields) => { window.lwSaveVoiceSettings(fields); setCfg(window.lwVoiceSettings()); };
  const best = voices[0];
  const label = (v) => v.name + (window.lwVoiceAccent(v) ? ' · ' + window.lwVoiceAccent(v) : '') + (window.lwVoiceScore(v) >= 30 ? ' ★' : '');
  const chosen = cfg.voiceURI && voices.some((v) => v.voiceURI === cfg.voiceURI) ? cfg.voiceURI : '';
  return (
    <>
      <div className="setting-row setting-row-wrap">
        <span className="setting-label"><Ic.Speaker /> Voice</span>
        <div className="voice-pick">
          <select className="input input-sm" value={chosen} aria-label="Voice" onChange={(e) => set({ voiceURI: e.target.value })}>
            <option value="">{best ? 'Auto (' + best.name + ')' : 'Auto'}</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}
          </select>
          <button type="button" className="btn btn-soft sm" onClick={() => lwSpeak(langInfo.sample)}><Ic.Play width="14" height="14" /> Test</button>
        </div>
      </div>
      <div className="setting-row">
        <span className="setting-label"><Ic.Clock /> Speech speed</span>
        <div className="seg">
          <button type="button" className={'seg-btn' + (cfg.rate === 0.8 ? ' on' : '')} onClick={() => set({ rate: 0.8 })}>Slow</button>
          <button type="button" className={'seg-btn' + (cfg.rate !== 0.8 ? ' on' : '')} onClick={() => set({ rate: 1 })}>Normal</button>
        </div>
      </div>
      <p className="voice-hint">★ — the best voices on this device. For more natural voices, download “Enhanced” or “Premium” {langInfo.name} voices in your phone or computer speech settings.</p>
      {!voices.length && <p className="voice-hint">No {langInfo.name} voice found on this device — install one in your system speech settings.</p>}
    </>
  );
}

/* ---------------- Photo placeholder ---------------- */
function PhotoFill({ word, hue }) {
  return (
    <div className="photo-ph" style={{ '--ph-hue': hue || '#005da7' }}>
      <Ic.Image className="photo-ph-icon" />
      <span className="photo-ph-label">{word}</span>
    </div>
  );
}

/* ---------------- Flashcard ---------------- */
const SWIPE_THRESHOLD = 100;

function Flashcard({ entry, group, flipped, onFlip, onSwipe, onShuffle, onGroupClick, direction = 'en-ru' }) {
  const [drag, setDrag] = React.useState(null); // {startX, startY, dx, dy} or null
  const [flyDir, setFlyDir] = React.useState(null); // 'known' | 'unknown' | null
  const [showExample, setShowExample] = React.useState(false);
  const dragRef = React.useRef(null);
  dragRef.current = drag;

  React.useEffect(() => {
    setFlyDir(null);
    setDrag(null);
    setShowExample(false);
  }, [entry && entry.id]);

  if (!entry) return null;
  const hue = group ? group.color : '#005da7';

  const groupTag = group ? (
    onGroupClick ? (
      <button type="button" className="card-tag card-tag-btn"
        onClick={(e) => { e.stopPropagation(); onGroupClick(group); }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Choose study groups">
        <span className="dot" style={{ background: hue }} />{group.name}
      </button>
    ) : (
      <div className="card-tag"><span className="dot" style={{ background: hue }} />{group.name}</div>
    )
  ) : null;

  const onPointerDown = (e) => {
    if (flyDir) return;
    setDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    setDrag({ ...d, dx, dy, moved });
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.dy > SWIPE_THRESHOLD && d.dy > Math.abs(d.dx)) {
      setFlyDir('shuffle');
      setDrag(null);
      setTimeout(() => onShuffle(), 560);
    } else if (-d.dy > SWIPE_THRESHOLD && -d.dy > Math.abs(d.dx)) {
      setFlyDir('skip');
      setDrag(null);
      setTimeout(() => onSwipe('skip'), 220);
    } else if (Math.abs(d.dx) > SWIPE_THRESHOLD) {
      const dir = d.dx > 0 ? 'known' : 'unknown';
      setFlyDir(dir);
      setDrag(null);
      setTimeout(() => onSwipe(dir), 220);
    } else {
      setDrag(null);
    }
  };
  const onPointerUp = () => endDrag();
  const onPointerLeave = () => { if (dragRef.current && !flyDir) endDrag(); };
  const onClick = () => {
    if (drag && drag.moved) return;
    if (showExample) { setShowExample(false); return; }
    onFlip();
  };

  let style = {};
  let swipeClass = '';
  if (flyDir === 'shuffle') {
    style = { transition: 'none' };
    swipeClass = ' swipe-shuffle';
  } else if (flyDir === 'skip') {
    style = { transform: 'translateY(-600px) rotate(0deg)', opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = ' swipe-skip';
  } else if (flyDir) {
    const sign = flyDir === 'known' ? 1 : -1;
    style = { transform: `translateX(${sign * 600}px) rotate(${sign * 24}deg)`, opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = flyDir === 'known' ? ' swipe-known' : ' swipe-unknown';
  } else if (drag) {
    if (Math.abs(drag.dy) > Math.abs(drag.dx)) {
      style = { transform: `translateY(${drag.dy}px)`, transition: 'none' };
      if (drag.dy > 24) swipeClass = ' swipe-shuffle-hint';
      else if (drag.dy < -24) swipeClass = ' swipe-skip-hint';
    } else {
      const rotate = drag.dx / 18;
      style = { transform: `translateX(${drag.dx}px) rotate(${rotate}deg)`, transition: 'none' };
      if (drag.dx > 24) swipeClass = ' swipe-known';
      else if (drag.dx < -24) swipeClass = ' swipe-unknown';
    }
  }
  const swipeStrength = drag
    ? Math.min(Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) / SWIPE_THRESHOLD, 1)
    : (flyDir && flyDir !== 'shuffle' ? 1 : 0);

  return (
    <div className={'card-scene' + (flipped ? ' is-flipped' : '') + (showExample ? ' is-example' : '') + swipeClass} style={style}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onFlip(); }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerLeave} onPointerLeave={onPointerLeave}>
      {swipeClass === ' swipe-known' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Know</div>}
      {swipeClass === ' swipe-unknown' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Don't know</div>}
      {swipeClass === ' swipe-shuffle-hint' && <div className="swipe-stamp swipe-stamp-shuffle" style={{ opacity: swipeStrength }}><Ic.Shuffle width="14" height="14" /> Shuffle</div>}
      {(swipeClass === ' swipe-skip-hint' || swipeClass === ' swipe-skip') && <div className="swipe-stamp swipe-stamp-skip" style={{ opacity: swipeStrength }}>Skip</div>}
      {flyDir === 'shuffle' && (
        <div className="shuffle-fx" aria-hidden="true">
          <span className="shuffle-card sc-1" />
          <span className="shuffle-card sc-2" />
          <span className="shuffle-card sc-3" />
          <Ic.Shuffle className="shuffle-icon" width="28" height="28" />
        </div>
      )}
      <div className="card-inner">
        {direction === 'ru-en' ? (
          <>
            {/* FRONT: translation */}
            <div className="card-face card-front">
              {entry.photo && (
                <div className="card-photo">
                  <img className="card-photo-img" src={entry.photo} alt="" />
                </div>
              )}
              <div className="card-body">
                <div className="card-word">{entry.tr}</div>
              </div>
              {groupTag}
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
            {/* BACK: English word */}
            <div className="card-face card-back" style={{ '--hue': hue }}>
              <div className="back-label">word</div>
              <div className="card-tr">
                {entry.word}
              </div>
              <div className="back-word">
                {entry.ipa}
              </div>
              {groupTag}
              <SpeakButton word={entry.word} />
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
          </>
        ) : (
          <>
            {/* FRONT: English word */}
            <div className="card-face card-front">
              {entry.photo && (
                <div className="card-photo">
                  <img className="card-photo-img" src={entry.photo} alt="" />
                </div>
              )}
              <div className="card-body">
                <div className="card-word">{entry.word}</div>
                <div className="card-ipa">{entry.ipa}</div>
              </div>
              {groupTag}
              <SpeakButton word={entry.word} />
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
            {/* BACK: translation */}
            <div className="card-face card-back" style={{ '--hue': hue }}>
              <div className="back-label">translation</div>
              <div className="card-tr">
                {entry.tr}
              </div>
              <div className="back-word">{entry.word} <span className="back-ipa">{entry.ipa}</span></div>
              {groupTag}
              <ExampleBulb example={entry.example} onShow={() => setShowExample(true)} />
            </div>
          </>
        )}
        {/* EXAMPLE */}
        <div className="card-face card-example">
          <div className="example-text">{entry.example}</div>
          {entry.exampleTr && entry.exampleTr.trim() && (
            <>
              <hr className="example-divider" />
              <div className="example-text-tr">{entry.exampleTr}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pronunciation button ---------------- */
function SpeakButton({ word }) {
  return (
    <button type="button" className="card-speak" aria-label="Pronounce word"
      onClick={(e) => { e.stopPropagation(); lwSpeak(word); }}
      onPointerDown={(e) => e.stopPropagation()}>
      <Ic.Speaker />
    </button>
  );
}

/* ---------------- Example "lightbulb" toggle ---------------- */
function ExampleBulb({ example, onShow }) {
  const has = !!(example && example.trim());
  return (
    <button type="button" className={'card-bulb' + (has ? ' card-bulb-on' : '')}
      disabled={!has} aria-label="Show example sentence"
      onClick={(e) => { e.stopPropagation(); if (has) onShow(); }}
      onPointerDown={(e) => e.stopPropagation()}>
      <Ic.Bulb />
    </button>
  );
}

/* ---------------- Fill-the-blank card ----------------
   Front: the example sentence with the word blanked out. Flip (click / space)
   to reveal the word + IPA. Lightbulb toggles the sentence translation.
   Swipe like the flashcards: right = known (card flies off), left = unknown
   (the sentence is re-queued and shows up again later — via onSwipe). Swipe
   down = shuffle the deck, swipe up = skip (via onShuffle / onSwipe('skip')). */
function FillCard({ entry, group, flipped, onFlip, onSwipe, onShuffle, onGroupClick, blank }) {
  const [drag, setDrag] = React.useState(null);   // {startX, startY, dx, dy, moved} | null
  const [flyDir, setFlyDir] = React.useState(null); // 'known' | 'unknown' | 'shuffle' | 'skip' | null
  const dragRef = React.useRef(null);
  dragRef.current = drag;

  React.useEffect(() => {
    setDrag(null);
    setFlyDir(null);
  }, [entry && entry.id]);

  if (!entry) return null;
  const hue = group ? group.color : '#005da7';
  const hasTr = !!(entry.exampleTr && entry.exampleTr.trim());

  const makeGroupTag = (baseClass) => {
    if (!group) return null;
    if (!onGroupClick) {
      return <div className={baseClass}><span className="dot" style={{ background: hue }} />{group.name}</div>;
    }
    return (
      <button type="button" className={baseClass + ' ' + baseClass + '-btn'}
        onClick={(e) => { e.stopPropagation(); onGroupClick(group); }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Choose study groups">
        <span className="dot" style={{ background: hue }} />{group.name}
      </button>
    );
  };

  const onPointerDown = (e) => {
    if (flyDir) return;
    setDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    setDrag({ ...d, dx, dy, moved });
  };
  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.dy > SWIPE_THRESHOLD && d.dy > Math.abs(d.dx)) {
      setFlyDir('shuffle');
      setDrag(null);
      setTimeout(() => onShuffle && onShuffle(), 560);
    } else if (-d.dy > SWIPE_THRESHOLD && -d.dy > Math.abs(d.dx)) {
      setFlyDir('skip');
      setDrag(null);
      setTimeout(() => onSwipe('skip'), 220);
    } else if (Math.abs(d.dx) > SWIPE_THRESHOLD) {
      const dir = d.dx > 0 ? 'known' : 'unknown';
      setFlyDir(dir);
      setDrag(null);
      setTimeout(() => onSwipe(dir), 220);
    } else {
      setDrag(null);
    }
  };
  const onPointerUp = () => endDrag();
  const onPointerLeave = () => { if (dragRef.current && !flyDir) endDrag(); };
  const onClick = () => {
    if (drag && drag.moved) return;
    onFlip();
  };

  let style = {};
  let swipeClass = '';
  if (flyDir === 'shuffle') {
    style = { transition: 'none' };
    swipeClass = ' swipe-shuffle';
  } else if (flyDir === 'skip') {
    style = { transform: 'translateY(-600px) rotate(0deg)', opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = ' swipe-skip';
  } else if (flyDir) {
    const sign = flyDir === 'known' ? 1 : -1;
    style = { transform: `translateX(${sign * 600}px) rotate(${sign * 24}deg)`, opacity: 0, transition: 'transform .22s ease-in, opacity .22s ease-in' };
    swipeClass = flyDir === 'known' ? ' swipe-known' : ' swipe-unknown';
  } else if (drag) {
    if (Math.abs(drag.dy) > Math.abs(drag.dx)) {
      style = { transform: `translateY(${drag.dy}px)`, transition: 'none' };
      if (drag.dy > 24) swipeClass = ' swipe-shuffle-hint';
      else if (drag.dy < -24) swipeClass = ' swipe-skip-hint';
    } else {
      const rotate = drag.dx / 18;
      style = { transform: `translateX(${drag.dx}px) rotate(${rotate}deg)`, transition: 'none' };
      if (drag.dx > 24) swipeClass = ' swipe-known';
      else if (drag.dx < -24) swipeClass = ' swipe-unknown';
    }
  }
  const swipeStrength = drag
    ? Math.min(Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) / SWIPE_THRESHOLD, 1)
    : (flyDir && flyDir !== 'shuffle' ? 1 : 0);

  return (
    <div className={'fill-scene' + (flipped ? ' is-flipped' : '') + swipeClass} style={style}
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onFlip(); }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerLeave} onPointerLeave={onPointerLeave}>
      {swipeClass === ' swipe-known' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Know</div>}
      {swipeClass === ' swipe-unknown' && <div className="swipe-stamp" style={{ opacity: swipeStrength }}>Don't know</div>}
      {swipeClass === ' swipe-shuffle-hint' && <div className="swipe-stamp swipe-stamp-shuffle" style={{ opacity: swipeStrength }}><Ic.Shuffle width="14" height="14" /> Shuffle</div>}
      {(swipeClass === ' swipe-skip-hint' || swipeClass === ' swipe-skip') && <div className="swipe-stamp swipe-stamp-skip" style={{ opacity: swipeStrength }}>Skip</div>}
      {flyDir === 'shuffle' && (
        <div className="shuffle-fx" aria-hidden="true">
          <span className="shuffle-card sc-1" />
          <span className="shuffle-card sc-2" />
          <span className="shuffle-card sc-3" />
          <Ic.Shuffle className="shuffle-icon" width="28" height="28" />
        </div>
      )}
      <div className="fill-inner">
        {/* FRONT: sentence with a blank */}
        <div className="fill-face fill-front">
          {makeGroupTag('choice-tag')}
          <p className="fill-sentence">
            {blank ? (
              <>
                {blank.before}
                <span className="fill-blank" />
                {blank.after}
              </>
            ) : entry.example}
          </p>
          {hasTr && (
            <p className="fill-sentence-tr">{entry.exampleTr}</p>
          )}
        </div>
        {/* BACK: the missing word */}
        <div className="fill-face fill-back" style={{ '--hue': hue }}>
          <div className="back-label">word</div>
          <div className="card-tr">{entry.word}</div>
          {entry.ipa && <div className="back-word">{entry.ipa}</div>}
          {makeGroupTag('card-tag')}
          <SpeakButton word={entry.word} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Group chip (study selector) ---------------- */
function GroupChip({ group, groups, count, active, onToggle }) {
  const parent = group.parentId && groups ? groups.find((p) => p.id === group.parentId) : null;
  const label = parent ? parent.name + ' / ' + group.name : group.name;
  return (
    <button className={'chip' + (active ? ' chip-on' : '')} onClick={onToggle} type="button">
      <span className="chip-dot" style={{ background: group.color }} />
      <span className="chip-name">{label}</span>
      <span className="chip-count">{count}</span>
      {active && <Ic.Check className="chip-check" />}
    </button>
  );
}

/* ---------------- Actions menu (overflow "...") ---------------- */
function ActionsMenu({ items }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const btnRef = React.useRef(null);
  const popRef = React.useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    window.addEventListener('resize', () => setOpen(false));
    window.addEventListener('scroll', () => setOpen(false), true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('resize', () => setOpen(false));
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  return (
    <div className="actions-menu">
      <button ref={btnRef} className="icon-btn sm" onClick={toggle} aria-label="More actions" aria-expanded={open}>
        <Ic.MoreVertical />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div ref={popRef} className="actions-menu-pop" style={{ top: pos.top, right: pos.right }} onClick={() => setOpen(false)}>
          {items.map((it, i) => (
            <button key={i} className={'actions-menu-item' + (it.danger ? ' danger' : '')} onClick={it.onClick}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------------- Modal shell ---------------- */
/* sheet: on phones the modal docks to the bottom edge (bottom sheet) */
function Modal({ title, onClose, children, footer, sheet }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className={'modal-scrim' + (sheet ? ' modal-sheet' : '')} onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Ic.Close /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* groups that may hold words: groups with no subgroups */
function lwLeafGroups(groups) {
  return groups.filter((g) => !groups.some((other) => other.parentId === g.id));
}

/* ---------------- Word form (create/edit) ---------------- */
/* Ввод / смена / удаление личного ключа Gemini. onSaved() вызывается после
   успешного сохранения — используется, чтобы сразу запустить отложенное действие. */
function GeminiKeyModal({ onClose, onSaved }) {
  const [key, setKey] = React.useState(() => window.lwGetGeminiKey());
  const had = window.lwHasGeminiKey();

  const save = () => {
    window.lwSetGeminiKey(key);
    if (onSaved) onSaved(!!key.trim());
    onClose();
  };
  const clear = () => {
    window.lwSetGeminiKey('');
    setKey('');
    if (onSaved) onSaved(false);
    onClose();
  };

  return (
    <Modal title="Gemini key for AI"
      onClose={onClose}
      footer={
        <React.Fragment>
          {had && <button className="btn btn-ghost" onClick={clear}>Remove key</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!key.trim()} onClick={save}>Save</button>
        </React.Fragment>
      }>
      <div className="form">
        <p className="field-hint" style={{ marginTop: 0 }}>
          AI features use your own Google Gemini key. The key is free,
          is stored only in this browser and uses only your own quota.
        </p>
        <label className="field">
          <span className="field-label">Gemini API key</span>
          <input className="input mono" type="password" value={key} autoFocus
            placeholder="AIza…" onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && key.trim()) save(); }} />
        </label>
        <p className="field-hint" style={{ marginBottom: 0 }}>
          Where to get one: open{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--primary)' }}>aistudio.google.com/apikey</a>{' '}
          → “Create API key”. It's free, no card needed.
        </p>
      </div>
    </Modal>
  );
}

function WordForm({ initial, groups, defaultGroupId, onSave, onCancel }) {
  const [word, setWord] = React.useState(initial ? initial.word : '');
  const [ipa, setIpa] = React.useState(initial ? initial.ipa : '');
  const [tr, setTr] = React.useState(initial ? initial.tr : '');
  const [example, setExample] = React.useState(initial ? (initial.example || '') : '');
  const [exampleTr, setExampleTr] = React.useState(initial ? (initial.exampleTr || '') : '');
  const [photo, setPhoto] = React.useState(initial ? (initial.photo || '') : '');
  const [pos, setPos] = React.useState(initial ? (initial.pos || '') : '');
  const [autoState, setAutoState] = React.useState('idle'); // 'idle' | 'loading' | 'notfound' | 'error'
  const [aiState, setAiState] = React.useState('idle'); // 'idle' | 'loading' | error-code string
  const [keyModal, setKeyModal] = React.useState(false);
  const leafGroups = lwLeafGroups(groups);
  const [groupId, setGroupId] = React.useState(initial ? initial.groupId : (defaultGroupId || (leafGroups[0] && leafGroups[0].id)));
  const fileInputRef = React.useRef(null);

  const canSave = word.trim() && tr.trim();
  const submit = () => {
    if (!canSave) return;
    /* start from the stored doc: lwSetDoc replaces the whole document, so
       fields this form doesn't edit (createdAt, …) must be carried over */
    onSave({
      ...(initial || {}),
      id: initial ? initial.id : window.lwUid(),
      groupId,
      word: word.trim(),
      ipa: ipa.trim(),
      tr: tr.trim(),
      example: example.trim(),
      exampleTr: exampleTr.trim(),
      pos,
      photo,
      createdAt: (initial && initial.createdAt) || Date.now(),
    });
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    window.lwFileToPhoto(file).then(setPhoto).catch(() => {});
  };

  const findPhoto = () => {
    if (!word.trim()) return;
    setAutoState('loading');
    window.lwAutoFindPhoto(word.trim())
      .then((dataUrl) => {
        if (dataUrl) { setPhoto(dataUrl); setAutoState('idle'); }
        else setAutoState('notfound');
      })
      .catch(() => setAutoState('error'));
  };

  const runAiFill = () => {
    setAiState('loading');
    window.lwAiFillWord(word.trim())
      .then((r) => {
        // Не затираем поля, которые пользователь уже заполнил.
        if (r.ipa && !ipa.trim()) setIpa(r.ipa);
        if (r.tr && !tr.trim()) setTr(r.tr);
        if (r.example && !example.trim()) setExample(r.example);
        if (r.exampleTr && !exampleTr.trim()) setExampleTr(r.exampleTr);
        if (r.pos && !pos) setPos(r.pos);
        setAiState('idle');
      })
      .catch((e) => setAiState((e && e.code) || 'error'));
  };

  const fillWithAi = () => {
    if (!word.trim()) return;
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; } // спросим ключ только сейчас
    runAiFill();
  };

  return (
    <div className="form">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">{window.lwLangInfo().name} word</span>
          <input className="input" value={word} autoFocus placeholder={'e.g. ' + window.lwLangInfo().ex.word}
            onChange={(e) => setWord(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Transcription</span>
          <input className="input mono" value={ipa} placeholder="/ˈdʒɜː.ni/"
            onChange={(e) => setIpa(e.target.value)} />
        </label>
      </div>
      <div className="form-grid form-grid-tr">
        <label className="field">
          <span className="field-label">Translation</span>
          <input className="input" value={tr} placeholder="translation"
            onChange={(e) => setTr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </label>
        <label className="field">
          <span className="field-label">Part of speech</span>
          <select className="input" value={pos} onChange={(e) => setPos(e.target.value)}>
            <option value="">—</option>
            {window.LW_POS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Example sentence</span>
        <input className="input" value={example} placeholder={'e.g. ' + window.lwLangInfo().ex.example}
          onChange={(e) => setExample(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Example translation</span>
        <input className="input" value={exampleTr} placeholder="example translation"
          onChange={(e) => setExampleTr(e.target.value)} />
      </label>

      <div className="field">
        <button type="button" className="btn btn-soft sm" disabled={!word.trim() || aiState === 'loading'}
          onClick={fillWithAi}>
          {aiState === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="15" height="15" />}
          {aiState === 'loading' ? 'Filling in…' : 'Fill with AI'}
        </button>
        {aiState === 'quota' && <p className="field-hint">Daily Gemini limit reached. Try again later.</p>}
        {aiState === 'bad-key' && (
          <p className="field-hint">Your Gemini key is invalid.{' '}
            <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Change key</button>
          </p>
        )}
        {aiState === 'refusal' && <p className="field-hint">The model could not process this word.</p>}
        {aiState === 'overload' && <p className="field-hint">Gemini is overloaded right now. Try again in a minute.</p>}
        {aiState !== 'idle' && aiState !== 'loading'
          && !['quota', 'bad-key', 'refusal', 'overload'].includes(aiState)
          && <p className="field-hint">AI service error. Try again later.</p>}
      </div>

      {keyModal && (
        <GeminiKeyModal
          onClose={() => setKeyModal(false)}
          onSaved={(ok) => { if (ok && word.trim()) runAiFill(); }}
        />
      )}

      <div className="field">
        <span className="field-label">Photo</span>
        <div className="photo-edit">
          {photo ? (
            <div className="photo-edit-preview">
              <img src={photo} alt="" />
            </div>
          ) : (
            <div className="photo-edit-preview photo-edit-empty">
              <Ic.Image width="24" height="24" />
            </div>
          )}
          <div className="photo-edit-actions">
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            <button type="button" className="btn btn-soft sm" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              Upload photo
            </button>
            {initial && (
              <button type="button" className="btn btn-soft sm" disabled={autoState === 'loading'} onClick={findPhoto}>
                {autoState === 'loading' ? 'Searching…' : 'Find photo automatically'}
              </button>
            )}
            {photo && (
              <button type="button" className="btn btn-ghost sm" onClick={() => setPhoto('')}>
                Remove
              </button>
            )}
          </div>
          {autoState === 'notfound' && <p className="field-hint">No matching photo found.</p>}
          {autoState === 'error' && <p className="field-hint">Photo search failed. Try again later.</p>}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {leafGroups.map((g) => (
            <button key={g.id} type="button"
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />
              {g.parentId ? (groups.find((p) => p.id === g.parentId) || {}).name + ' / ' + g.name : g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>
          {initial ? 'Save changes' : 'Add word'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Import form (bulk text) ---------------- */
function lwParseImportLine(line) {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length >= 5) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: parts[3], exampleTr: parts[4], pos: window.lwNormPos(parts[5]) };
  }
  if (parts.length === 4) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: parts[3], exampleTr: '' };
  }
  if (parts.length === 3) {
    return { word: parts[0], ipa: parts[1], tr: parts[2], example: '', exampleTr: '' };
  }
  if (parts.length === 2) {
    return { word: parts[0], ipa: '', tr: parts[1], example: '', exampleTr: '' };
  }
  return null;
}

/* Full-page import view. Draft text + chosen group + AI status live in App
   (importState) so a typed/generated list survives leaving the tab; the AI
   fill runs at the App level (startAiFill) and reports back via toast. */
function ImportView({ groups, importState, setImportState, startAiFill, onImport, goLibrary }) {
  const { text, groupId, status, error } = importState;
  const leafGroups = lwLeafGroups(groups);
  const fileInputRef = React.useRef(null);
  const [keyModal, setKeyModal] = React.useState(false);

  const setText = (t) => setImportState((s) => ({ ...s, text: t }));
  const setGroupId = (id) => setImportState((s) => ({ ...s, groupId: id }));

  /* default to the first available category once groups load (and again after
     a language switch, when the chosen group belongs to the other language) */
  React.useEffect(() => {
    if ((!groupId || !leafGroups.some((g) => g.id === groupId)) && leafGroups.length) setGroupId(leafGroups[0].id);
    // eslint-disable-next-line
  }, [leafGroups, groupId]);

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = lines.map(lwParseImportLine);

  const validCount = rows.filter(Boolean).length;
  const invalidCount = rows.length - validCount;
  const loading = status === 'loading';
  const canImport = validCount > 0 && groupId && !loading;

  // «Сырые» строки — те, где нет ни транскрипции, ни перевода (обычно просто
  // одно слово). Их AI может обогатить. Кнопку AI показываем, только пока
  // такие строки есть, — после успешного ответа она сама исчезнет, и повторное
  // нажатие невозможно.
  const rawWords = lines
    .filter((l) => {
      // Голое слово без разделителей (парсер вернёт null) — тоже «сырое».
      if (l.indexOf('|') === -1) return true;
      const p = lwParseImportLine(l);
      return p && !p.ipa && !p.tr;
    })
    .map((l) => l.split('|')[0].trim())
    .filter(Boolean);
  const showAi = rawWords.length > 0;

  const fillWithAi = () => {
    if (!rawWords.length || loading) return;
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; }
    startAiFill(rawWords);
  };

  const submit = () => {
    if (!canImport) return;
    const t = Date.now();
    const items = rows.filter(Boolean).map((r, i) => ({
      id: window.lwUid(),
      groupId,
      word: r.word,
      ipa: r.ipa,
      tr: r.tr,
      example: r.example || '',
      exampleTr: r.exampleTr || '',
      pos: r.pos || '',
      createdAt: t + i, // keeps the list's order in Library's "Recent" sort
    }));
    // Импортируем и очищаем черновик — иначе текст «не пропадает» до импорта.
    onImport(items);
    setImportState((s) => ({ ...s, text: '', status: 'idle', error: null }));
  };

  const clearText = () => setImportState((s) => ({ ...s, text: '', status: 'idle', error: null }));

  return (
    <div className="library import-view">
      <div className="lib-head">
        <div>
          <h1 className="lib-title">Import words</h1>
          <p className="lib-sub">Paste a list, pick a group and import.</p>
        </div>
        <div className="lib-head-actions">
          <button className="btn btn-soft" onClick={goLibrary} disabled={loading}><Ic.Library /> Library</button>
        </div>
      </div>

      <div className="form">
      <p className="field-hint">
        One line per word. Format: <code>word | transcription | translation | example | example translation | part of speech</code>
        {' '}(the example, its translation and the part of speech are optional), or <code>word || translation</code> (no transcription), or <code>word | translation</code>.
      </p>
      <label className="field">
        <div className="field-label-row">
          <span className="field-label">Words to import</span>
          {showAi && (
            <button type="button" className="btn btn-soft sm" disabled={loading} onClick={fillWithAi}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="15" height="15" />}
              {loading ? 'AI is filling in…' : `Fill with AI (${rawWords.length})`}
            </button>
          )}
          <button type="button" className="btn btn-soft sm" disabled={loading}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Ic.Plus width="15" height="15" /> Load file
          </button>
          {text.trim() && (
            <button type="button" className="btn btn-ghost sm" disabled={loading} onClick={clearText}>
              <Ic.Trash width="15" height="15" /> Clear
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <textarea className="input mono" rows={10} value={text} autoFocus disabled={loading}
          placeholder={window.lwLangInfo().ex.import}
          onChange={(e) => setText(e.target.value)} />
        {error === 'bad-key' ? (
          <p className="field-hint">Your Gemini key is invalid.{' '}
            <button type="button" className="btn btn-ghost sm" onClick={() => setKeyModal(true)}>Change key</button>
          </p>
        ) : error === 'quota' ? (
          <p className="field-hint">Daily Gemini limit reached. Try again later.</p>
        ) : error === 'overload' ? (
          <p className="field-hint">Gemini is overloaded right now. Try again in a minute.</p>
        ) : error === 'refusal' ? (
          <p className="field-hint">The model could not process the list. Try fewer words.</p>
        ) : error ? (
          <p className="field-hint">AI service error. Try again later.</p>
        ) : null}
      </label>

      <div className="field">
        <span className="field-label">Group</span>
        <div className="group-pick">
          {leafGroups.map((g) => (
            <button key={g.id} type="button" disabled={loading}
              className={'gp-opt' + (g.id === groupId ? ' gp-on' : '')}
              onClick={() => setGroupId(g.id)}>
              <span className="chip-dot" style={{ background: g.color }} />
              {g.parentId ? (groups.find((p) => p.id === g.parentId) || {}).name + ' / ' + g.name : g.name}
            </button>
          ))}
        </div>
        {leafGroups.length === 0 && (
          <p className="field-hint">Create a group in the Library first.</p>
        )}
      </div>

      {rows.length > 0 && (
        <p className="field-hint">
          Ready to import: {validCount}{invalidCount > 0 ? `, skipped lines: ${invalidCount}` : ''}
        </p>
      )}

      {keyModal && (
        <GeminiKeyModal
          onClose={() => setKeyModal(false)}
          onSaved={(ok) => { if (ok && rawWords.length) startAiFill(rawWords); }}
        />
      )}

      <div className="form-foot">
        <button className="btn btn-primary" disabled={!canImport} onClick={submit}>
          Import {validCount > 0 ? `(${validCount})` : ''}
        </button>
      </div>
      </div>
    </div>
  );
}

/* ---------------- Week chart (answers per day, last 7 days) ----------------
   One series, so no legend: the card title names it. Bars <= 24px with a 4px
   rounded top, a solid hairline for the daily goal, only today's value is
   labelled; every bar carries its own hover/focus tooltip. */
const LW_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function WeekChart({ days, goal }) {
  const [hover, setHover] = React.useState(null);
  const max = Math.max(goal, ...days.map((d) => d.answers), 1);
  const goalPct = (goal / max) * 100;
  return (
    <div className="week-chart">
      <div className="week-plot">
        <div className="week-goal" style={{ bottom: goalPct + '%' }}><span className="week-goal-label">Goal</span></div>
        {days.map((d, i) => {
          const today = i === days.length - 1;
          const pct = (d.answers / max) * 100;
          const label = LW_WEEKDAYS[d.weekday] + (today ? ' (today)' : '') + ': ' + d.answers + ' answers' + (d.goalMet ? ', goal met' : '');
          return (
            <div key={d.date} className={'week-col' + (today ? ' today' : '') + (hover === i ? ' hover' : '')}
              tabIndex={0} aria-label={label}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              {today && d.answers > 0 && hover !== i && <span className="week-val" style={{ bottom: pct + '%' }}>{d.answers}</span>}
              <div className="week-bar" style={{ height: pct + '%' }} />
              {hover === i && <div className="week-tip" style={{ bottom: 'calc(' + pct + '% + 8px)' }}>{label}</div>}
            </div>
          );
        })}
      </div>
      <div className="week-labels" aria-hidden="true">
        {days.map((d, i) => <span key={d.date} className={i === days.length - 1 ? 'today' : ''}>{LW_WEEKDAYS[d.weekday].slice(0, 2)}</span>)}
      </div>
    </div>
  );
}

/* ---------------- Pronunciation check (Web Speech API) ----------------
   The user says a word or reads a passage; the browser's speech recognition
   transcribes it and we mark which target words were heard (longest common
   subsequence, so one slip doesn't shift everything after it). Hidden where
   SpeechRecognition is missing (Firefox). Chrome sends the audio to Google. */
const lwRecognitionClass = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
const lwCanRecognize = () => !!lwRecognitionClass();
const lwSpeechTokens = (t) => (window.lwNormLetters(String(t).toLowerCase()).replace(/[’]/g, "'").match(new RegExp('[' + window.LW_LETTERS + "0-9']+", 'g')) || []);

/* which target tokens appear, in order, in what was heard */
function lwMatchSpoken(target, heard) {
  const a = lwSpeechTokens(target);
  let b = lwSpeechTokens(heard);
  /* recognisers sometimes split one word ("under stand"): glue it back for single words */
  if (a.length === 1 && b.length > 1 && b.join('') === a[0]) b = [a[0]];
  const eq = (x, y) => x === y || (window.readingTokensMatch && window.readingTokensMatch(x, y));
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (eq(a[i], b[j])) { ok[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return { tokens: a, ok, score: a.length ? Math.round((ok.filter(Boolean).length / a.length) * 100) : 0 };
}

function PronunciationCheck({ target, label = 'Say it', passage = false }) {
  const [state, setState] = React.useState('idle'); // idle | listening | done | error
  const [heard, setHeard] = React.useState('');
  const [error, setError] = React.useState('');
  const recRef = React.useRef(null);
  const textRef = React.useRef('');

  React.useEffect(() => () => { if (recRef.current) recRef.current.abort(); }, []);
  if (!lwCanRecognize()) return null;

  const start = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const Recognition = lwRecognitionClass();
    const rec = new Recognition();
    rec.lang = window.lwLangInfo().speech;
    rec.interimResults = false;
    rec.maxAlternatives = passage ? 1 : 3;
    rec.continuous = passage; // a passage can take several breaths; a word is one shot
    textRef.current = '';
    rec.onresult = (e) => {
      const parts = [];
      for (let i = 0; i < e.results.length; i++) {
        const alts = [];
        for (let k = 0; k < e.results[i].length; k++) alts.push(e.results[i][k].transcript);
        /* for a single word, prefer the alternative that matches the target */
        parts.push(passage ? alts[0] : (alts.find((t) => lwMatchSpoken(target, t).score === 100) || alts[0]));
      }
      textRef.current = parts.join(' ');
    };
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Allow microphone access to check your pronunciation.'
        : e.error === 'no-speech' ? "Didn't hear anything — try again a bit louder."
        : e.error === 'network' ? 'Speech recognition needs an internet connection.'
        : 'Speech recognition failed (' + e.error + ').');
      setState('error');
    };
    rec.onend = () => {
      recRef.current = null;
      setState((s) => {
        if (s === 'error') return s;
        if (!textRef.current) { setError("Didn't hear anything — try again a bit louder."); return 'error'; }
        setHeard(textRef.current);
        return 'done';
      });
    };
    recRef.current = rec;
    setError('');
    setHeard('');
    setState('listening');
    rec.start();
  };
  const stop = () => { if (recRef.current) recRef.current.stop(); };

  const result = state === 'done' ? lwMatchSpoken(target, heard) : null;
  const words = String(target).split(/(\s+)/);
  let k = -1;
  return (
    <div className={'pron' + (passage ? ' pron-passage' : '')}>
      <button type="button" className={'pron-btn' + (state === 'listening' ? ' on' : '')}
        onClick={state === 'listening' ? stop : start}>
        <Ic.Mic width="16" height="16" /> {state === 'listening' ? (passage ? 'Stop' : 'Listening…') : state === 'done' || state === 'error' ? 'Try again' : label}
      </button>
      {result && (
        <div className="pron-result">
          <span className={'pron-score' + (result.score >= 85 ? ' good' : result.score >= 50 ? ' ok' : ' low')}>{result.score}%</span>
          {passage ? (
            <p className="pron-text">
              {words.map((w, i) => {
                if (/^\s+$/.test(w) || !lwSpeechTokens(w).length) return w;
                k += lwSpeechTokens(w).length;
                return <span key={i} className={result.ok[k] ? 'pron-ok' : 'pron-miss'}>{w}</span>;
              })}
            </p>
          ) : (
            <span className="pron-heard">{result.score === 100 ? 'Sounds right!' : 'Heard: “' + heard + '”'}</span>
          )}
        </div>
      )}
      {state === 'error' && <span className="pron-error">{error}</span>}
    </div>
  );
}

/* ---------------- Collocation form (create / edit) ----------------
   A collocation is a word plus links to phrase cards (ordinary words) and
   wrong partners for the game. Found cards: multi-word cards containing the
   word. "+ Add phrase" and AI suggestions become new cards on save (the parent
   puts them in the "Collocations" group). onSave(entry, phrases, newPhrases). */
const LW_COLLOC_AI_MSG = {
  'no-key': 'Add a Gemini key first.',
  'bad-key': 'Your Gemini key is invalid.',
  quota: 'Daily Gemini limit reached. Try again later.',
  overload: 'Gemini is overloaded right now. Try again in a minute.',
  refusal: 'The model could not process this word.',
};
let lwCollocRowSeq = 0;
const lwNewPhraseRow = (fields = {}) => ({
  key: 'np' + (++lwCollocRowSeq), phrase: '', partner: '', partnerTouched: false,
  tr: '', ipa: '', example: '', exampleTr: '', on: true, ai: false, ...fields,
});

function CollocForm({ initial, words, entries, isAdmin, userId, onSave, onOpenExisting, onCancel }) {
  const [word, setWord] = React.useState(initial ? initial.word : '');
  const [pattern, setPattern] = React.useState(initial ? (initial.pattern || '') : '');
  const [pos, setPos] = React.useState(initial ? (initial.pos || '') : '');
  /* choices for linked cards, by word id: { on, partner } */
  const [picks, setPicks] = React.useState(() => {
    const m = {};
    ((initial && initial.phrases) || []).forEach((p) => { m[p.wordId] = { on: true, partner: p.partner }; });
    return m;
  });
  const [added, setAdded] = React.useState([]);
  const [wrong, setWrong] = React.useState(() => ((initial && initial.wrong) || []).map((w) => ({ ...w })));
  const [aiState, setAiState] = React.useState('idle');
  const [keyModal, setKeyModal] = React.useState(false);
  const [tried, setTried] = React.useState(false);

  const key = window.lwCollocKey(word);
  /* admins build shared entries, so only shared cards may be linked */
  const pool = React.useMemo(() => (isAdmin ? words.filter((w) => w.shared) : words), [words, isAdmin]);
  const byId = React.useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  const linked = ((initial && initial.phrases) || []).map((p) => byId[p.wordId]).filter(Boolean);
  const found = React.useMemo(() => window.lwFindPhraseCards(key, pool), [key, pool]);
  const cards = [...linked, ...found.filter((w) => !linked.some((l) => l.id === w.id))];
  const pick = (w) => picks[w.id] || { on: !initial, partner: window.lwCollocPartner(w.word, key) };
  const setPick = (w, fields) => setPicks((m) => ({ ...m, [w.id]: { ...pick(w), ...fields } }));

  const duplicate = !initial && key && entries.find((e) => e.key === key
    && (isAdmin ? e.shared : e.userId === userId && !e.shared));

  const setRow = (k, fields) => setAdded((rows) => rows.map((r) => {
    if (r.key !== k) return r;
    const next = { ...r, ...fields };
    if ('phrase' in fields && !r.partnerTouched) next.partner = window.lwCollocPartner(fields.phrase, key);
    if ('partner' in fields) next.partnerTouched = true;
    return next;
  }));
  const setWrongRow = (i, fields) => setWrong((rows) => rows.map((r, j) => (j === i ? { ...r, ...fields } : r)));

  /* what will be saved */
  const chosen = cards.filter((w) => pick(w).on).map((w) => ({ wordId: w.id, partner: pick(w).partner.trim(), text: w.word }));
  const fresh = added.filter((r) => r.on);
  const wrongClean = wrong.map((w) => ({ partner: w.partner.trim(), fix: w.fix.trim() })).filter((w) => w.partner || w.fix);
  const partners = [...chosen.map((c) => c.partner), ...fresh.map((r) => r.partner.trim()), ...wrongClean.map((w) => w.partner)]
    .map((x) => x.toLowerCase());
  const errors = [];
  if (!key) errors.push('Enter a word.');
  else if (/\s/.test(key)) errors.push('Use a single word.');
  if (chosen.length + fresh.length < 2) errors.push('Pick at least 2 phrases.');
  if (fresh.some((r) => !r.phrase.trim() || !r.tr.trim())) errors.push('New phrases need a phrase and a translation.');
  if (wrongClean.length < 1) errors.push('Add at least 1 wrong partner.');
  if (wrongClean.some((w) => !w.partner || !w.fix)) errors.push('Each wrong partner needs the correct combination.');
  if (partners.some((x) => !x)) errors.push('Every phrase needs chip text.');
  else if (new Set(partners).size !== partners.length) errors.push('Chip texts must be different.');
  if (duplicate) errors.push('You already have this collocation.');

  const submit = () => {
    setTried(true);
    if (errors.length) return;
    onSave(
      { ...(initial || {}), word: key, key, pattern: pattern.trim(), pos, wrong: wrongClean },
      chosen.map(({ wordId, partner }) => ({ wordId, partner })),
      fresh.map((r) => ({
        word: r.phrase.trim(), partner: r.partner.trim(), tr: r.tr.trim(), ipa: r.ipa.trim(),
        example: r.example.trim(), exampleTr: r.exampleTr.trim(),
      })),
    );
  };

  const runAi = () => {
    setAiState('loading');
    const have = [...cards.map((w) => w.word), ...added.map((r) => r.phrase)];
    window.lwAiSuggestCollocations(key, have)
      .then((r) => {
        if (!pattern.trim() && r.pattern) setPattern(r.pattern);
        if (!pos && r.pos) setPos(r.pos);
        const haveSet = new Set(have.map((x) => x.trim().toLowerCase()));
        setAdded((rows) => [...rows, ...r.phrases.filter((x) => !haveSet.has(x.phrase.toLowerCase()))
          .map((x) => lwNewPhraseRow({ ...x, partnerTouched: true, on: false, ai: true }))]);
        setWrong((rows) => {
          const seen = new Set(rows.map((w) => w.partner.trim().toLowerCase()));
          const more = r.wrong.filter((w) => !seen.has(w.partner.toLowerCase()));
          return [...rows.filter((w) => w.partner.trim() || w.fix.trim()), ...more].slice(0, 5);
        });
        setAiState('idle');
      })
      .catch((e) => setAiState((e && e.code) || 'error'));
  };
  const suggest = () => {
    if (!key) return;
    if (!window.lwHasGeminiKey()) { setKeyModal(true); return; }
    runAi();
  };

  return (
    <div className="form colloc-form">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Word</span>
          <input className="input" value={word} autoFocus={!initial} disabled={!!initial} placeholder="e.g. heavy"
            onChange={(e) => setWord(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Pattern</span>
          <input className="input" value={pattern} placeholder="heavy + noun" onChange={(e) => setPattern(e.target.value)} />
        </label>
      </div>
      {duplicate && (
        <div className="colloc-dup">
          <span>You already have collocations for <strong>{key}</strong>.</span>
          <button type="button" className="btn btn-soft sm" onClick={() => onOpenExisting(duplicate)}>Open</button>
        </div>
      )}

      <div className="colloc-sec">
        <div className="colloc-sec-head">
          <span className="field-label">Phrases from your cards</span>
          <span className="colloc-sec-count">{chosen.length}</span>
        </div>
        {cards.length === 0 ? (
          <p className="field-hint">{key ? 'No cards with “' + key + '” yet. Add phrases below.' : 'Type a word to find phrase cards.'}</p>
        ) : (
          <div className="colloc-rows">
            {cards.map((w) => {
              const pk = pick(w);
              return (
                <div className={'colloc-row' + (pk.on ? '' : ' off')} key={w.id}>
                  <input type="checkbox" className="colloc-check" checked={pk.on} aria-label={'Use ' + w.word}
                    onChange={(e) => setPick(w, { on: e.target.checked })} />
                  <div className="colloc-row-main">
                    <span className="colloc-phrase">{w.word}</span>
                    <span className="colloc-tr">{w.tr}{w.shared && !isAdmin ? ' · shared' : ''}</span>
                  </div>
                  <input className="input input-sm colloc-partner" value={pk.partner} disabled={!pk.on}
                    aria-label="Chip text" title="Chip text in the game" onChange={(e) => setPick(w, { partner: e.target.value })} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="colloc-sec">
        <div className="colloc-sec-head">
          <span className="field-label">New phrases</span>
          <span className="field-hint">saved as cards in “Collocations”</span>
        </div>
        {added.map((r) => (
          <div className={'colloc-new' + (r.on ? '' : ' off')} key={r.key}>
            <div className="colloc-new-top">
              <input type="checkbox" className="colloc-check" checked={r.on} aria-label="Use this phrase"
                onChange={(e) => setRow(r.key, { on: e.target.checked })} />
              <input className="input input-sm" value={r.phrase} placeholder="heavy rain" aria-label="Phrase"
                onChange={(e) => setRow(r.key, { phrase: e.target.value })} />
              <input className="input input-sm colloc-partner" value={r.partner} placeholder="chip" aria-label="Chip text"
                onChange={(e) => setRow(r.key, { partner: e.target.value })} />
              {r.ai && <span className="colloc-ai">AI</span>}
              <button type="button" className="icon-btn sm danger" aria-label="Remove phrase"
                onClick={() => setAdded((rows) => rows.filter((x) => x.key !== r.key))}><Ic.Trash /></button>
            </div>
            <div className="colloc-new-fields">
              <input className="input input-sm" value={r.tr} placeholder="translation" aria-label="Translation"
                onChange={(e) => setRow(r.key, { tr: e.target.value })} />
              <input className="input input-sm" value={r.example} placeholder="example sentence" aria-label="Example"
                onChange={(e) => setRow(r.key, { example: e.target.value })} />
              <input className="input input-sm" value={r.exampleTr} placeholder="example translation" aria-label="Example translation"
                onChange={(e) => setRow(r.key, { exampleTr: e.target.value })} />
            </div>
          </div>
        ))}
        <div className="colloc-actions">
          <button type="button" className="btn btn-soft sm" onClick={() => setAdded((rows) => [...rows, lwNewPhraseRow()])}>
            <Ic.Plus width="15" height="15" /> Add phrase
          </button>
          <button type="button" className="btn btn-soft sm" disabled={!key || aiState === 'loading'} onClick={suggest}>
            {aiState === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Bulb width="15" height="15" />}
            {aiState === 'loading' ? 'Asking Gemini…' : 'Suggest with AI'}
          </button>
        </div>
        {aiState !== 'idle' && aiState !== 'loading' && (
          <p className="field-hint">{LW_COLLOC_AI_MSG[aiState] || 'AI service error. Try again later.'}</p>
        )}
        {added.some((r) => r.ai && !r.on) && <p className="field-hint">Tick the AI phrases you want to keep.</p>}
      </div>

      <div className="colloc-sec">
        <div className="colloc-sec-head">
          <span className="field-label">Common mistakes (wrong partners)</span>
        </div>
        {wrong.map((w, i) => (
          <div className="colloc-wrong-row" key={i}>
            <input className="input input-sm" value={w.partner} placeholder="homework" aria-label="Wrong partner"
              onChange={(e) => setWrongRow(i, { partner: e.target.value })} />
            <span className="colloc-arrow">→</span>
            <input className="input input-sm" value={w.fix} placeholder="do homework" aria-label="Correct combination"
              onChange={(e) => setWrongRow(i, { fix: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove"
              onClick={() => setWrong((rows) => rows.filter((_, j) => j !== i))}><Ic.Trash /></button>
          </div>
        ))}
        {wrong.length < 5 && (
          <button type="button" className="btn btn-soft sm" onClick={() => setWrong((rows) => [...rows, { partner: '', fix: '' }])}>
            <Ic.Plus width="15" height="15" /> Add wrong partner
          </button>
        )}
      </div>

      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Save</button>
      </div>
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(false)} onSaved={(ok) => { if (ok && key) runAi(); }} />}
    </div>
  );
}

/* ---------------- Grammar lessons: body (shared by lesson screen and preview) and editor ---------------- */

/* text with [[highlighted]] parts */
function Marked({ text }) {
  const parts = String(text || '').split(/\[\[(.+?)\]\]/);
  return <>{parts.map((p, i) => (i % 2 ? <mark className="mk" key={i}>{p}</mark> : p))}</>;
}
const lwUnmark = (t) => String(t || '').replace(/\[\[|\]\]/g, '');

const LW_FORMULA_KINDS = [
  { id: 'affirmative', label: 'Affirmative', sign: '+' },
  { id: 'negative', label: 'Negative', sign: '−' },
  { id: 'question', label: 'Question', sign: '?' },
  { id: 'rule', label: 'Rule', sign: '•' },
];

function LessonBody({ lesson }) {
  const formulas = lesson.formulas || [];
  const table = lesson.compareTable || {};
  const rows = table.rows || [];
  const examples = lesson.examples || [];
  return (
    <div className="ls-body">
      {lesson.focus && (
        <section className="ls-focus">
          <Ic.Bulb width="20" height="20" />
          <p><span className="ls-focus-label">Key idea: </span><Marked text={lesson.focus} /></p>
        </section>
      )}

      {formulas.length > 0 && (
        <section className="ls-sec">
          <div className="ls-sec-head"><h3>Formulas</h3><span>{formulas.length} sentence {formulas.length === 1 ? 'type' : 'types'}</span></div>
          {formulas.map((f, i) => {
            const k = LW_FORMULA_KINDS.find((x) => x.id === f.kind) || LW_FORMULA_KINDS[0];
            return (
              <div className="ls-card ls-formula" key={i}>
                <div className="ls-formula-top">
                  <span className={'ls-kind ls-kind-' + k.id}>{k.sign}</span>
                  <span className="ls-kind-label">{k.label}</span>
                  <code className="ls-pattern">{f.pattern}</code>
                </div>
                <div className="ls-ex-row"><p className="ls-ex"><Marked text={f.example} /></p><SpeakButton word={lwUnmark(f.example)} /></div>
                {f.tr && <p className="ls-tr">{f.tr}</p>}
              </div>
            );
          })}
        </section>
      )}

      {rows.length > 0 && (
        <section className="ls-sec">
          <div className="ls-sec-head"><h3>{lesson.compare ? 'How it differs from ' + lesson.compare : 'Key differences'}</h3></div>
          <div className="ls-card ls-compare">
            {rows.map((r, i) => (
              <div className={'ls-crow' + (i === 0 ? ' first' : '')} key={i}>
                <div className="ls-crow-top"><span className="ls-crow-title">{r.title}</span>{r.tag && <span className="ls-crow-tag">{r.tag}</span>}</div>
                {r.markers && <p className="ls-markers"><span>Markers: </span>{r.markers}</p>}
                <div className="ls-crow-foot"><code className="ls-pattern">{r.pattern}</code><span className="ls-crow-ex">«{lwUnmark(r.example)}»</span></div>
              </div>
            ))}
            {table.tip && <p className="ls-tip"><Ic.Bulb width="16" height="16" /><span>{table.tip}</span></p>}
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="ls-sec">
          <div className="ls-sec-head"><h3>Worked examples</h3></div>
          {examples.map((x, i) => (
            <div className="ls-card ls-example" key={i}>
              <div className="ls-ex-row"><p className="ls-ex ls-ex-big">“<Marked text={x.sentence} />”</p><SpeakButton word={lwUnmark(x.sentence)} /></div>
              {x.tr && <p className="ls-tr">{x.tr}</p>}
              {(x.notes || []).length > 0 && (
                <div className="ls-notes">
                  {x.notes.map((n, j) => <span className="ls-note" key={j}><strong>{n.part}</strong> = {n.text}</span>)}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const lwEmptyTask = (type = 'choice') => (type === 'fill'
  ? { type: 'fill', q: '', answers: [''], why: '' }
  : { type: 'choice', q: '', options: ['', '', '', ''], answer: 0, why: '' });
const LW_LESSON_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* Lesson editor (admins). Fill by hand or with "Generate with AI"; exactly 10
   test tasks. onSave(lesson, publish) — publish: true publishes, false keeps a draft. */
function LessonForm({ initial, topics, onSave, onDelete, onCancel }) {
  const [d, setD] = React.useState(() => {
    const quiz = ((initial && initial.quiz) || []).map((t) => (t.type === 'fill'
      ? { ...t, answers: (t.answers || []).length ? t.answers.slice() : [''] }
      : { ...t, options: [0, 1, 2, 3].map((i) => (t.options || [])[i] || '') }));
    while (quiz.length < window.LW_LESSON_TASKS) quiz.push(lwEmptyTask(quiz.length % 5 === 4 ? 'fill' : 'choice'));
    return {
      title: '', topic: '', level: 'B1', minutes: 10, compare: '', focus: '',
      formulas: [], compareTable: { rows: [], tip: '' }, examples: [],
      ...(initial || {}),
      quiz,
    };
  });
  const [preview, setPreview] = React.useState(false);
  const [aiState, setAiState] = React.useState('idle');
  const [taskBusy, setTaskBusy] = React.useState(-1);
  const [keyModal, setKeyModal] = React.useState(null); // pending AI action
  const [tried, setTried] = React.useState(false);

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setIn = (k, i, fields) => setD((x) => ({ ...x, [k]: x[k].map((r, j) => (j === i ? { ...r, ...fields } : r)) }));
  const addIn = (k, row) => setD((x) => ({ ...x, [k]: [...x[k], row] }));
  const delIn = (k, i) => setD((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) }));
  const setRow = (i, fields) => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: x.compareTable.rows.map((r, j) => (j === i ? { ...r, ...fields } : r)) } }));
  const setTask = (i, fields) => setD((x) => ({ ...x, quiz: x.quiz.map((t, j) => (j === i ? { ...t, ...fields } : t)) }));
  const setTaskType = (i, type) => setD((x) => ({ ...x, quiz: x.quiz.map((t, j) => (j === i ? { ...lwEmptyTask(type), q: t.q, why: t.why } : t)) }));

  /* what gets saved: trimmed, empty rows dropped */
  const clean = () => ({
    ...d,
    title: d.title.trim(), topic: d.topic.trim(), compare: (d.compare || '').trim(), focus: d.focus.trim(),
    minutes: Math.min(60, Math.max(1, Number(d.minutes) || 10)),
    formulas: d.formulas.map((f) => ({ ...f, pattern: f.pattern.trim(), example: f.example.trim(), tr: (f.tr || '').trim() })).filter((f) => f.pattern || f.example),
    compareTable: {
      rows: d.compareTable.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v || '').trim()]))).filter((r) => r.title),
      tip: (d.compareTable.tip || '').trim(),
    },
    examples: d.examples.map((x) => ({ sentence: x.sentence.trim(), tr: (x.tr || '').trim(), notes: (x.notes || []).filter((n) => n.part.trim() && n.text.trim()) })).filter((x) => x.sentence),
    quiz: d.quiz.map((t) => window.lwNormTask(t.type === 'fill' ? { ...t, answers: t.answers.map((a) => a.trim()) } : t)),
  });
  const out = clean();
  const errors = [];
  if (!out.title) errors.push('Enter a title.');
  if (!out.topic) errors.push('Enter a topic.');
  if (!out.focus) errors.push('Write the key idea.');
  const badTasks = out.quiz.map((t, i) => (t ? 0 : i + 1)).filter(Boolean);
  if (badTasks.length) errors.push('Complete test task' + (badTasks.length > 1 ? 's ' : ' ') + badTasks.join(', ')
    + ': a question, 4 options for Choice or an answer for Fill.');

  const save = (publish) => {
    setTried(true);
    if (errors.length) return;
    onSave(out, publish);
  };

  const needKey = (action) => { if (window.lwHasGeminiKey()) return false; setKeyModal(() => action); return true; };
  const generate = () => {
    if (!d.title.trim() && !d.topic.trim()) { setAiState('empty'); return; }
    if (needKey(generate)) return;
    setAiState('loading');
    window.lwAiGenerateLesson({ title: d.title, topic: d.topic, level: d.level, compare: d.compare })
      .then((r) => {
        setD((x) => {
          const quiz = r.quiz.slice();
          while (quiz.length < window.LW_LESSON_TASKS) quiz.push(lwEmptyTask(quiz.length % 5 === 4 ? 'fill' : 'choice'));
          return {
            ...x, title: x.title.trim() || r.title, focus: r.focus, minutes: r.minutes, formulas: r.formulas,
            compareTable: r.compareTable, examples: r.examples,
            quiz: quiz.map((t) => (t.type === 'fill' ? { ...t, answers: t.answers.length ? t.answers : [''] } : t)),
          };
        });
        setAiState(r.quiz.length < window.LW_LESSON_TASKS ? 'short' : 'idle');
      })
      .catch((e) => setAiState((e && e.code) || 'error'));
  };
  const regenTask = (i) => {
    if (needKey(() => regenTask(i))) return;
    setTaskBusy(i);
    window.lwAiRegenerateTask({ ...d, quiz: d.quiz.filter((_, j) => j !== i) }, d.quiz[i].type)
      .then((t) => { setD((x) => ({ ...x, quiz: x.quiz.map((q, j) => (j === i ? (t.type === 'fill' ? t : { ...t, options: t.options.slice() }) : q)) })); setTaskBusy(-1); })
      .catch((e) => { setTaskBusy(-1); setAiState((e && e.code) || 'error'); });
  };
  const aiMsg = {
    empty: 'Enter a title or a topic first.',
    short: 'AI returned fewer than 10 valid tasks — fill in or regenerate the empty ones.',
    ...LW_COLLOC_AI_MSG,
  };

  if (preview) {
    return (
      <div className="lesson-form">
        <div className="lf-preview-bar">
          <span className="lf-preview-label">Preview</span>
          <button type="button" className="btn btn-soft sm" onClick={() => setPreview(false)}><Ic.Edit width="15" height="15" /> Back to editor</button>
        </div>
        <h2 className="ls-title">{out.title || 'Untitled lesson'}</h2>
        <LessonBody lesson={out} />
        <p className="field-hint">The test ({window.LW_LESSON_TASKS} tasks) is shown after “I've studied this”.</p>
      </div>
    );
  }

  return (
    <div className="form lesson-form">
      <div className="lf-ai">
        <button type="button" className="btn btn-soft sm" disabled={aiState === 'loading'} onClick={generate}>
          {aiState === 'loading' ? <span className="spinner" aria-hidden="true" /> : <Ic.Sparkle width="15" height="15" />}
          {aiState === 'loading' ? 'Writing the lesson…' : 'Generate with AI'}
        </button>
        <button type="button" className="btn btn-soft sm" onClick={() => setPreview(true)}><Ic.Book width="15" height="15" /> Preview</button>
      </div>
      {aiState !== 'idle' && aiState !== 'loading' && <p className="field-hint lf-ai-msg">{aiMsg[aiState] || 'AI service error. Try again later.'}</p>}

      <h4 className="lf-h">Basics</h4>
      <label className="field">
        <span className="field-label">Title</span>
        <input className="input" value={d.title} placeholder="Past Simple vs Present Perfect" onChange={(e) => set('title', e.target.value)} />
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Topic</span>
          <input className="input" value={d.topic} list="lw-lesson-topics" placeholder="Tenses" onChange={(e) => set('topic', e.target.value)} />
          <datalist id="lw-lesson-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className="field">
          <span className="field-label">Compare with (optional)</span>
          <input className="input" value={d.compare || ''} placeholder="Present Perfect" onChange={(e) => set('compare', e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Level</span>
          <select className="input" value={d.level} onChange={(e) => set('level', e.target.value)}>
            {LW_LESSON_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Minutes to study</span>
          <input className="input" type="number" min="1" max="60" value={d.minutes} onChange={(e) => set('minutes', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Key idea</span>
        <textarea className="input lf-area" rows="2" value={d.focus} placeholder="Действие завершилось, но результат связан с [[моментом сейчас]]."
          onChange={(e) => set('focus', e.target.value)} />
        <span className="field-hint">Wrap words in [[double brackets]] to highlight them.</span>
      </label>

      <h4 className="lf-h">Formulas</h4>
      {d.formulas.map((f, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <select className="input input-sm" value={f.kind} aria-label="Sentence type" onChange={(e) => setIn('formulas', i, { kind: e.target.value })}>
              {LW_FORMULA_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <input className="input input-sm" value={f.pattern} placeholder="have/has + V3" aria-label="Pattern" onChange={(e) => setIn('formulas', i, { pattern: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove formula" onClick={() => delIn('formulas', i)}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={f.example} placeholder="I [[have lost]] my keys." aria-label="Example" onChange={(e) => setIn('formulas', i, { example: e.target.value })} />
          <input className="input input-sm" value={f.tr || ''} placeholder="translation" aria-label="Translation" onChange={(e) => setIn('formulas', i, { tr: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn-soft sm lf-add" onClick={() => addIn('formulas', { kind: ['affirmative', 'negative', 'question'][d.formulas.length % 3], pattern: '', example: '', tr: '' })}>
        <Ic.Plus width="15" height="15" /> Add formula
      </button>

      <h4 className="lf-h">Difference table</h4>
      {d.compareTable.rows.map((r, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <input className="input input-sm" value={r.title} placeholder="Present Perfect" aria-label="Column title" onChange={(e) => setRow(i, { title: e.target.value })} />
            <input className="input input-sm" value={r.tag || ''} placeholder="Связь с сейчас" aria-label="Tag" onChange={(e) => setRow(i, { tag: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove row"
              onClick={() => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: x.compareTable.rows.filter((_, j) => j !== i) } }))}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={r.markers || ''} placeholder="Markers: already, just, ever…" aria-label="Markers" onChange={(e) => setRow(i, { markers: e.target.value })} />
          <div className="lf-row">
            <input className="input input-sm" value={r.pattern || ''} placeholder="have/has + V3" aria-label="Pattern" onChange={(e) => setRow(i, { pattern: e.target.value })} />
            <input className="input input-sm" value={r.example || ''} placeholder="I have already eaten." aria-label="Example" onChange={(e) => setRow(i, { example: e.target.value })} />
          </div>
        </div>
      ))}
      {d.compareTable.rows.length < 3 && (
        <button type="button" className="btn btn-soft sm lf-add"
          onClick={() => setD((x) => ({ ...x, compareTable: { ...x.compareTable, rows: [...x.compareTable.rows, { title: '', tag: '', markers: '', pattern: '', example: '' }] } }))}>
          <Ic.Plus width="15" height="15" /> Add column
        </button>
      )}
      <label className="field">
        <span className="field-label">Tip</span>
        <input className="input" value={d.compareTable.tip || ''} placeholder="Если указано конкретное время (yesterday) — всегда Past Simple."
          onChange={(e) => setD((x) => ({ ...x, compareTable: { ...x.compareTable, tip: e.target.value } }))} />
      </label>

      <h4 className="lf-h">Worked examples</h4>
      {d.examples.map((x, i) => (
        <div className="lf-block" key={i}>
          <div className="lf-row">
            <input className="input input-sm" value={x.sentence} placeholder="I [[have worked]] here [[for three years]]." aria-label="Sentence"
              onChange={(e) => setIn('examples', i, { sentence: e.target.value })} />
            <button type="button" className="icon-btn sm danger" aria-label="Remove example" onClick={() => delIn('examples', i)}><Ic.Trash /></button>
          </div>
          <input className="input input-sm" value={x.tr || ''} placeholder="translation" aria-label="Translation" onChange={(e) => setIn('examples', i, { tr: e.target.value })} />
          {(x.notes || []).map((n, j) => (
            <div className="lf-row lf-note" key={j}>
              <input className="input input-sm" value={n.part} placeholder="have worked" aria-label="Part"
                onChange={(e) => setIn('examples', i, { notes: x.notes.map((m, k) => (k === j ? { ...m, part: e.target.value } : m)) })} />
              <input className="input input-sm" value={n.text} placeholder="до сих пор работаю" aria-label="Explanation"
                onChange={(e) => setIn('examples', i, { notes: x.notes.map((m, k) => (k === j ? { ...m, text: e.target.value } : m)) })} />
              <button type="button" className="icon-btn sm danger" aria-label="Remove note"
                onClick={() => setIn('examples', i, { notes: x.notes.filter((_, k) => k !== j) })}><Ic.Trash /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost sm lf-add" onClick={() => setIn('examples', i, { notes: [...(x.notes || []), { part: '', text: '' }] })}>
            <Ic.Plus width="14" height="14" /> Add note
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-soft sm lf-add" onClick={() => addIn('examples', { sentence: '', tr: '', notes: [] })}>
        <Ic.Plus width="15" height="15" /> Add example
      </button>

      <h4 className="lf-h">Test — {window.LW_LESSON_TASKS} tasks</h4>
      {d.quiz.map((t, i) => (
        <div className={'lf-block lf-task' + (tried && !out.quiz[i] ? ' bad' : '')} key={i}>
          <div className="lf-row">
            <span className="lf-num">{i + 1}</span>
            <select className="input input-sm lf-type" value={t.type} aria-label="Task type" onChange={(e) => setTaskType(i, e.target.value)}>
              <option value="choice">Choice</option>
              <option value="fill">Fill in</option>
            </select>
            <button type="button" className="btn btn-ghost sm" disabled={taskBusy === i} onClick={() => regenTask(i)}>
              {taskBusy === i ? <span className="spinner" aria-hidden="true" /> : <Ic.Repeat width="14" height="14" />} Regenerate
            </button>
          </div>
          <input className="input input-sm" value={t.q} placeholder={t.type === 'fill' ? 'She ___ (finish) her report yet.' : 'I ___ him yesterday.'} aria-label="Question"
            onChange={(e) => setTask(i, { q: e.target.value })} />
          {t.type === 'choice' ? (
            <div className="lf-options">
              {t.options.map((o, j) => (
                <label className={'lf-option' + (t.answer === j ? ' on' : '')} key={j}>
                  <input type="radio" name={'lf-ans-' + i} checked={t.answer === j} onChange={() => setTask(i, { answer: j })} aria-label={'Correct answer ' + (j + 1)} />
                  <input className="input input-sm" value={o} placeholder={'option ' + (j + 1)}
                    onChange={(e) => setTask(i, { options: t.options.map((x, k) => (k === j ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
          ) : (
            <label className="field">
              <span className="field-hint">Accepted answers, separated by |</span>
              <input className="input input-sm" value={t.answers.join(' | ')} placeholder="has finished | 's finished"
                onChange={(e) => setTask(i, { answers: e.target.value.split('|') })} />
            </label>
          )}
          <input className="input input-sm" value={t.why || ''} placeholder="why this answer (shown after answering)" aria-label="Explanation"
            onChange={(e) => setTask(i, { why: e.target.value })} />
        </div>
      ))}

      {tried && errors.length > 0 && <p className="colloc-error" role="alert">{errors[0]}</p>}
      <div className="form-foot lf-foot">
        {onDelete && <button type="button" className="btn btn-ghost danger-text" onClick={onDelete}><Ic.Trash width="15" height="15" /> Delete</button>}
        <span className="lf-foot-gap" />
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-soft" onClick={() => save(false)}>Save draft</button>
        <button type="button" className="btn btn-primary" onClick={() => save(true)}>Publish</button>
      </div>
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(null)} onSaved={(ok) => { const a = keyModal; setKeyModal(null); if (ok) a(); }} />}
    </div>
  );
}

/* ---------------- YouTube clips ---------------- */

/* "https://youtu.be/ID?t=42", "watch?v=ID&t=1m2s", "shorts/ID", "embed/ID" or
   a bare 11-character id → { videoId, t } (t in seconds or null) */
function lwParseYouTube(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return { videoId: s, t: null };
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (!m) return null;
  const tm = s.match(/[?&#](?:t|start)=([\dhms.]+)/);
  let t = null;
  if (tm) {
    const v = tm[1];
    if (/^\d+(\.\d+)?$/.test(v)) t = Number(v);
    else {
      const p = v.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
      t = (Number(p[1] || 0) * 3600) + (Number(p[2] || 0) * 60) + Number(p[3] || 0);
    }
  }
  return { videoId: m[1], t };
}
/* "1:04.5" / "64.5" / "1:02:03" → seconds (null if not a time) */
function lwParseTime(str) {
  const s = String(str == null ? '' : str).trim();
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null;
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
/* 64.5 → "1:04.5", 4 → "0:04" */
function lwFormatTime(sec) {
  const v = Math.max(0, Number(sec) || 0);
  const m = Math.floor(v / 60);
  const rest = v - m * 60;
  const whole = Math.floor(rest);
  const tenth = Math.round((rest - whole) * 10);
  return m + ':' + String(whole).padStart(2, '0') + (tenth ? '.' + (tenth === 10 ? 9 : tenth) : '');
}

/* the IFrame API script, loaded once */
let lwYtLoading = null;
function lwLoadYouTube() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!lwYtLoading) {
    lwYtLoading = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { lwYtLoading = null; resolve(null); };
      document.head.appendChild(tag);
    });
  }
  return lwYtLoading;
}

/* A YouTube fragment with our own controls. Plays from `start` to `end`, then
   stops and rewinds (onEnd). `free`: the whole video with YouTube's controls
   (for picking times in the admin form). `apiRef.current` gets
   { play, replay, pause, time } — time is the absolute position in seconds.
   `overlay` is drawn over the video (subtitles). onError(code): the video is
   gone, private or can't be embedded. */
function YouTubeClip({ videoId, start = 0, end, rate = 1, free = false, apiRef, overlay, onEnd, onError }) {
  const holder = React.useRef(null);
  const player = React.useRef(null);
  const [state, setState] = React.useState('loading'); // loading | ready | playing | paused | error
  const [pos, setPos] = React.useState(0); // seconds into the fragment
  const endRef = React.useRef(end);
  endRef.current = end;
  const len = Math.max(0.1, (end || 0) - start);

  React.useEffect(() => {
    let dead = false;
    let timer = null;
    lwLoadYouTube().then((YT) => {
      if (dead || !holder.current) return;
      if (!YT) { setState('error'); if (onError) onError('api'); return; }
      const el = document.createElement('div');
      holder.current.appendChild(el);
      player.current = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%', height: '100%',
        playerVars: {
          start: Math.floor(start), playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3,
          cc_load_policy: 0, controls: free ? 1 : 0, disablekb: free ? 0 : 1, fs: free ? 1 : 0,
        },
        events: {
          onReady: () => { if (!dead) setState('ready'); },
          onError: (e) => { if (!dead) { setState('error'); if (onError) onError(e.data); } },
          onStateChange: (e) => {
            if (dead) return;
            if (e.data === YT.PlayerState.PLAYING) setState('playing');
            else if (e.data === YT.PlayerState.PAUSED) setState((s) => (s === 'error' ? s : 'paused'));
            else if (e.data === YT.PlayerState.ENDED) { setState('paused'); if (onEnd) onEnd(); }
          },
        },
      });
      /* keep the fragment inside [start, end] */
      timer = setInterval(() => {
        const p = player.current;
        if (!p || !p.getCurrentTime || free) return;
        const t = p.getCurrentTime();
        setPos(Math.max(0, t - start));
        if (endRef.current && t >= endRef.current && p.getPlayerState() === YT.PlayerState.PLAYING) {
          p.pauseVideo();
          p.seekTo(start, true);
          setPos(0);
          if (onEnd) onEnd();
        }
      }, 120);
    });
    return () => {
      dead = true;
      clearInterval(timer);
      try { if (player.current && player.current.destroy) player.current.destroy(); } catch (e) { /* already gone */ }
      player.current = null;
      if (holder.current) holder.current.innerHTML = '';
    };
    // eslint-disable-next-line
  }, [videoId, free]);

  React.useEffect(() => {
    const p = player.current;
    if (p && p.setPlaybackRate && state !== 'loading') p.setPlaybackRate(rate);
  }, [rate, state]);

  const api = {
    play: () => { const p = player.current; if (p && p.playVideo) { if (!free && p.getCurrentTime() >= (end || Infinity)) p.seekTo(start, true); p.setPlaybackRate(rate); p.playVideo(); } },
    replay: () => { const p = player.current; if (p && p.seekTo) { p.seekTo(start, true); p.setPlaybackRate(rate); p.playVideo(); } },
    pause: () => { const p = player.current; if (p && p.pauseVideo) p.pauseVideo(); },
    time: () => { const p = player.current; return p && p.getCurrentTime ? p.getCurrentTime() : 0; },
  };
  if (apiRef) apiRef.current = api;

  return (
    <div className={'yt' + (free ? ' yt-free' : '') + ' yt-' + state}>
      <div className="yt-frame" ref={holder} />
      {!free && state !== 'error' && (
        <button type="button" className="yt-cover" aria-label={state === 'playing' ? 'Pause' : 'Play'}
          onClick={() => (state === 'playing' ? api.pause() : api.play())}>
          {state !== 'playing' && <span className="yt-play">{state === 'loading' ? <span className="spinner" /> : <Ic.Play width="26" height="26" />}</span>}
        </button>
      )}
      {!free && state !== 'error' && (
        <div className="yt-bar">
          <span className="yt-time">{lwFormatTime(Math.min(pos, len)).replace(/\.\d$/, '')} / {lwFormatTime(len).replace(/\.\d$/, '')}</span>
          <span className="yt-track"><span className="yt-fill" style={{ width: Math.min(100, (pos / len) * 100) + '%' }} /></span>
        </div>
      )}
      {overlay && state !== 'error' && <div className="yt-overlay">{overlay}</div>}
      {state === 'error' && <div className="yt-error"><Ic.CloudOff width="22" height="22" /><span>This clip is unavailable.</span></div>}
    </div>
  );
}

Object.assign(window, { lwParseYouTube, lwParseTime, lwFormatTime, YouTubeClip, VoicePicker, Marked, LessonBody, LessonForm, lwUnmark, CollocForm, Ic, PhotoFill, Flashcard, FillCard, GroupChip, ActionsMenu, Modal, WordForm, ImportView, lwLeafGroups, lwParseImportLine, lwBlankSentence, SpeakButton, GeminiKeyModal, WeekChart, PronunciationCheck, lwCanRecognize, lwMatchSpoken });
