/* data.jsx — local (per-device) keys + helpers for AppLearnWords */

const LW_KEYS = {
  theme: 'lw_theme_v1',
  selected: 'lw_selected_groups_v1',
  direction: 'lw_study_direction_v1',
  studySession: 'lw_study_session_v1',
  geminiKey: 'lw_gemini_key_v1', // личный API-ключ Gemini пользователя (только его устройство)
  nav: 'lw_nav_v1', // {tab, learnMode} — last screen and Learn sub-mode
  library: 'lw_library_v1', // {view, status, groupId, sort} — Library filters
  wotd: 'lw_word_of_day_v1', // {date, wordId} — keeps the word of the day stable all day
  readerGroup: 'lw_reader_group_v1', // group that "+ Add to cards" in the reader puts words into
  trCache: 'lw_reader_tr_v1', // {key: [ru sentences]} — paragraph translations, newest last
  grammar: 'lw_grammar_v1', // {level, saved} — Grammar list filters
  voice: 'lw_voice_v1', // {voiceURI, rate} — speech voice for this device ('' = auto)
  reading: 'lw_reading_cards_v1', // последняя пачка сгенерированных текстов-карточек
};

/* Сколько текстов-карточек генерировать за один прогон в разделе Reading.
   Держим небольшим (3 запроса к Gemini за раз), чтобы не выедать дневную квоту
   бесплатного тира. Когда пользователь прочитал все тексты пачки, он сам
   запрашивает новую генерацию (автодогрузки нет). */
const LW_READING_BATCH = 3;

/* Languages a user can learn. Every content doc (group, word, collocation,
   text, lesson) carries `lang`; docs without it predate languages and are English.
   ru* are the Russian forms used in Gemini prompts; speech is the BCP-47 tag for
   speech synthesis/recognition; wiki is the Wikipedia edition for photo lookup. */
const LW_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧', speech: 'en-US', wiki: 'en',
    ru: 'английский', ruGen: 'английского', ruGenPl: 'английских', ruPrep: 'английском',
    sample: 'Hello! This is how your English words will sound.',
    ex: { word: 'journey', example: 'We went on a long journey.',
      import: 'journey | /ˈdʒɜː.ni/ | путешествие | We went on a long journey. | Мы отправились в долгое путешествие.\nbook || книга' } },
  { code: 'ro', name: 'Romanian', native: 'Română', flag: '🇷🇴', speech: 'ro-RO', wiki: 'ro',
    ru: 'румынский', ruGen: 'румынского', ruGenPl: 'румынских', ruPrep: 'румынском',
    sample: 'Bună ziua! Așa vor suna cuvintele tale în română.',
    ex: { word: 'călătorie', example: 'Am făcut o călătorie lungă.',
      import: 'călătorie | /kə.lə.toˈri.e/ | путешествие | Am făcut o călătorie lungă. | Мы совершили долгое путешествие.\ncarte || книга' } },
];
const LW_LANG_CODES = LW_LANGUAGES.map((l) => l.code);

/* the language of a content doc (legacy docs have none: English) */
const lwDocLang = (d) => (d && d.lang) || 'en';

/* the languages a user learns, from their profile: `langs` (newer accounts) or
   the single legacy `lang`; unsupported codes are dropped */
function lwUserLangs(user) {
  const list = user && Array.isArray(user.langs) ? user.langs : (user && user.lang ? [user.lang] : []);
  return LW_LANG_CODES.filter((c) => list.includes(c));
}

/* The language currently studied. App sets it from the profile before rendering,
   so AI prompts, speech and new docs (lwSetDoc) follow it without passing it around. */
let lwLangCode = 'en';
function lwSetCurrentLang(code) { lwLangCode = LW_LANG_CODES.includes(code) ? code : 'en'; }
function lwCurrentLang() { return lwLangCode; }
function lwLangInfo(code) { return LW_LANGUAGES.find((l) => l.code === (code || lwLangCode)) || LW_LANGUAGES[0]; }

/* Self-assessed CEFR level and target are per language: English keeps the
   original cefr/cefrTarget fields, others use cefr_<code>/cefrTarget_<code>. */
const lwCefrField = (lang, target) => (target ? 'cefrTarget' : 'cefr') + (lang === 'en' ? '' : '_' + lang);

const lwUid = () => Math.random().toString(36).slice(2, 9);

/* Parts of speech a word can be tagged with (words[].pos). */
const LW_POS = ['noun', 'verb', 'adjective', 'adverb', 'phrasal verb', 'phrase', 'idiom', 'other'];
function lwNormPos(v) {
  const p = String(v || '').trim().toLowerCase();
  return LW_POS.includes(p) ? p : '';
}

function lwLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function lwSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* ignore quota errors in prototype */
  }
}

const LW_PHOTO_MAX = 640;

/* Resize/compress an image (File or Blob) into a JPEG data URL, longest side <= max.
   square: center-crop to a max×max square first (avatars). */
