/* data.jsx — local (per-device) keys + helpers for AppLearnWords */

const LW_KEYS = {
  theme: 'lw_theme_v1',
  selected: 'lw_selected_groups_v1',
  direction: 'lw_study_direction_v1',
  studySession: 'lw_study_session_v1',
  geminiKey: 'lw_gemini_key_v1', // личный API-ключ Gemini пользователя (только его устройство)
};

const LW_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

const lwUid = () => Math.random().toString(36).slice(2, 9);

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

/* Resize/compress an image (File or Blob) into a JPEG data URL, longest side <= LW_PHOTO_MAX */
function lwFileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > LW_PHOTO_MAX || height > LW_PHOTO_MAX) {
          if (width >= height) {
            height = Math.round((height * LW_PHOTO_MAX) / width);
            width = LW_PHOTO_MAX;
          } else {
            width = Math.round((width * LW_PHOTO_MAX) / height);
            height = LW_PHOTO_MAX;
          }
        }
        const canvas = document.createElement('canvas');
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
  const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(term), {
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
  if (!term) { const e = new Error('Пустое слово.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('Не задан ключ Gemini.'); e.code = 'no-key'; throw e; }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — лексикограф для приложения изучения английского. '
          + 'Для заданного английского слова верни: '
          + 'ipa — транскрипцию IPA (без косых черт); '
          + 'tr — краткий перевод на русский (1–3 варианта через запятую, как в Cambridge Dictionary); '
          + 'example — запоминающееся простое предложение-пример с этим словом; '
          + 'exampleTr — перевод примера на русский.',
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
        },
        required: ['ipa', 'tr', 'example', 'exampleTr'],
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
    const err = new Error('Нет связи с сервисом Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    // 400 при неверном ключе, 429 при исчерпании бесплатного лимита.
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Ключ Gemini недействителен.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Дневной лимит Gemini исчерпан. Попробуйте позже.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Модель Gemini сейчас перегружена. Попробуйте через минуту.'); e.code = 'overload'; throw e;
    }
    const e = new Error('Ошибка AI-сервиса (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('Модель отклонила запрос.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Пустой ответ AI.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI вернул некорректный ответ.'); err.code = 'refusal'; throw err; }

  return {
    ipa: String(parsed.ipa || '').trim(),
    tr: String(parsed.tr || '').trim(),
    example: String(parsed.example || '').trim(),
    exampleTr: String(parsed.exampleTr || '').trim(),
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
  if (!list.length) { const e = new Error('Нет слов для обработки.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('Не задан ключ Gemini.'); e.code = 'no-key'; throw e; }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — лексикограф для приложения изучения английского. '
          + 'Тебе дают список английских слов. Для КАЖДОГО слова верни объект: '
          + 'word — само слово (как в запросе); '
          + 'ipa — транскрипцию IPA (без косых черт); '
          + 'tr — краткий перевод на русский (1–3 варианта через запятую, как в Cambridge Dictionary); '
          + 'example — запоминающееся простое предложение-пример с этим словом; '
          + 'exampleTr — перевод примера на русский. '
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
          },
          required: ['word', 'ipa', 'tr', 'example', 'exampleTr'],
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
    const err = new Error('Нет связи с сервисом Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Ключ Gemini недействителен.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Дневной лимит Gemini исчерпан. Попробуйте позже.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Модель Gemini сейчас перегружена. Попробуйте через минуту.'); e.code = 'overload'; throw e;
    }
    const e = new Error('Ошибка AI-сервиса (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('Модель отклонила запрос.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Пустой ответ AI.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI вернул некорректный ответ.'); err.code = 'refusal'; throw err; }
  if (!Array.isArray(parsed)) { const e = new Error('AI вернул некорректный ответ.'); e.code = 'refusal'; throw e; }

  return parsed.map((p, i) => ({
    word: String((p && p.word) || list[i] || '').trim(),
    ipa: String((p && p.ipa) || '').trim(),
    tr: String((p && p.tr) || '').trim(),
    example: String((p && p.example) || '').trim(),
    exampleTr: String((p && p.exampleTr) || '').trim(),
  })).filter((r) => r.word);
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
  { id: 'the-office', name: 'Сериал «Офис» (The Office US)', prompt: 'a scene inspired by the American sitcom "The Office" (Dunder Mifflin, Michael Scott and colleagues), in its dry mockumentary humour' },
  { id: 'friends', name: 'Сериал «Друзья» (Friends)', prompt: 'a scene inspired by the sitcom "Friends", light and funny, among the group of friends in the coffee house' },
  { id: 'daily-life', name: 'Повседневная жизнь', prompt: 'an everyday slice-of-life situation' },
  { id: 'business', name: 'Деловая переписка / работа', prompt: 'a workplace / business setting (emails, meetings, projects)' },
  { id: 'travel', name: 'Путешествия', prompt: 'a travel story (airports, hotels, sightseeing)' },
  { id: 'sci-fi', name: 'Фантастика', prompt: 'a short science-fiction scene' },
];

/* Желаемая длина текста: id для UI + примерное число слов для модели. */
const LW_TEXT_LENGTHS = [
  { id: 'short', name: 'Короткий', words: 80 },
  { id: 'medium', name: 'Средний', words: 150 },
  { id: 'long', name: 'Длинный', words: 250 },
];

/* Сгенерировать текст. Аргументы:
     words   — массив английских слов, которые надо задействовать;
     level   — строка из LW_CEFR_LEVELS;
     topic   — строка prompt из LW_TEXT_TOPICS (описание темы для модели);
     length  — примерное число слов (из LW_TEXT_LENGTHS[].words).
   Возвращает { title, text, textRu, used } — used — слова, реально
   использованные в тексте. Бросает Error с теми же .code, что lwAiFillWord. */
async function lwAiGenerateText(words, level, topic, length) {
  const list = (words || [])
    .map((w) => String(w || '').trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 60); // разумный потолок слов на один текст
  if (!list.length) { const e = new Error('Нет слов для текста.'); e.code = 'empty'; throw e; }

  const key = lwGetGeminiKey();
  if (!key) { const e = new Error('Не задан ключ Gemini.'); e.code = 'no-key'; throw e; }

  const lvl = LW_CEFR_LEVELS.includes(level) ? level : 'B1';
  const topicText = (topic || '').trim() || LW_TEXT_TOPICS[0].prompt;
  const wordCount = Number(length) > 0 ? Math.round(Number(length)) : 150;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + LW_GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);

  const body = {
    systemInstruction: {
      parts: [{
        text: 'Ты — преподаватель английского, который пишет короткие обучающие тексты. '
          + 'Тебе дают: список английских слов, уровень CEFR ученика и тему. '
          + 'Напиши связный, естественный текст на английском примерно на заданное число слов, '
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
          + 'для C1–C2 — богатая лексика и сложные конструкции. Верни: '
          + 'title — короткий заголовок на английском; '
          + 'sentences — массив предложений текста ПО ПОРЯДКУ, где каждый элемент это объект '
          + '{ en, ru }: en — одно предложение на английском, ru — его точный перевод на русский. '
          + 'Разбивай текст на естественные предложения; вместе они образуют связный текст. '
          + 'used — массив слов из списка, которые ты реально использовал в тексте.',
      }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: 'Уровень CEFR: ' + lvl + '\n'
          + 'Тема (желательный ориентир, естественность важнее): ' + topicText + '\n'
          + 'Примерная длина: ' + wordCount + ' слов\n'
          + 'Слова для использования:\n' + list.join('\n'),
      }],
    }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 }, // без «рассуждений» — заметно быстрее для B1-текстов
      responseMimeType: 'application/json',
      responseSchema: {
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
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = new Error('Нет связи с сервисом Gemini.'); err.code = 'network'; throw err;
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 403) {
      const e = new Error('Ключ Gemini недействителен.'); e.code = 'bad-key'; throw e;
    }
    if (res.status === 429) {
      const e = new Error('Дневной лимит Gemini исчерпан. Попробуйте позже.'); e.code = 'quota'; throw e;
    }
    if (res.status === 503 || res.status === 500) {
      const e = new Error('Модель Gemini сейчас перегружена. Попробуйте через минуту.'); e.code = 'overload'; throw e;
    }
    const e = new Error('Ошибка AI-сервиса (' + res.status + ').'); e.code = 'network'; throw e;
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') {
    const e = new Error('Модель отклонила запрос.'); e.code = 'refusal'; throw e;
  }
  const text = cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
  if (!text) { const e = new Error('Пустой ответ AI.'); e.code = 'refusal'; throw e; }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { const err = new Error('AI вернул некорректный ответ.'); err.code = 'refusal'; throw err; }

  const sentences = Array.isArray(parsed && parsed.sentences)
    ? parsed.sentences
        .map((s) => ({ en: String((s && s.en) || '').trim(), ru: String((s && s.ru) || '').trim() }))
        .filter((s) => s.en)
    : [];
  if (!sentences.length) { const e = new Error('AI вернул пустой текст.'); e.code = 'refusal'; throw e; }

  return {
    title: String((parsed && parsed.title) || '').trim(),
    sentences,
    /* производные для совместимости / полного показа */
    text: sentences.map((s) => s.en).join(' '),
    textRu: sentences.map((s) => s.ru).filter(Boolean).join(' '),
    used: Array.isArray(parsed && parsed.used) ? parsed.used.map((w) => String(w || '').trim()).filter(Boolean) : [],
  };
}

Object.assign(window, {
  LW_KEYS,
  LW_LANGUAGES,
  LW_CEFR_LEVELS,
  LW_TEXT_TOPICS,
  LW_TEXT_LENGTHS,
  lwUid,
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
});
