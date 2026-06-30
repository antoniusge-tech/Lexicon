/* data.jsx — local (per-device) keys + helpers for AppLearnWords */

const LW_KEYS = {
  theme: 'lw_theme_v1',
  selected: 'lw_selected_groups_v1',
  direction: 'lw_study_direction_v1',
  studySession: 'lw_study_session_v1',
  hintMode: 'lw_hint_mode_v1',
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

Object.assign(window, {
  LW_KEYS,
  LW_LANGUAGES,
  lwUid,
  lwLoad,
  lwSave,
  lwFileToPhoto,
  lwAutoFindPhoto,
});