function lwFileToPhoto(file, max = LW_PHOTO_MAX, square = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        let { width, height } = img;
        const canvas = document.createElement('canvas');
        if (square) {
          const side = Math.min(width, height);
          const out = Math.min(side, max);
          canvas.width = out;
          canvas.height = out;
          canvas.getContext('2d').drawImage(img, (width - side) / 2, (height - side) / 2, side, side, 0, 0, out, out);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
          return;
        }
        if (width > max || height > max) {
          if (width >= height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Try to auto-find a photo for a word via Openverse search (no API key, CORS-enabled, broad CC image index) */
async function lwAutoFindPhotoOpenverse(term) {
  const url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(term)
    + '&page_size=1&mature=false';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data && data.results && data.results[0];
  const src = result && (result.thumbnail || result.url);
  if (!src) return null;
  const imgRes = await fetch(src);
  if (!imgRes.ok) return null;
  const blob = await imgRes.blob();
  return lwFileToPhoto(blob);
}

/* Fallback: Wikipedia's REST summary API (no API key, CORS-enabled) */
async function lwAutoFindPhotoWikipedia(term) {
  const res = await fetch('https://' + lwLangInfo().wiki + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(term), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const src = data && data.thumbnail && data.thumbnail.source;
  if (!src) return null;
  const imgRes = await fetch(src);
  if (!imgRes.ok) return null;
  const blob = await imgRes.blob();
  return lwFileToPhoto(blob);
}

async function lwAutoFindPhoto(word) {
  const term = (word || '').trim();
  if (!term) return null;
  try {
    const photo = await lwAutoFindPhotoOpenverse(term);
    if (photo) return photo;
  } catch (e) {
    /* fall through to Wikipedia */
  }
  try {
    return await lwAutoFindPhotoWikipedia(term);
  } catch (e) {
    return null;
  }
}

/* ---------------- AI: заполнение карточки через Gemini ----------------
   Каждый пользователь вводит СВОЙ бесплатный ключ Gemini; он хранится только
   в его браузере (localStorage) и тратит только его лимиты. Вызов идёт напрямую
   из браузера — безопасно, потому что ключ принадлежит самому пользователю. */

const LW_GEMINI_MODEL = 'gemini-flash-latest'; // алиас на актуальную flash-модель (бесплатный тир, быстрый)

function lwGetGeminiKey() {
  return (lwLoad(LW_KEYS.geminiKey, '') || '').trim();
}
function lwSetGeminiKey(key) {
  const k = (key || '').trim();
  if (k) lwSave(LW_KEYS.geminiKey, k);
  else localStorage.removeItem(LW_KEYS.geminiKey);
}
function lwHasGeminiKey() {
  return !!lwGetGeminiKey();
}

/* Заполнить карточку слова: перевод, транскрипция, пример. Бросает Error с
   .code = 'no-key' | 'bad-key' | 'quota' | 'refusal' | 'network' для UI. */
async function lwAiFillWord(word) {
  const term = (word || '').trim().slice(0, 100);
  if (!term) { const e = new Error('Empty word.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('No Gemini key set.'); e.code = 'no-key'; throw e; }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — лексикограф для приложения изучения ' + lwLangInfo().ruGen + ' языка. '
          + 'Для заданного ' + lwLangInfo().ruGen + ' слова верни: '
          + 'ipa — транскрипцию IPA (без косых черт); '
          + 'tr — краткий перевод на русский (1–3 варианта через запятую, как в Cambridge Dictionary); '
          + 'example — запоминающееся простое предложение-пример с этим словом на ' + lwLangInfo().ruPrep + '; '
          + 'exampleTr — перевод примера на русский; '
          + 'pos — часть речи по-английски, одно из: ' + LW_POS.join(', ') + '.',
      }],
    },
    contents: [{ role: 'user', parts: [{ text: 'Слово: ' + term }] }],
    generationConfig: {
      // Structured output: модель обязана вернуть валидный JSON нужной формы.
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          ipa: { type: 'STRING' },
          tr: { type: 'STRING' },
          example: { type: 'STRING' },
          exampleTr: { type: 'STRING' },
          pos: { type: 'STRING', enum: LW_POS },
        },
        required: ['ipa', 'tr', 'example', 'exampleTr', 'pos'],
      },
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error('Cannot reach Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    // 400 при неверном ключе, 429 при исчерпании бесплатного лимита.
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Invalid Gemini key.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Daily Gemini limit reached. Try again later.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Gemini is overloaded. Try again in a minute.'); e.code = 'overload'; throw e;
    }
    const e = new Error('AI service error (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('The model refused the request.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Empty AI response.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI returned an invalid response.'); err.code = 'refusal'; throw err; }

  return {
    ipa: String(parsed.ipa || '').trim(),
    tr: String(parsed.tr || '').trim(),
    example: String(parsed.example || '').trim(),
    exampleTr: String(parsed.exampleTr || '').trim(),
    pos: lwNormPos(parsed.pos),
  };
}

/* Пакетное заполнение: на входе массив английских слов, на выходе массив
   объектов { word, ipa, tr, example, exampleTr } в том же порядке. Слово в
   ответе позволяет сопоставить строки, даже если модель что-то пропустит.
   Бросает Error с теми же .code, что и lwAiFillWord. */
async function lwAiFillWords(words) {
  const list = (words || [])
    .map((w) => String(w || '').trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 100); // разумный потолок на один запрос
  if (!list.length) { const e = new Error('No words to process.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('No Gemini key set.'); e.code = 'no-key'; throw e; }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — лексикограф для приложения изучения ' + lwLangInfo().ruGen + ' языка. '
          + 'Тебе дают список ' + lwLangInfo().ruGenPl + ' слов. Для КАЖДОГО слова верни объект: '
          + 'word — само слово (как в запросе). '
          + 'ВАЖНО: слово пиши строчными буквами (нижний регистр), '
          + 'заглавную первую букву оставляй ТОЛЬКО у имён собственных — '
          + 'названий городов, стран, имён людей и т.п.; '
          + 'ipa — транскрипцию IPA (без косых черт); '
          + 'tr — краткий перевод на русский (1–3 варианта через запятую, как в Cambridge Dictionary); '
          + 'example — запоминающееся простое предложение-пример с этим словом на ' + lwLangInfo().ruPrep + '; '
          + 'exampleTr — перевод примера на русский; '
          + 'pos — часть речи по-английски, одно из: ' + LW_POS.join(', ') + '. '
          + 'Верни объекты в том же порядке и количестве, что и входной список.',
      }],
    },
    contents: [{ role: 'user', parts: [{ text: 'Слова:\n' + list.join('\n') }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            ipa: { type: 'STRING' },
            tr: { type: 'STRING' },
            example: { type: 'STRING' },
            exampleTr: { type: 'STRING' },
            pos: { type: 'STRING', enum: LW_POS },
          },
          required: ['word', 'ipa', 'tr', 'example', 'exampleTr', 'pos'],
        },
      },
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error('Cannot reach Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Invalid Gemini key.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Daily Gemini limit reached. Try again later.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Gemini is overloaded. Try again in a minute.'); e.code = 'overload'; throw e;
    }
    const e = new Error('AI service error (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('The model refused the request.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Empty AI response.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI returned an invalid response.'); err.code = 'refusal'; throw err; }
  if (!Array.isArray(parsed)) { const e = new Error('AI returned an invalid response.'); e.code = 'refusal'; throw e; }

  // Множество входных слов, которые пользователь ввёл строчными, — они точно не
  // имена собственные, и капитализировать их ответ модели нельзя.
  const lowerInputs = new Set(
    list.filter((w) => w && w[0] === w[0].toLowerCase()).map((w) => w.toLowerCase())
  );
  return parsed.map((p, i) => {
    let word = String((p && p.word) || list[i] || '').trim();
    // Модель порой капитализирует обычные слова. Если это же слово во входе было
    // строчным (по индексу или по совпадению без учёта регистра) — понижаем
    // первую букву. Слова, которые пользователь сам ввёл с заглавной (имена,
    // города), не трогаем.
    const src = String(list[i] || '').trim();
    const srcLower = !src || src[0] === src[0].toLowerCase();
    if (word && (srcLower || lowerInputs.has(word.toLowerCase()))) {
      word = word[0].toLowerCase() + word.slice(1);
    }
    return {
      word,
      ipa: String((p && p.ipa) || '').trim(),
      tr: String((p && p.tr) || '').trim(),
      example: String((p && p.example) || '').trim(),
      exampleTr: String((p && p.exampleTr) || '').trim(),
      pos: lwNormPos(p && p.pos),
    };
  }).filter((r) => r.word);
}

/* One structured-output Gemini call: system prompt + user text -> parsed JSON
   matching `schema`. Throws Error with .code 'no-key' | 'bad-key' | 'quota' |
   'overload' | 'refusal' | 'network', like lwAiFillWord. */
async function lwGeminiJson(systemText, userText, schema) {
  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('No Gemini key set.'); e.code = 'no-key'; throw e; }
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
  };
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    const err = new Error('Cannot reach Gemini.'); err.code = 'network'; throw err;
  }
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) { const e = new Error('Invalid Gemini key.'); e.code = 'bad-key'; throw e; }
    if (res.status === 429) { const e = new Error('Daily Gemini limit reached. Try again later.'); e.code = 'quota'; throw e; }
    if (res.status === 503 || res.status === 500) { const e = new Error('Gemini is overloaded. Try again in a minute.'); e.code = 'overload'; throw e; }
    const e = new Error('AI service error (' + res.status + ').'); e.code = 'network'; throw e;
  }
  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('The model refused the request.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Empty AI response.'); e.code = 'refusal'; throw e; }
  try { return JSON.parse(text); }
  catch (e) { const err = new Error('AI returned an invalid response.'); err.code = 'refusal'; throw err; }
}

