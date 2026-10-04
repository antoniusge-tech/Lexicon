/* reading.jsx — pure text helpers for the reader (no React, no Firestore):
   Gutenberg cleanup, chapter/page splitting, sentences, tokens, word matching. */

/* Strip the Project Gutenberg header/licence and footer, normalise line breaks. */
function lwCleanGutenberg(raw) {
  let t = String(raw || '').replace(/\r\n?/g, '\n').replace(/﻿/g, '');
  const start = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG E-?BOOK[^\n]*\*\*\*/i);
  if (start !== -1) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG E-?BOOK/i);
  if (end !== -1) t = t.slice(0, end);
  return t.trim();
}

/* Letters of the languages we teach: ASCII plus Latin-1 and Latin Extended-A/B,
   which cover Romanian ă â î ș ț (and the older cedilla forms ş ţ). */
const LW_LETTERS = 'A-Za-zÀ-ÖØ-öø-ɏ';
/* Romanian has two spellings of ș/ț (comma and the legacy cedilla): compare as one */
const lwNormLetters = (s) => String(s).replace(/ş/g, 'ș').replace(/ţ/g, 'ț').replace(/Ş/g, 'Ș').replace(/Ţ/g, 'Ț');

const lwWordCount = (s) => (String(s).match(new RegExp('[' + LW_LETTERS + '0-9’\']+', 'g')) || []).length;

/* blank-line separated paragraphs; hard-wrapped lines inside are joined.
   Drops illustration placeholders ("[Illustration]", "[Picture: …]") and
   Gutenberg's _italic_ underscores. */
