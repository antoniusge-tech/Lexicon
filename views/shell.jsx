/* shell.jsx — app shell: app bar, nav drawer, tab bar, toasts, group picker, language picker, group form. */

import { useState, useEffect, useCallback } from 'react';
import { LW_LANGUAGES, lwLangInfo, lwUid } from '../data.js';
import { GroupChip, Ic, lwLeafGroups } from '../components.jsx';

const LW_TABS = [
  { id: 'learn', label: 'Learn', icon: Ic.Learn },
  { id: 'reading', label: 'Reading', icon: Ic.Book },
  { id: 'grammar', label: 'Grammar', icon: Ic.Grammar },
  { id: 'library', label: 'Library', icon: Ic.Library },
  { id: 'profile', label: 'Profile', icon: Ic.Person },
];

/* ---------------- Toast notifications (bottom-right) ---------------- */
function Toast({ toast, onDismiss, onAction }) {
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 220); // matches toastOut animation
  }, [toast.id, onDismiss]);

  /* auto-dismiss success toasts; keep errors until the user closes them */
  useEffect(() => {
    if (toast.kind !== 'success') return;
    const t = setTimeout(close, 7000);
    return () => clearTimeout(t);
  }, [toast.kind, close]);

  return (
    <div className={'toast toast-' + (toast.kind === 'error' ? 'error' : 'success') + (leaving ? ' is-out' : '')}
      role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.kind === 'error'
          ? <Ic.Close width="18" height="18" />
          : <Ic.Check width="18" height="18" />}
      </span>
      <div className="toast-body">
        <span className="toast-title">{toast.title}</span>
        {toast.msg && <span className="toast-msg">{toast.msg}</span>}
        {toast.action && (
          <button type="button" className="toast-action"
            onClick={() => { onAction(toast.action); close(); }}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" className="toast-close" aria-label="Close" onClick={close}>
        <Ic.Close width="16" height="16" />
      </button>
    </div>
  );
}

function ToastStack({ toasts, onDismiss, onAction }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} onAction={onAction} />
      ))}
    </div>
  );
}

/* ---------------- App shell: app bar, navigation drawer / sidebar, tab bar ----------------
   Below 1024px: glass app bar on top, slide-in drawer, bottom tab bar.
   From 1024px the drawer is a permanent sidebar and the app bar + tab bar hide (CSS). */
function AppBar({ onMenu, level, xp, onLevel }) {
  return (
    <header className="appbar">
      <button className="icon-btn" onClick={onMenu} aria-label="Menu"><Ic.Menu /></button>
      <span className="brand-name">Lexicon</span>
      <button className="level-chip" type="button" onClick={onLevel} title={xp + ' XP'}>
        <Ic.Star width="16" height="16" /> LVL {level}
      </button>
    </header>
  );
}

/* the user's photo, or the first letter of their username */
function Avatar({ user, className = '' }) {
  if (user && user.avatar) return <img className={'avatar ' + className} src={user.avatar} alt="" />;
  return <span className={'avatar ' + className}>{((user && user.username) || '?').slice(0, 1).toUpperCase()}</span>;
}