/* Tag existing words with a part of speech only (cheaper than a full fill).
   words: up to 50 English words; returns [{ word, pos }] in the same order. */
async function lwAiTagPos(words) {
  const list = (words || []).map((w) => String(w || '').trim().slice(0, 100)).filter(Boolean).slice(0, 50);
  if (!list.length) { const e = new Error('No words to process.'); e.code = 'empty'; throw e; }
  const parsed = await lwGeminiJson(
    'You tag ' + lwLangInfo().name + ' vocabulary with its most common part of speech. '
      + 'For EVERY input word or phrase return { word, pos }, where word is the input as given and pos is one of: '
      + LW_POS.join(', ') + '. Keep the input order and count.',
    list.join('\n'),
    {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { word: { type: 'STRING' }, pos: { type: 'STRING', enum: LW_POS } },
        required: ['word', 'pos'],
      },
    }
  );
  if (!Array.isArray(parsed)) { const e = new Error('AI returned an invalid response.'); e.code = 'refusal'; throw e; }
  return parsed.map((p, i) => ({ word: String((p && p.word) || list[i] || '').trim(), pos: lwNormPos(p && p.pos) }))
    .filter((r) => r.word && r.pos);
}

/* A word tapped while reading: its dictionary form and the meaning it has in
   this sentence, plus the sentence's translation (it becomes the card's example). */