function lwParagraphs(text) {
  return String(text).split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
    .map((p) => p.replace(/\[(?:Illustration|Picture)[^\]]*\]/gi, '').replace(/(^|[\s(“"'‘])_([^_]+)_(?=[\s.,;:!?)”"'’]|$)/g, '$1$2').trim())
    .filter((p) => p && !/^[*\s]+$/.test(p));
}

/* Chapter headings. Numbered: "CHAPTER I", "Chapter 12. The End", "Book II";
   roman (case-sensitive, with a dot): "I. A SCANDAL IN BOHEMIA", "XIV.". As a
   fallback, the titles listed in the book's own table of contents
   ("The Happy Prince ....... 1") wherever they appear alone on a line. */
const LW_NUMBERED_RE = /^(?:chapter|book|part|capitolul|capitol|cartea|partea)\s+(?:[ivxlcdm]+|\d+|[a-z]+)\b/i;
const LW_ROMAN_RE = /^([IVXLC]+)\.(?:\s+([A-ZĂÂÎȘȚŞŢ][A-ZĂÂÎȘȚŞŢ0-9’' ,.:;!?-]*))?$/;
const LW_CHUNK_WORDS = 1500;

const lwShortLine = (p) => p.length <= 80 && lwWordCount(p) <= 12;
const lwIsNumberedHeading = (p) => lwShortLine(p) && (LW_NUMBERED_RE.test(p) || LW_ROMAN_RE.test(p));
const lwNormTitle = (t) => t.toLowerCase().replace(new RegExp('[^' + LW_LETTERS + '0-9’\' ]', 'g'), '').replace(/\s+/g, ' ').trim();

/* titles from a table of contents: lines "Title   12" (title, gap, page number) */
function lwTocTitles(text) {
  const titles = new Set();
  String(text).split('\n').forEach((line) => {
    const m = line.match(/^\s*(.{3,70}?)\s{2,}(?:\.+\s*)?(\d{1,4})\s*$/);
    if (m && new RegExp('[' + LW_LETTERS + ']').test(m[1])) titles.add(lwNormTitle(m[1]));
  });
  return titles;
}

/* Split a text into chapters [{ title, paragraphs }]. Uses headings when there
   are at least two; tiny "chapters" made only of short lines (a table of
   contents) are dropped, other tiny ones merge into the next chapter. A bare
   roman section ("II.") inside a titled story becomes "Story title · II".
   Without headings the text is cut into ~1500-word parts at paragraph
   boundaries. dropFrontMatter: drop a short untitled lead-in (Gutenberg title page). */
function lwSplitChapters(text, { dropFrontMatter = false } = {}) {
  const paras = lwParagraphs(text);
  let isHeading = lwIsNumberedHeading;
  if (paras.filter(isHeading).length < 2) {
    const toc = lwTocTitles(text);
    isHeading = (p) => lwShortLine(p) && toc.has(lwNormTitle(p));
  }
  const headingCount = paras.filter(isHeading).length;

  let chapters = [];
  if (headingCount >= 2) {
    let cur = { title: '', paragraphs: [] };
    let story = '';
    paras.forEach((p) => {
      if (isHeading(p)) {
        if (cur.title || cur.paragraphs.length) chapters.push(cur);
        const roman = p.match(LW_ROMAN_RE);
        let title = p;
        if (roman && !roman[2] && story) title = story + ' · ' + roman[1];
        else if (roman && roman[2]) { story = roman[2].trim(); title = story; }
        else story = '';
        cur = { title, paragraphs: [] };
      } else {
        cur.paragraphs.push(p);
      }
    });
    chapters.push(cur);
    const merged = [];
    let carry = [];
    chapters.forEach((c) => {
      const words = c.paragraphs.reduce((n, p) => n + lwWordCount(p), 0);
      const looksLikeToc = c.paragraphs.every((p) => lwWordCount(p) < 12);
      if (words < 80 && looksLikeToc) return; // table of contents, title page bits
      if (words < 80) { carry = carry.concat(c.paragraphs); return; }
      merged.push({ title: c.title, paragraphs: carry.concat(c.paragraphs) });
      carry = [];
    });
    if (carry.length && merged.length) merged[merged.length - 1].paragraphs.push(...carry);
    chapters = merged;
    if (dropFrontMatter && chapters.length > 1 && !chapters[0].title
      && chapters[0].paragraphs.reduce((n, p) => n + lwWordCount(p), 0) < 300) chapters.shift();
  }

  if (chapters.length < 2) {
    chapters = [];
    let cur = [];
    let n = 0;
    paras.forEach((p) => {
      cur.push(p);
      n += lwWordCount(p);
      if (n >= LW_CHUNK_WORDS) { chapters.push(cur); cur = []; n = 0; }
    });
    if (cur.length) chapters.push(cur);
    chapters = chapters.map((ps, i) => ({ title: chapters.length > 1 ? 'Part ' + (i + 1) : '', paragraphs: ps }));
  }
  return chapters.filter((c) => c.paragraphs.length);
}

/* abbreviations that end with a dot but don't end a sentence */
const LW_ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Capt|Col|Gen|Lt|Mt|vs|etc|e\.g|i\.e|No)|\b[A-Z])\.$/;

function lwSplitSentences(paragraph) {
  const raw = String(paragraph).match(/[^.!?]+(?:[.!?]+["'’”)\]]*|$)\s*/g) || [String(paragraph)];
  const out = [];
  raw.forEach((piece) => {
    const prev = out[out.length - 1];
    if (prev && LW_ABBR.test(prev.trim())) out[out.length - 1] = prev + piece;
    else out.push(piece);
  });
  return out.map((s) => s.trim()).filter(Boolean);
}

/* Pages of ~size words: a page is a list of paragraphs; a very long paragraph is
   cut at sentence boundaries so a page never grows past ~1.6x the target. */
function lwPaginate(paragraphs, size = 250) {
  const pieces = [];
  paragraphs.forEach((p) => {
    if (lwWordCount(p) <= size * 1.6) { pieces.push(p); return; }
    let buf = '';
    lwSplitSentences(p).forEach((s) => {
      if (buf && lwWordCount(buf + ' ' + s) > size) { pieces.push(buf); buf = s; }
      else buf = buf ? buf + ' ' + s : s;
    });
    if (buf) pieces.push(buf);
  });
  const pages = [];
  let cur = [];
  let n = 0;
  pieces.forEach((p) => {
    const w = lwWordCount(p);
    if (cur.length && n + w > size * 1.3) { pages.push(cur); cur = []; n = 0; }
    cur.push(p);
    n += w;
  });
  if (cur.length) pages.push(cur);
  return pages;
}

/* "word" parts at odd indices, separators at even ones: ["", "Hello", ", ", "world", "!"] */
const LW_L = LW_LETTERS;
const LW_TOKEN_RE = new RegExp('([' + LW_L + '][' + LW_L + '’\'-]*[' + LW_L + ']|[' + LW_L + '])');
function lwTokenize(text) {
  return String(text).split(LW_TOKEN_RE);
}

/* Romanian: strip definite articles, case and plural endings and common verb
   endings (casa/casei/casele → cas, lucrează → lucr), longest first, keeping
   at least three letters. Rough, like the English stemmer below. */
const LW_RO_ENDINGS = ['urilor', 'ilor', 'elor', 'ului', 'urile', 'ează', 'ește', 'esc', 'uri', 'ul', 'ele', 'lor', 'lui',
  'le', 'ii', 'ea', 'ua', 'ez', 'ăm', 'ați', 'at', 'it', 'ut', 'a', 'ă', 'e', 'i', 'u'];
function lwRoStem(w) {
  for (const e of LW_RO_ENDINGS) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}

/* reduce a token to a rough stem so grader↔graders, plan↔planning etc. match */
function readingStem(token) {
  let w = lwNormLetters(String(token || '').toLowerCase()).replace(/[’']/g, '');
  if (!w) return '';
  if (window.lwCurrentLang() === 'ro') return lwRoStem(w);
  /* strip common inflectional endings */
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ied')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 2 && w.endsWith('s')) w = w.slice(0, -1);
  /* undo consonant doubling (dig→digging, plan→planning) */
  if (w.length > 2 && /([bcdfghjklmnpqrstvwxz])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

/* two tokens match if they share a stem (either direction of inflection) */
function readingTokensMatch(a, b) {
  const la = lwNormLetters(String(a).toLowerCase()).replace(/[’']/g, '');
  const lb = lwNormLetters(String(b).toLowerCase()).replace(/[’']/g, '');
  if (la === lb) return true;
  const sa = readingStem(a);
  const sb = readingStem(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  /* handle silent-e: spade→spaded stems to "spad", base is "spade" */
  return sa === sb.replace(/e$/, '') || sb === sa.replace(/e$/, '');
}

/* Index of the user's single-word cards for instant lookup while reading:
   by exact lowercase form and by stem (silent-e variants too). */
function lwWordsIndex(words) {
  const idx = new Map();
  words.forEach((w) => {
    const lw = lwNormLetters(String(w.word || '').trim().toLowerCase());
    if (!lw || /\s/.test(lw)) return; // phrases are not matched token by token
    [lw, readingStem(lw), readingStem(lw).replace(/e$/, '')].forEach((k) => { if (k && !idx.has(k)) idx.set(k, w); });
  });
  return idx;
}

function lwMatchOwnWord(token, index) {
  const lw = lwNormLetters(String(token || '').toLowerCase()).replace(/[’]/g, "'");
  if (!lw) return null;
  const st = readingStem(lw);
  return index.get(lw) || index.get(st) || index.get(st.replace(/e$/, '')) || null;
}

/* ---------------- Collocations ---------------- */

const lwCollocKey = (word) => String(word || '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Phrase cards for a collocation word: multi-word cards with a token that
   matches the word (heavy → "heavy rain"; decision → "make a decision").
   Matching is by stem, so irregular forms (made → make) are not found. */
function lwFindPhraseCards(word, words) {
  const key = lwCollocKey(word);
  if (!key || /\s/.test(key)) return [];
  return words.filter((w) => {
    const text = String(w.word || '').trim();
    if (!/\s/.test(text)) return false;
    const tokens = lwTokenize(text).filter((_, i) => i % 2 === 1);
    return tokens.some((t) => readingTokensMatch(t, key));
  });
}

/* Default chip text for a phrase: the phrase without the main word and
   articles ("make a decision" + make → "decision"). */
const LW_COLLOC_SKIP = new Set(['a', 'an', 'the', 'un', 'o', 'niște']); // English and Romanian articles
function lwCollocPartner(phrase, word) {
  const key = lwCollocKey(word);
  const parts = String(phrase || '').trim().split(/\s+/).filter(Boolean);
  const rest = parts.filter((p) => {
    const t = p.toLowerCase().replace(new RegExp('[^' + LW_LETTERS + '’\'-]', 'g'), '');
    return !LW_COLLOC_SKIP.has(t) && !readingTokensMatch(t, key);
  });
  return (rest.length ? rest : parts).join(' ');
}

/* ---------------- Video clips ---------------- */

/* the user's card for a clip's word or phrase: same text (ignoring case and
   punctuation), or for a single word any form of it (got → get is not found) */
function lwFindCardForClip(clip, words) {
  const norm = (s) => lwNormLetters(String(s || '').toLowerCase()).replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const key = norm(clip.word);
  if (!key) return null;
  const exact = words.find((w) => norm(w.word) === key);
  if (exact || /\s/.test(key)) return exact || null;
  return words.find((w) => !/\s/.test(norm(w.word)) && readingTokensMatch(norm(w.word), key)) || null;
}

/* quote "Once you [[get the hang of it]], …" → parts for rendering */
function lwSplitQuote(quote) {
  const m = String(quote || '').match(/^(.*?)\[\[(.+?)\]\](.*)$/s);
  return m ? { before: m[1], target: m[2], after: m[3] } : { before: String(quote || ''), target: '', after: '' };
}

Object.assign(window, {
  lwFindCardForClip,
  lwSplitQuote,
  LW_LETTERS,
  lwNormLetters,
  lwCollocKey,
  lwFindPhraseCards,
  lwCollocPartner,
  lwCleanGutenberg,
  lwWordCount,
  lwParagraphs,
  lwSplitChapters,
  lwSplitSentences,
  lwPaginate,
  lwTokenize,
  readingStem,
  readingTokensMatch,
  lwWordsIndex,
  lwMatchOwnWord,
});