function NavDrawer({ open, onClose, tab, learnMode, goTo, stats, user, isAdmin, wordCount, lang, langs, setLang, theme, onToggleTheme, onGeminiKey }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const item = (name, Icon, label, active, extra) => (
    <button key={name} type="button" className={'nav-item' + (active ? ' on' : '')} onClick={() => goTo(name)}>
      <Icon /><span className="nav-label">{label}</span>{extra}
    </button>
  );
  const learnOn = tab === 'learn' && learnMode !== 'review';
  const activeToday = stats.todayAnswers > 0;

  return (
    <>
      <div className={'drawer-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' open' : '')}>
        <div className="drawer-head">
          <div className="drawer-logo"><Ic.Library /></div>
          <div className="drawer-brand">
            <span className="brand-name">Lexicon</span>
            <span className="drawer-sub">{lwLangInfo(lang).name} lab</span>
          </div>
          <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close menu"><Ic.Close /></button>
        </div>

        <button type="button" className="drawer-profile" onClick={() => goTo('profile')}>
          <div className="drawer-profile-top">
            <Avatar user={user} />
            <span className="drawer-profile-text">
              <span className="drawer-name">{user.username}</span>
              <span className="drawer-meta">Level {stats.level} · {stats.xp} XP</span>
            </span>
          </div>
          <span className="drawer-streak">
            <Ic.Flame width="18" height="18" />
            <span>{stats.streak} day streak</span>
            <span className={'streak-badge' + (activeToday ? ' on' : '')}>{activeToday ? 'Active' : 'Study today'}</span>
          </span>
        </button>

        {langs.length > 1 && (
          <div className="seg drawer-langs" role="group" aria-label="Language you learn">
            {langs.map((code) => {
              const l = lwLangInfo(code);
              return (
                <button key={code} type="button" className={'seg-btn' + (lang === code ? ' on' : '')}
                  aria-pressed={lang === code} onClick={() => setLang(code)}>{l.flag} {l.name}</button>
              );
            })}
          </div>
        )}

        <nav className="drawer-nav">
          {item('cards', Ic.Learn, 'Learn', learnOn)}
          {item('review', Ic.Repeat, 'Review', tab === 'learn' && learnMode === 'review',
            stats.dueCount > 0 && <span className="nav-badge nav-badge-hot">{stats.dueCount}</span>)}
          {item('reading', Ic.Book, 'Reading', tab === 'reading')}
          {item('grammar', Ic.Grammar, 'Grammar', tab === 'grammar')}
          {item('library', Ic.Library, 'Library', tab === 'library', <span className="nav-badge">{wordCount} words</span>)}
          {item('import', Ic.Plus, 'Import', tab === 'import')}
          {isAdmin && item('admin', Ic.Settings, 'Admin', tab === 'admin')}
        </nav>

        <div className="drawer-section">Settings</div>
        <nav className="drawer-nav">
          {item('profile', Ic.Person, 'Profile', tab === 'profile')}
          <button type="button" className="nav-item" onClick={onToggleTheme}>
            <Ic.Moon /><span className="nav-label">Dark theme</span>
            <span className={'switch' + (theme === 'dark' ? ' on' : '')} aria-hidden="true" />
          </button>
          <button type="button" className="nav-item" onClick={onGeminiKey}>
            <Ic.Key /><span className="nav-label">Gemini API key</span>
          </button>
        </nav>
      </aside>
    </>
  );
}

function TabBar({ tab, goTo }) {
  return (
    <nav className="tabbar">
      {LW_TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={'tab' + (tab === id ? ' on' : '')} onClick={() => goTo(id)}>
          <Icon /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------------- Category view ---------------- */
function CategoryView({ groups, selected, setSelected, countByGroup, goStudy, ctaLabel = 'Start studying' }) {
  const leafGroups = (lwLeafGroups ? lwLeafGroups(groups) : groups)
    .filter((g) => countByGroup[g.id] > 0);
  const toggle = (id) => {
    setSelected((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };
  const allOn = selected.length === leafGroups.length && leafGroups.length > 0;
  const toggleAll = () => {
    setSelected(allOn ? [] : leafGroups.map((g) => g.id));
  };
  const hasWords = selected.some((id) => countByGroup[id] > 0);

  return (
    <div className="category">
      <div className="selector">
        <div className="chips">
          <button className={'chip chip-all' + (allOn ? ' chip-on' : '')} onClick={toggleAll} type="button">
            All
          </button>
          {leafGroups.map((g) => (
            <GroupChip key={g.id} group={g} groups={groups} count={countByGroup[g.id] || 0}
              active={selected.includes(g.id)} onToggle={() => toggle(g.id)} />
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-cta-study" disabled={!hasWords} onClick={goStudy}>
        {ctaLabel}
      </button>
    </div>
  );
}

/* ---------------- Group form ---------------- */
const LW_PALETTE = ['#005da7', '#2F9E8F', '#5B6CE8', '#C9913B', '#B7409B', '#3E8ED0', '#5BA02E', '#D6453E'];

function GroupForm({ initial, parentGroup, onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [color, setColor] = useState(initial ? initial.color : (parentGroup ? parentGroup.color : LW_PALETTE[0]));
  const canSave = name.trim();
  const submit = () => {
    if (!canSave) return;
    const parentId = initial ? initial.parentId : (parentGroup ? parentGroup.id : undefined);
    onSave({
      id: initial ? initial.id : lwUid(),
      name: name.trim(),
      color,
      ...(parentId ? { parentId } : {}),
    });
  };
  return (
    <div className="form">
      {parentGroup && (
        <p className="field-hint">
          Subgroup of <strong>{parentGroup.name}</strong>
        </p>
      )}
      <label className="field">
        <span className="field-label">Group name</span>
        <input className="input" value={name} autoFocus placeholder="e.g. Phrasal verbs"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </label>
      <div className="field">
        <span className="field-label">Color</span>
        <div className="swatches">
          {LW_PALETTE.map((c) => (
            <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')}
              style={{ background: c }} onClick={() => setColor(c)} aria-label={c}>
              {c === color && <Ic.Check />}
            </button>
          ))}
        </div>
      </div>
      <div className="form-foot">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>{initial ? 'Save changes' : 'Create group'}</button>
      </div>
    </div>
  );
}

/* ---------------- Language select (first launch) ----------------
   One language or several; the first picked is studied first. */
function LanguageSelectView({ onSelect }) {
  const [picked, setPicked] = useState([]);
  const toggle = (code) => setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  return (
    <div className="lang-select">
      <div className="lang-select-card">
        <p className="lang-select-title">Which languages are you learning?</p>
        <p className="lang-select-sub">Pick one or both. You can switch between them or add one later in Profile.</p>
        <div className="lang-select-grid">
          {LW_LANGUAGES.map((l) => (
            <button key={l.code} className={'lang-opt' + (picked.includes(l.code) ? ' on' : '')} type="button"
              aria-pressed={picked.includes(l.code)} onClick={() => toggle(l.code)}>
              {picked.includes(l.code) && <span className="lang-opt-check"><Ic.Check width="14" height="14" /></span>}
              <span className="lang-opt-flag">{l.flag}</span>
              <span className="lang-opt-name">{l.name}</span>
              <span className="lang-opt-native">{l.native}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary lg lang-select-go" disabled={!picked.length} onClick={() => onSelect(picked)}>
          Continue
        </button>
      </div>
    </div>
  );
}

export {
  AppBar, Avatar, CategoryView, GroupForm, LanguageSelectView, NavDrawer, TabBar,
  ToastStack,
};