async function lwAiLookupWord(word, sentence) {
  const term = String(word || '').trim().slice(0, 60);
  if (!term) { const e = new Error('Empty word.'); e.code = 'empty'; throw e; }
  const p = await lwGeminiJson(
    'Ты — словарь для читателя ' + lwLangInfo().ruGenPl + ' книг. Тебе дают слово и предложение, где оно встретилось. Верни: '
      + (lwCurrentLang() === 'en'
        ? 'lemma — словарную форму слова (was → be, children → child; фразовый глагол, если он есть в предложении, например "give up"); '
        : 'lemma — словарную форму слова (для существительного — неопределённая форма единственного числа, для глагола — инфинитив без частицы); ')
      + 'ipa — транскрипцию IPA словарной формы без косых черт; '
      + 'pos — часть речи по-английски, одно из: ' + LW_POS.join(', ') + '; '
      + 'tr — перевод на русский именно в ЭТОМ значении (1–3 варианта через запятую); '
      + 'sentenceTr — перевод всего предложения на русский.',
    'Слово: ' + term + '\nПредложение: ' + String(sentence || '').slice(0, 600),
    {
      type: 'OBJECT',
      properties: {
        lemma: { type: 'STRING' }, ipa: { type: 'STRING' }, pos: { type: 'STRING', enum: LW_POS },
        tr: { type: 'STRING' }, sentenceTr: { type: 'STRING' },
      },
      required: ['lemma', 'ipa', 'pos', 'tr', 'sentenceTr'],
    }
  );
  return {
    lemma: String(p.lemma || term).trim(),
    ipa: String(p.ipa || '').trim(),
    pos: lwNormPos(p.pos),
    tr: String(p.tr || '').trim(),
    sentenceTr: String(p.sentenceTr || '').trim(),
  };
}

/* Translate a paragraph sentence by sentence: returns one Russian line per input sentence. */
async function lwAiTranslateSentences(sentences) {
  const list = (sentences || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 60);
  if (!list.length) return [];
  const p = await lwGeminiJson(
    'Переведи на русский каждое предложение на ' + lwLangInfo().ruPrep + ' — литературно, но близко к тексту. '
      + 'Верни массив переводов той же длины и в том же порядке, по одному на предложение.',
    list.map((x, i) => (i + 1) + '. ' + x).join('\n'),
    { type: 'ARRAY', items: { type: 'STRING' } }
  );
  if (!Array.isArray(p)) { const e = new Error('AI returned an invalid response.'); e.code = 'refusal'; throw e; }
  return list.map((_, i) => String(p[i] || '').trim());
}

/* Collocations for one word: new phrases (not in `existing`) plus wrong partners
   that learners typically use, with the right combination. Phrases become
   ordinary word cards once the user ticks them. */
async function lwAiSuggestCollocations(word, existing) {
  const term = String(word || '').trim().slice(0, 60);
  if (!term) { const e = new Error('Empty word.'); e.code = 'empty'; throw e; }
  const have = (existing || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30);
  const p = await lwGeminiJson(
    'Ты — преподаватель ' + lwLangInfo().ruGen + ' языка, составляешь упражнение на коллокации (устойчивые сочетания слов). '
      + 'Все сочетания, партнёры и примеры — на ' + lwLangInfo().ruPrep + '. '
      + 'Для данного ' + lwLangInfo().ruGen + ' слова верни: '
      + 'pos — часть речи слова, одно из: ' + LW_POS.join(', ') + '; '
      + 'pattern — схему сочетаний, например "heavy + noun" или "make + noun" (названия частей речи — по-английски); '
      + 'phrases — 6 самых частотных нейтральных сочетаний с этим словом (кроме уже имеющихся), для каждого: '
      + 'phrase — сочетание в словарной форме ("make a decision", "heavy rain"); '
      + 'partner — часть сочетания без самого слова и без артиклей ("decision", "rain"); '
      + 'tr — перевод сочетания на русский; ipa — транскрипция IPA всего сочетания без косых черт; '
      + 'example — короткое естественное предложение с сочетанием; exampleTr — его перевод на русский; '
      + 'wrong — 3 ОДНОЗНАЧНО НЕВЕРНЫХ партнёра, с которыми ученики ошибочно сочетают это слово '
      + '(например, в английском для "make": "homework", потому что правильно "do homework"), для каждого: partner и fix — правильное сочетание. '
      + 'Неверный партнёр не должен образовывать с этим словом допустимое сочетание ни в каком значении.',
    'Слово: ' + term + (have.length ? '\nУже есть: ' + have.join('; ') : ''),
    {
      type: 'OBJECT',
      properties: {
        pos: { type: 'STRING', enum: LW_POS },
        pattern: { type: 'STRING' },
        phrases: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              phrase: { type: 'STRING' }, partner: { type: 'STRING' }, tr: { type: 'STRING' },
              ipa: { type: 'STRING' }, example: { type: 'STRING' }, exampleTr: { type: 'STRING' },
            },
            required: ['phrase', 'partner', 'tr', 'ipa', 'example', 'exampleTr'],
          },
        },
        wrong: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { partner: { type: 'STRING' }, fix: { type: 'STRING' } }, required: ['partner', 'fix'] },
        },
      },
      required: ['pos', 'pattern', 'phrases', 'wrong'],
    }
  );
  const clean = (x, n = 200) => String(x || '').trim().slice(0, n);
  const haveSet = new Set(have.map((x) => x.toLowerCase()));
  const seen = new Set();
  const phrases = (Array.isArray(p.phrases) ? p.phrases : []).map((x) => ({
    phrase: clean(x.phrase, 80), partner: clean(x.partner, 40), tr: clean(x.tr),
    ipa: clean(x.ipa, 80).replace(/^\/|\/$/g, ''), example: clean(x.example, 300), exampleTr: clean(x.exampleTr, 300),
  })).filter((x) => {
    const k = x.phrase.toLowerCase();
    if (!x.phrase || !x.partner || !x.tr || haveSet.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const wrong = (Array.isArray(p.wrong) ? p.wrong : []).map((x) => ({ partner: clean(x.partner, 40), fix: clean(x.fix, 80) }))
    .filter((x) => x.partner && x.fix);
  return { pos: lwNormPos(p.pos), pattern: clean(p.pattern, 60), phrases, wrong };
}

/* ---------------- Grammar lessons (AI) ---------------- */

const lwLessonSystem = () => 'Ты — методист, пишешь урок грамматики ' + lwLangInfo().ruGen + ' языка для русскоязычных учеников. '
  + 'Объяснения, переводы и пояснения — на русском; примеры, формулы и задания теста — на ' + lwLangInfo().ruPrep + '. '
  + 'Ключевые слова в тексте выделяй двойными квадратными скобками, например по-английски: "I [[have lost]] my keys". ';

const LW_TASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['choice', 'fill'] },
    q: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' } },
    answer: { type: 'INTEGER' },
    answers: { type: 'ARRAY', items: { type: 'STRING' } },
    why: { type: 'STRING' },
  },
  required: ['type', 'q', 'why'],
};
const LW_TASK_RULES = 'Задание теста: type "choice" — q с пропуском "___", ровно 4 варианта в options, answer — индекс верного (0–3); '
  + 'type "fill" — q с пропуском "___" и подсказкой в скобках (начальная форма слова), например по-английски "She ___ (finish) it yet.", answers — все допустимые варианты '
  + '(полная и краткая форма). why — короткое пояснение на русском, почему ответ верный. Ответ должен быть однозначным.';

