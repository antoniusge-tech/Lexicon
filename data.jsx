/* data.jsx — local (per-device) keys + helpers for AppLearnWords */

const LW_KEYS = {
  theme: 'lw_theme_v1',
  selected: 'lw_selected_groups_v1',
};

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

Object.assign(window, {
  LW_KEYS,
  lwUid,
  lwLoad,
  lwSave,
});
