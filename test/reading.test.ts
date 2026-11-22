import { afterEach, describe, expect, it } from 'vitest';
import { lwSetCurrentLang } from '../data.js';
import {
  lwCleanGutenberg, lwCollocPartner, lwFindCardForClip, lwFindPhraseCards, lwMatchOwnWord,
  lwNormLetters, lwPaginate, lwParagraphs, lwSplitChapters, lwSplitQuote, lwSplitSentences,
  lwTokenize, lwWordCount, lwWordsIndex, readingTokensMatch,
} from '../reading.ts';

afterEach(() => lwSetCurrentLang('en'));

const words = (n: number, w = 'word') => Array(n).fill(w).join(' ') + '.';

describe('text cleanup', () => {
  it('strips the Gutenberg header and footer', () => {
    const raw = 'Licence blah\r\n*** START OF THE PROJECT GUTENBERG EBOOK ALICE ***\r\nOnce upon a time.\r\n*** END OF THE PROJECT GUTENBERG EBOOK ALICE ***\r\nmore licence';
    expect(lwCleanGutenberg(raw)).toBe('Once upon a time.');
  });

  it('joins wrapped lines, drops illustrations and _italic_ marks', () => {
    expect(lwParagraphs('One line\nwraps here.\n\n[Illustration: a cat]\n\nShe was _very_ tired.\n\n* * *'))
      .toEqual(['One line wraps here.', 'She was very tired.']);
  });

  it('counts words with apostrophes and Romanian letters', () => {
    expect(lwWordCount("Don't stop — mâine ședința!")).toBe(4);
  });

  it('treats the cedilla ş/ţ as comma ș/ț', () => {
    expect(lwNormLetters('Şcoală ţară')).toBe('Școală țară');
  });
});

describe('chapters and pages', () => {
  it('splits on numbered headings and drops a table of contents', () => {
    const text = ['CONTENTS', 'Chapter I', 'Chapter II', 'CHAPTER I. The Start', words(100), 'CHAPTER II. The End', words(100)].join('\n\n');
    const ch = lwSplitChapters(text);
    expect(ch.map((c) => c.title)).toEqual(['CHAPTER I. The Start', 'CHAPTER II. The End']);
  });

  it('names a bare roman section after its story', () => {
    const text = ['I. THE FIRST STORY', words(100), 'II.', words(100)].join('\n\n');
    expect(lwSplitChapters(text).map((c) => c.title)).toEqual(['THE FIRST STORY', 'THE FIRST STORY · II']);
  });

  it('without headings cuts ~1500-word parts at paragraph boundaries', () => {
    const text = [...Array(8)].map(() => words(400)).join('\n\n');
    const ch = lwSplitChapters(text);
    expect(ch.map((c) => c.title)).toEqual(['Part 1', 'Part 2']); // 4 × 400 words reach 1500
    expect(ch.map((c) => c.paragraphs.length)).toEqual([4, 4]);
  });

  it('a short text is one untitled chapter', () => {
    expect(lwSplitChapters('Just one paragraph.')).toEqual([{ title: '', paragraphs: ['Just one paragraph.'] }]);
  });

  it('pages hold ~size words and cut long paragraphs at sentences', () => {
    expect(lwPaginate([words(100), words(100), words(100)], 250).map((p) => p.length)).toEqual([3]); // up to 1.3 × size
    expect(lwPaginate([words(120), words(120), words(120)], 250).map((p) => p.length)).toEqual([2, 1]);
    const long = [...Array(50)].map(() => 'This is a short sentence.').join(' '); // 250 words
    const pages = lwPaginate([long], 100);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((pg) => pg.forEach((p) => expect(lwWordCount(p)).toBeLessThanOrEqual(160)));
  });

  it('sentences do not end at abbreviations', () => {
    expect(lwSplitSentences('Mr. Smith came home. He was tired! Was he?'))
      .toEqual(['Mr. Smith came home.', 'He was tired!', 'Was he?']);
  });
});

describe('tokens and matching', () => {
  it('puts words at odd indices and separators at even ones', () => {
    expect(lwTokenize('Hello, world!')).toEqual(['', 'Hello', ', ', 'world', '!']);
    expect(lwTokenize("don't")).toEqual(['', "don't", '']);
  });

  it('English: matches inflected forms by stem, not irregular ones', () => {
    const yes = [['plan', 'planning'], ['study', 'studies'], ['grader', 'graders'], ['spade', 'spaded'], ['dig', 'digging'], ['Box', 'boxes']];
    yes.forEach(([a, b]) => expect(readingTokensMatch(a, b), a + ' ~ ' + b).toBe(true));
    expect(readingTokensMatch('take', 'took')).toBe(false);
    expect(readingTokensMatch('cat', 'dog')).toBe(false);
  });

  it('Romanian: strips articles and endings, and ignores cedilla spelling', () => {
    lwSetCurrentLang('ro');
    [['casa', 'casei'], ['casă', 'casele'], ['lucra', 'lucrează'], ['școala', 'şcoala']]
      .forEach(([a, b]) => expect(readingTokensMatch(a, b), a + ' ~ ' + b).toBe(true));
  });

  it('finds the user card for a tapped token, skipping phrase cards', () => {
    const cards = [{ id: '1', word: 'decide' }, { id: '2', word: 'run' }, { id: '3', word: 'make a decision' }];
    const idx = lwWordsIndex(cards);
    expect(lwMatchOwnWord('Decided', idx)?.id).toBe('1');
    expect(lwMatchOwnWord('running', idx)?.id).toBe('2');
    expect(lwMatchOwnWord('decision', idx)).toBeNull();
  });
});

describe('collocations and clips', () => {
  const cards = [{ id: '1', word: 'make a decision' }, { id: '2', word: 'heavy rain' }, { id: '3', word: 'decision' }];

  it('finds phrase cards that contain the word', () => {
    expect(lwFindPhraseCards('decision', cards).map((w) => w.id)).toEqual(['1']);
    expect(lwFindPhraseCards('make a', cards)).toEqual([]);
  });

  it('chip text is the phrase without the word and articles', () => {
    expect(lwCollocPartner('make a decision', 'make')).toBe('decision');
    expect(lwCollocPartner('heavy rain', 'rain')).toBe('heavy');
  });

  it('finds the card for a clip: exact phrase, or any form of a single word', () => {
    expect(lwFindCardForClip({ word: 'Heavy rain!' }, cards)?.id).toBe('2');
    expect(lwFindCardForClip({ word: 'decisions' }, cards)?.id).toBe('3');
    expect(lwFindCardForClip({ word: 'light rain' }, cards)).toBeNull();
  });

  it('splits a quote around [[the target]]', () => {
    expect(lwSplitQuote('Once you [[get the hang of it]], go.')).toEqual({ before: 'Once you ', target: 'get the hang of it', after: ', go.' });
    expect(lwSplitQuote('no mark')).toEqual({ before: 'no mark', target: '', after: '' });
  });
});