const lwStr = (x, n = 600) => String(x == null ? '' : x).trim().slice(0, n);

/* a valid test task or null */
function lwNormTask(t) {
  if (!t || !lwStr(t.q)) return null;
  const base = { q: lwStr(t.q, 300), why: lwStr(t.why, 400) };
  if (t.type === 'fill') {
    const answers = (Array.isArray(t.answers) ? t.answers : []).map((x) => lwStr(x, 80)).filter(Boolean);
    return answers.length ? { type: 'fill', ...base, answers } : null;
  }
  const options = (Array.isArray(t.options) ? t.options : []).map((x) => lwStr(x, 80)).filter(Boolean).slice(0, 4);
  const answer = Number(t.answer);
  if (options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
  return { type: 'choice', ...base, options, answer };
}

/* A whole lesson: focus, formulas, comparison table, worked examples and a
   10-task test. Tasks that come back malformed are dropped — the editor then
   asks the admin to fill or regenerate the missing ones. */
async function lwAiGenerateLesson({ title, topic, level, compare }) {
  const subject = lwStr(title, 120) || lwStr(topic, 60);
  if (!subject) { const e = new Error('Enter a title or topic.'); e.code = 'empty'; throw e; }
  const p = await lwGeminiJson(
    lwLessonSystem() + 'Верни урок: title — название по-английски; focus — ключевая идея в 1–2 предложениях; '
      + 'minutes — время на изучение; formulas — 3 строки (kind: affirmative, negative, question; pattern — схема вроде "have/has + V3"; '
      + 'example — пример с выделением; tr — перевод); '
      + 'compareTable — rows: по одной строке на эту тему и на тему сравнения (title, tag — короткая метка на русском, '
      + 'markers — слова-маркеры, pattern, example), tip — главное правило различия; если сравнивать не с чем — сравни с самой частой ошибкой; '
      + 'examples — 3 разобранных предложения (sentence с выделением, tr, notes — пояснения к выделенным частям: part и text); '
      + 'quiz — ровно 10 заданий, 6 choice и 4 fill, вперемешку. ' + LW_TASK_RULES,
    'Тема урока: ' + subject + (topic ? '\nРаздел: ' + lwStr(topic, 60) : '') + '\nУровень: ' + (level || 'B1')
      + (compare ? '\nСравнить с: ' + lwStr(compare, 60) : ''),
    {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' }, focus: { type: 'STRING' }, minutes: { type: 'INTEGER' },
        formulas: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          kind: { type: 'STRING', enum: ['affirmative', 'negative', 'question'] }, pattern: { type: 'STRING' },
          example: { type: 'STRING' }, tr: { type: 'STRING' } }, required: ['kind', 'pattern', 'example', 'tr'] } },
        compareTable: { type: 'OBJECT', properties: {
          rows: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            title: { type: 'STRING' }, tag: { type: 'STRING' }, markers: { type: 'STRING' }, pattern: { type: 'STRING' }, example: { type: 'STRING' } },
            required: ['title', 'markers', 'pattern', 'example'] } },
          tip: { type: 'STRING' } }, required: ['rows', 'tip'] },
        examples: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          sentence: { type: 'STRING' }, tr: { type: 'STRING' },
          notes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { part: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['part', 'text'] } } },
          required: ['sentence', 'tr', 'notes'] } },
        quiz: { type: 'ARRAY', items: LW_TASK_SCHEMA },
      },
      required: ['title', 'focus', 'minutes', 'formulas', 'compareTable', 'examples', 'quiz'],
    }
  );
  const arr = (x) => (Array.isArray(x) ? x : []);
  return {
    title: lwStr(p.title, 120) || subject,
    focus: lwStr(p.focus),
    minutes: Math.min(60, Math.max(3, Number(p.minutes) || 10)),
    formulas: arr(p.formulas).map((f) => ({
      kind: ['affirmative', 'negative', 'question', 'rule'].includes(f.kind) ? f.kind : 'affirmative',
      pattern: lwStr(f.pattern, 80), example: lwStr(f.example, 200), tr: lwStr(f.tr, 300),
    })).filter((f) => f.pattern && f.example),
    compareTable: {
      rows: arr(p.compareTable && p.compareTable.rows).slice(0, 3).map((r) => ({
        title: lwStr(r.title, 60), tag: lwStr(r.tag, 40), markers: lwStr(r.markers, 200), pattern: lwStr(r.pattern, 80), example: lwStr(r.example, 200),
      })).filter((r) => r.title),
      tip: lwStr(p.compareTable && p.compareTable.tip, 300),
    },
    examples: arr(p.examples).map((x) => ({
      sentence: lwStr(x.sentence, 200), tr: lwStr(x.tr, 300),
      notes: arr(x.notes).map((n) => ({ part: lwStr(n.part, 60), text: lwStr(n.text, 200) })).filter((n) => n.part && n.text),
    })).filter((x) => x.sentence),
    quiz: arr(p.quiz).map(lwNormTask).filter(Boolean).slice(0, 10),
  };
}

/* one new test task for a lesson, different from the tasks it already has */
async function lwAiRegenerateTask(lesson, type) {
  const have = (lesson.quiz || []).map((t) => t && t.q).filter(Boolean);
  const p = await lwGeminiJson(
    lwLessonSystem() + 'Составь ОДНО новое задание теста к уроку, не похожее на уже имеющиеся. ' + LW_TASK_RULES,
    'Урок: ' + lwStr(lesson.title, 120) + '\nУровень: ' + (lesson.level || 'B1') + '\nТип задания: ' + (type === 'fill' ? 'fill' : 'choice')
      + (have.length ? '\nУже есть:\n' + have.join('\n') : ''),
    LW_TASK_SCHEMA
  );
  const t = lwNormTask({ ...p, type: type === 'fill' ? 'fill' : (p.type || 'choice') });
  if (!t) { const e = new Error('AI returned an invalid task.'); e.code = 'refusal'; throw e; }
  return t;
}

/* Word of the day: the same word all day, a different one tomorrow. Picks from
   the most useful pool that has words — due/learning first, then new, then
   mastered — using a hash of the date, so it needs no storage. */
function lwWordOfTheDay(words, progress, date, now) {
  if (!words.length) return null;
  const status = (w) => window.lwWordStatus(progress[w.id], now);
  const pools = [
    words.filter((w) => ['review', 'learning'].includes(status(w))),
    words.filter((w) => status(w) === 'new'),
    words,
  ];
  const pool = pools.find((p) => p.length).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/* ---------------- AI: генерация обучающего текста через Gemini ----------------
   На вход — список слов из категории, уровень CEFR (A2…C2), тема и желаемая
   длина. На выходе — короткий текст на английском, где эти слова использованы
   естественно, плюс его перевод на русский. Тот же клиентский путь и коды
   ошибок, что и у lwAiFillWord. */

const LW_CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'];

/* Темы для генерируемого текста. id — стабильный ключ, prompt — как описать
   тему модели. Первая тема считается темой по умолчанию. */
const LW_TEXT_TOPICS = [
  { id: 'daily-life', name: 'Everyday life', prompt: 'an everyday slice-of-life situation' },
  { id: 'business', name: 'Business & work', prompt: 'a workplace / business setting (emails, meetings, projects)' },
  { id: 'travel', name: 'Travel', prompt: 'a travel story (airports, hotels, sightseeing)' },
  { id: 'sci-fi', name: 'Sci-fi', prompt: 'a short science-fiction scene' },
  { id: 'detective', name: 'Detective', prompt: 'a short detective mystery scene (a crime, clues and an investigator)' },
  { id: 'cooking', name: 'Cooking', prompt: 'a cooking / food scene (recipes, kitchen, a restaurant)' },
  { id: 'sport', name: 'Sport', prompt: 'a sports scene (a match, training or a competition)' },
];

/* Желаемая длина текста: id для UI + примерное число слов для модели. */
const LW_TEXT_LENGTHS = [
  { id: 'short', name: 'Short', words: 80 },
  { id: 'medium', name: 'Medium', words: 150 },
  { id: 'long', name: 'Long', words: 250 },
];

/* Сгенерировать текст. Аргументы:
     words   — массив английских слов, которые надо задействовать;
     level   — строка из LW_CEFR_LEVELS;
     topic   — строка prompt из LW_TEXT_TOPICS (описание темы для модели);
     length  — примерное число слов (из LW_TEXT_LENGTHS[].words).
   Возвращает { title, text, textRu, used } — used — слова, реально
   использованные в тексте. Бросает Error с теми же .code, что lwAiFillWord. */
async function lwAiGenerateText(words, level, topic, length, count) {
  const list = (words || [])
    .map((w) => String(w || '').trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 60); // разумный потолок слов на один текст
  if (!list.length) { const e = new Error('No words for the text.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('No Gemini key set.'); e.code = 'no-key'; throw e; }

  const lvl = LW_CEFR_LEVELS.includes(level) ? level : 'B1';
  const topicText = (topic || '').trim() || LW_TEXT_TOPICS[0].prompt;
  const wordCount = Number(length) > 0 ? Math.round(Number(length)) : 150;
  const nTexts = Number(count) > 0 ? Math.round(Number(count)) : 1; // сколько текстов вернуть за один запрос

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — преподаватель ' + lwLangInfo().ruGen + ' языка, который пишет короткие обучающие тексты. '
          + 'Тебе дают: список ' + lwLangInfo().ruGenPl + ' слов, уровень CEFR ученика и тему. '
          + 'Напиши связный, естественный текст на ' + lwLangInfo().ruPrep + ' примерно на заданное число слов, '
          + 'который по возможности РАСКРЫВАЕТ заданную тему. '
          + 'Тема — это желательный ориентир для сеттинга и настроения, а не жёсткая рамка: '
          + 'старайся выдержать её, но естественность и связность текста важнее. Если какое-то слово '
          + 'из списка органично не вписывается в тему, не притягивай его за уши и не ломай тему ради него — '
          + 'выбери естественный вариант (мягко отойди от темы либо оставь такое слово в стороне). '
          + 'Слова из списка — это ЖЕЛАТЕЛЬНАЯ лексика, а не жёсткое требование: '
          + 'старайся вплести в текст КАК МОЖНО БОЛЬШЕ слов из списка (в любой форме — '
          + 'спряжение, число, время допустимы), но не жертвуй связностью и естественностью ради '
          + 'того, чтобы впихнуть все слова. Лучше складный текст с частью слов, чем неестественный со всеми. '
          + 'Число слов в списке — это НЕ требуемое количество: используй столько, сколько органично ложится в текст. '
          + 'Не выдумывай перевод слов, просто вплети их в текст. '
          + 'Язык и грамматика должны строго соответствовать уровню CEFR: для A2 — очень простые предложения, '
          + 'для C1–C2 — богатая лексика и сложные конструкции. '
          + 'Напиши РОВНО ' + nTexts + ' независимых текст(а/ов) по этим правилам. Тексты должны заметно '
          + 'отличаться друг от друга по сюжету/ракурсу (даже при одной теме) и не повторять друг друга. '
          + 'Верни поле texts — массив из ' + nTexts + ' объект(а/ов), где каждый объект это один текст со следующими полями: '
          + 'title — короткий заголовок на ' + lwLangInfo().ruPrep + '; '
          + 'sentences — массив предложений текста ПО ПОРЯДКУ, где каждый элемент это объект '
          + '{ en, ru }: en — одно предложение на ' + lwLangInfo().ruPrep + ' (поле называется en для любого языка), ru — его точный перевод на русский. '
          + 'Разбивай текст на естественные предложения; вместе они образуют связный текст. '
          + 'used — массив слов из списка, которые ты реально использовал в этом тексте.',
      }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: 'Уровень CEFR: ' + lvl + '\n'
          + 'Тема (желательный ориентир, естественность важнее): ' + topicText + '\n'
          + 'Примерная длина каждого текста: ' + wordCount + ' слов\n'
          + 'Сколько текстов вернуть: ' + nTexts + '\n'
          + 'Слова для использования:\n' + list.join('\n'),
      }],
    }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 }, // без «рассуждений» — заметно быстрее для B1-текстов
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          texts: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                sentences: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      en: { type: 'STRING' },
                      ru: { type: 'STRING' },
                    },
                    required: ['en', 'ru'],
                  },
                },
                used: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['title', 'sentences', 'used'],
            },
          },
        },
        required: ['texts'],
      },
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error('Cannot reach Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Invalid Gemini key.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Daily Gemini limit reached. Try again later.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Gemini is overloaded. Try again in a minute.'); e.code = 'overload'; throw e;
    }
    const e = new Error('AI service error (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('The model refused the request.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Empty AI response.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI returned an invalid response.'); err.code = 'refusal'; throw err; }

  /* Собираем одну карточку из объекта { title, sentences, used }. Возвращает null,
     если у текста нет ни одного валидного предложения. */
  const buildCard = (t) => {
    const sentences = Array.isArray(t && t.sentences)
      ? t.sentences
          .map((s) => ({ en: String((s && s.en) || '').trim(), ru: String((s && s.ru) || '').trim() }))
          .filter((s) => s.en)
      : [];
    if (!sentences.length) return null;
    return {
      title: String((t && t.title) || '').trim(),
      sentences,
      /* производные для совместимости / полного показа */
      text: sentences.map((s) => s.en).join(' '),
      textRu: sentences.map((s) => s.ru).filter(Boolean).join(' '),
      used: Array.isArray(t && t.used) ? t.used.map((w) => String(w || '').trim()).filter(Boolean) : [],
    };
  };

  const cards = (Array.isArray(parsed && parsed.texts) ? parsed.texts : [])
    .map(buildCard)
    .filter(Boolean);
  if (!cards.length) { const e = new Error('AI returned an empty text.'); e.code = 'refusal'; throw e; }

  return cards; // всегда массив (длиной 1..nTexts)
}

/* Fisher–Yates shuffle (не мутирует вход) — свой случайный срез слов на каждый текст. */
function lwShuffle(arr) {
  const a = (arr || []).slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Сгенерировать пачку из `count` текстов одним прогоном. Аргументы:
     words         — весь пул английских слов категории (перетасуем сами);
     levels        — массив выбранных уровней CEFR (для каждого текста берём случайный);
     topicPrompts  — массив prompt-описаний тем (для каждого текста берём случайную);
     length        — примерная длина каждого текста в словах;
     count         — сколько текстов сгенерировать (по умолчанию LW_READING_BATCH).
   Делает ОДИН запрос к Gemini, который возвращает `count` текстов сразу (общий уровень
   и тема на все тексты — выбираются случайно из выбранных). Возвращает массив карточек
   { title, sentences, text, textRu, used, source, level, id }. Ошибку (с её .code)
   пробрасывает наверх, чтобы UI показал причину. */
async function lwAiGenerateBatch(words, levels, topicPrompts, length, count) {
  const pool = (words || []).map((w) => String(w || '').trim()).filter(Boolean);
  if (!pool.length) { const e = new Error('No words for the text.'); e.code = 'empty'; throw e; }
  if (!lwGetGeminiKey()) { const e = new Error('No Gemini key set.'); e.code = 'no-key'; throw e; }

  const lvls = (levels && levels.length) ? levels : ['B1'];
  const topics = (topicPrompts && topicPrompts.length) ? topicPrompts : [LW_TEXT_TOPICS[0].prompt];
  const n = Number(count) > 0 ? Math.round(Number(count)) : LW_READING_BATCH;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const level = pick(lvls);
  const topic = pick(topics);
  const picked = lwShuffle(pool); // lwAiGenerateText сам возьмёт первые 60

  const texts = await lwAiGenerateText(picked, level, topic, length, n); // один HTTP-запрос → массив текстов
  return texts.map((r) => ({
    ...r,
    source: picked,
    level,
    id: 'rd_' + Date.now().toString(36) + '_' + lwUid(),
  }));
}

/* ---------------- Speech voice (device-local) ----------------
   Browsers default to a plain voice even when far better ones are installed.
   Voices of the current language are ranked by quality; 'Auto' takes the top one. */
const LW_VOICE_GOOD = /natural|neural|online|premium|enhanced|siri/i;
const LW_VOICE_KNOWN = /^(google (us|uk) english|samantha|daniel|karen|moira|tessa|serena|alex|ava|allison|susan|tom|evan|nathan|zoe|aria|jenny|guy|libby|ryan|sonia)\b/i;
const LW_VOICE_NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|organ|pipe organ|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
const LW_ACCENTS = { US: 'US', GB: 'UK', AU: 'Australia', IE: 'Ireland', IN: 'India', ZA: 'South Africa', NZ: 'New Zealand', CA: 'Canada', SG: 'Singapore', RO: 'Romania', MD: 'Moldova' };

function lwVoiceScore(v) {
  let s = 0;
  if (LW_VOICE_GOOD.test(v.name)) s += 50;
  if (LW_VOICE_KNOWN.test(v.name)) s += 30;
  if (LW_VOICE_NOVELTY.test(v.name)) s -= 100;
  const region = (v.lang || '').split(/[-_]/)[1] || '';
  if (region.toUpperCase() === 'US') s += 8;
  else if (region.toUpperCase() === 'GB') s += 6;
  if (v.localService === false) s += 3; // network voices (Chrome's Google voices) usually sound better
  return s;
}
const lwVoiceAccent = (v) => LW_ACCENTS[((v.lang || '').split(/[-_]/)[1] || '').toUpperCase()] || '';

/* voices of this device for the current language, best first ([] until the browser loads them) */
function lwLangVoices() {
  if (!('speechSynthesis' in window)) return [];
  const re = new RegExp('^' + lwLangCode + '([-_]|$)', 'i');
  return window.speechSynthesis.getVoices()
    .filter((v) => re.test(v.lang || ''))
    .sort((a, b) => lwVoiceScore(b) - lwVoiceScore(a) || a.name.localeCompare(b.name));
}
/* The chosen voice is per language (English keeps the original voiceURI field),
   the speed is shared. */
function lwVoiceSettings() {
  const s = lwLoad(LW_KEYS.voice, null) || {};
  const key = lwLangCode === 'en' ? 'voiceURI' : 'voiceURI_' + lwLangCode;
  return { voiceURI: s[key] || '', rate: s.rate === 0.8 ? 0.8 : 1 };
}
function lwSaveVoiceSettings(fields) {
  const s = lwLoad(LW_KEYS.voice, null) || {};
  const out = { ...s };
  if ('rate' in fields) out.rate = fields.rate;
  if ('voiceURI' in fields) out[lwLangCode === 'en' ? 'voiceURI' : 'voiceURI_' + lwLangCode] = fields.voiceURI;
  lwSave(LW_KEYS.voice, out);
}
/* the chosen voice, or the best one when it's 'auto' or no longer installed */
function lwPickVoice() {
  const voices = lwLangVoices();
  const { voiceURI } = lwVoiceSettings();
  return (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) || voices[0] || null;
}
/* voices load asynchronously in Chrome; returns an unsubscribe function */
function lwOnVoicesChanged(cb) {
  if (!('speechSynthesis' in window)) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', cb);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb);
}
/* an utterance in the chosen voice and speed; rateMul slows it further (reader: 0.9) */
function lwUtterance(text, rateMul = 1) {
  const u = new SpeechSynthesisUtterance(text);
  const v = lwPickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lwLangInfo().speech;
  u.rate = lwVoiceSettings().rate * rateMul;
  return u;
}
if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); // starts loading the list early

Object.assign(window, {
  lwLangVoices,
  lwVoiceAccent,
  lwVoiceScore,
  lwVoiceSettings,
  lwSaveVoiceSettings,
  lwPickVoice,
  lwOnVoicesChanged,
  lwUtterance,
  LW_KEYS,
  LW_READING_BATCH,
  LW_LANGUAGES,
  LW_LANG_CODES,
  lwDocLang,
  lwUserLangs,
  lwSetCurrentLang,
  lwCurrentLang,
  lwLangInfo,
  lwCefrField,
  LW_CEFR_LEVELS,
  LW_TEXT_TOPICS,
  LW_TEXT_LENGTHS,
  lwUid,
  LW_POS,
  lwNormPos,
  lwAiTagPos,
  lwAiLookupWord,
  lwAiTranslateSentences,
  lwAiSuggestCollocations,
  lwAiGenerateLesson,
  lwAiRegenerateTask,
  lwNormTask,
  lwWordOfTheDay,
  lwLoad,
  lwSave,
  lwFileToPhoto,
  lwAutoFindPhoto,
  lwGetGeminiKey,
  lwSetGeminiKey,
  lwHasGeminiKey,
  lwAiFillWord,
  lwAiFillWords,
  lwAiGenerateText,
  lwAiGenerateBatch,
  lwShuffle,
});
