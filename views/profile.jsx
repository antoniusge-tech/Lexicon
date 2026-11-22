/* profile.jsx — Profile: stats, badges, settings, account. */

import { useState, useRef } from 'react';
import { lwDeleteAccount, lwLinkGoogle, lwUnlinkGoogle } from '../firebase.js';
import {
  LW_KEYS, LW_LANGUAGES, lwCefrField, lwFileToPhoto, lwHasGeminiKey, lwLangField,
  lwLangInfo,
} from '../data.js';
import {
  LW_BACKGROUND_OPTIONS, LW_CEFR_ALL, LW_GOAL_OPTIONS, LW_RETENTION_OPTIONS,
  LW_SESSION_OPTIONS, LW_XP_GOAL_BONUS, lwFormatDuration,
} from '../progress.ts';
import { Ic, Modal, VoicePicker, WeekChart } from '../components.jsx';
import { LW_ROLE_LABEL } from './shared.jsx';
import { Avatar } from './shell.jsx';

/* ---------------- Delete account confirmation ---------------- */
function DeleteAccountModal({ hasPassword, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !hasPassword || !!password; // Google-only accounts confirm in a Google popup instead

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await lwDeleteAccount(password);
      try {
        [LW_KEYS.studySession, LW_KEYS.selected, LW_KEYS.nav].forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
      /* onAuthStateChanged in App unmounts the signed-in UI from here */
    } catch (err) {
      const code = err && err.code;
      setError(code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'Wrong password.'
        : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? ''
        : code === 'auth/user-mismatch' ? 'Pick the same Google account you signed in with.'
        : 'Could not delete the account. Try again.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete account" onClose={busy ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={!ready || busy}>
          {busy ? 'Deleting…' : hasPassword ? 'Delete forever' : 'Confirm with Google & delete'}
        </button>
      </>}>
      <p className="confirm-text">
        This permanently deletes <strong>all your words, groups, progress and profile</strong>.
        It can't be undone. {hasPassword ? 'Enter your password to confirm.' : 'Confirm with your Google account.'}
      </p>
      {hasPassword && (
        <label className="field">
          <span className="field-label">Password</span>
          <input className="input" type="password" value={password} autoFocus autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </label>
      )}
      {error && <p className="field-hint" style={{ color: 'var(--error)', marginTop: 10 }}>{error}</p>}
    </Modal>
  );
}

/* ---------------- Badges (Profile) ---------------- */
const LW_BADGES_COLLAPSED = 8;

function lwBadgeNum(v, unit) { return unit === 'h' ? (Math.floor(v * 10) / 10) : Math.floor(v); }

function BadgesSection({ badges }) {
  const [all, setAll] = useState(false);
  if (!badges.length) return null;
  const got = (b) => b.earnedAt || b.reached;
  const sorted = badges.slice().sort((a, b) => (got(b) ? 1 : 0) - (got(a) ? 1 : 0)
    || (got(a) ? (b.earnedAt || Date.now()) - (a.earnedAt || Date.now()) : b.value / b.target - a.value / a.target));
  const shown = all ? sorted : sorted.slice(0, LW_BADGES_COLLAPSED);
  const count = badges.filter(got).length;
  return (
    <section className="dash-card badges">
      <div className="dash-head">
        <h2 className="dash-title">Badges</h2>
        <span className="dash-badge">{count} of {badges.length}</span>
      </div>
      <div className="badge-grid">
        {shown.map((b) => {
          const on = got(b);
          const pct = Math.min(100, Math.round((b.value / b.target) * 100));
          return (
            <div className={'badge-card' + (on ? ' on' : '')} key={b.badge.id} title={b.badge.text}>
              <span className="badge-icon" aria-hidden="true">{b.badge.icon}</span>
              <span className="badge-title">{b.badge.title}</span>
              {on ? (
                <span className="badge-sub">{b.earnedAt ? new Date(b.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}</span>
              ) : (
                <>
                  <span className="badge-sub">{b.badge.text}</span>
                  <span className="badge-track"><span className="badge-fill" style={{ width: pct + '%' }} /></span>
                  <span className="badge-num">{lwBadgeNum(b.value, b.badge.unit)} / {b.target}{b.badge.unit === 'level' ? '' : ' ' + b.badge.unit}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {badges.length > LW_BADGES_COLLAPSED && (
        <button type="button" className="btn btn-soft sm badges-more" onClick={() => setAll((x) => !x)}>
          {all ? 'Show less' : 'Show all ' + badges.length}
        </button>
      )}
    </section>
  );
}

/* ---------------- Profile: who you are, your progress (dashboard), settings ---------------- */
const LW_STATUS_META = [
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'review', label: 'To review' },
  { id: 'mastered', label: 'Mastered' },
];

function ProfileView({ user, stats, badges, updateProfile, authInfo, refreshAuthInfo, pushToast, goLearn, goLevelTest, srs,
  theme, onToggleTheme, direction, setDirection, lang, langs, setLang, removeLang, onGeminiKey, onLogout, onDeleteAccount }) {
  const fileRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  /* lwLevel: level n starts at 50·(n−1)² XP */
  const levelStart = 50 * (stats.level - 1) ** 2;
  const levelEnd = 50 * stats.level ** 2;
  const levelPct = Math.round(((stats.xp - levelStart) / (levelEnd - levelStart)) * 100);
  const langInfo = lwLangInfo(lang);
  const cefrKey = lwCefrField(lang);
  const cefrTargetKey = lwCefrField(lang, true);
  const otherLangs = LW_LANGUAGES.filter((l) => !langs.includes(l.code));
  const since = user.createdAt && user.createdAt.toDate
    ? user.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const left = Math.max(0, stats.goal - stats.todayAnswers);
  const counts = stats.statusCounts;
  const totalWords = counts.new + counts.learning + counts.review + counts.mastered;

  const pickAvatar = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await updateProfile({ avatar: await lwFileToPhoto(file, 256, true) });
    } catch (err) {
      pushToast({ kind: 'error', title: 'Could not use this image', msg: 'Try a JPEG or PNG photo.' });
    }
    setAvatarBusy(false);
  };

  const googleAction = async (link) => {
    setGoogleBusy(true);
    try {
      if (link) await lwLinkGoogle(); else await lwUnlinkGoogle();
      refreshAuthInfo();
      pushToast({ kind: 'success', title: link ? 'Google account linked' : 'Google account unlinked',
        msg: link ? 'You can now sign in with Google.' : 'Sign in with your password from now on.' });
    } catch (err) {
      const code = err && err.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        pushToast({ kind: 'error', title: link ? 'Could not link Google' : 'Could not unlink Google',
          msg: code === 'auth/credential-already-in-use' ? 'This Google account already belongs to another Lexicon account.'
            : code === 'auth/operation-not-allowed' ? 'Google sign-in is not enabled for this app yet.'
            : (err && err.message) || String(err) });
      }
    }
    setGoogleBusy(false);
  };

  return (
    <div className="profile">
      {/* who you are */}
      <section className="profile-card">
        <div className="profile-avatar-wrap">
          <Avatar user={user} className="avatar-xl" />
          <button type="button" className="avatar-edit" onClick={() => fileRef.current && fileRef.current.click()}
            disabled={avatarBusy} aria-label="Change photo" title="Change photo">
            {avatarBusy ? <span className="spinner" /> : <Ic.Camera width="16" height="16" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        </div>
        <span className="level-pill"><Ic.Star width="14" height="14" /> Level {stats.level}
          {user.role && user.role !== 'user' ? ' · ' + (LW_ROLE_LABEL[user.role] || user.role) : ''}</span>
        <h1 className="profile-name">{user.username}</h1>
        <p className="profile-handle">@{user.username.toLowerCase()}{since ? ' · Member since ' + since : ''}</p>
        <span className="learning-chip">
          {langInfo.flag + ' Learning ' + langInfo.name}
          {user[cefrKey] ? ' · ' + user[cefrKey] : ''}{user[cefrTargetKey] ? ' → ' + user[cefrTargetKey] : ''}
        </span>
        {user.avatar && (
          <button type="button" className="btn btn-ghost sm" onClick={() => updateProfile({ avatar: '' })}>Remove photo</button>
        )}
      </section>

      {/* headline numbers */}
      <section className="tiles">
        <div className="tile"><span className="tile-icon tile-icon-blue"><Ic.Check width="18" height="18" /></span>
          <span className="tile-num">{counts.mastered}</span><span className="tile-label">Words mastered</span></div>
        <div className="tile"><span className="tile-icon tile-icon-gold"><Ic.Flame width="18" height="18" /></span>
          <span className="tile-num">{stats.streak} {stats.streak === 1 ? 'day' : 'days'}</span><span className="tile-label">Current streak</span></div>
        <div className="tile"><span className="tile-icon tile-icon-teal"><Ic.Clock width="18" height="18" /></span>
          <span className="tile-num">{lwFormatDuration(stats.totalMs)}</span><span className="tile-label">Practice time</span></div>
      </section>

      {/* level progress */}
      <section className="dash-card">
        <div className="goal-row">
          <span className="goal-label">Level {stats.level} · {stats.xp} XP</span>
          <span className="goal-count">{levelEnd - stats.xp} XP to level {stats.level + 1}</span>
        </div>
        <div className="goal-track"><div className="goal-fill" style={{ width: levelPct + '%' }} /></div>
      </section>

      {/* this week */}
      <section className="dash-card">
        <div className="dash-head">
          <div>
            <h2 className="dash-title">This week</h2>
            <p className="dash-sub">Answers per day · goal {stats.goal}</p>
          </div>
          <span className={'dash-badge' + (left === 0 ? ' met' : '')}>Today {stats.todayAnswers} / {stats.goal}</span>
        </div>
        <WeekChart days={stats.week} goal={stats.goal} />
      </section>

      {/* words by status */}
      <section className="dash-card">
        <div className="dash-head">
          <div>
            <h2 className="dash-title">Your words</h2>
            <p className="dash-sub">{totalWords} words in your groups</p>
          </div>
        </div>
        {totalWords > 0 && (
          <div className="status-bar" aria-hidden="true">
            {LW_STATUS_META.map((m) => counts[m.id] > 0 && (
              <span key={m.id} className={'status-seg status-' + m.id} style={{ flexGrow: counts[m.id] }} />
            ))}
          </div>
        )}
        <div className="status-legend">
          {LW_STATUS_META.map((m) => (
            <div key={m.id} className="status-item">
              <span className={'status-swatch status-' + m.id} />
              <span className="status-name">{m.label}</span>
              <span className="status-num">{counts[m.id]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CEFR: self-assessed level and target */}
      <section className="dash-card">
        <h2 className="dash-title">{langInfo.name} level</h2>
        <p className="dash-sub">Your level sets the default difficulty of reading texts.</p>
        {(() => {
          const lt = user[lwLangField('levelTest', lang)];
          return (
            <div className="lt-link">
              <span>{lt ? 'Last test: ' + lt.level + ' · ' + new Date(lt.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not sure?'}</span>
              <button type="button" className="btn btn-soft sm" onClick={goLevelTest}><Ic.ListCheck width="15" height="15" /> {lt ? 'Retake level test' : 'Take a level test'}</button>
            </div>
          );
        })()}
        <div className="cefr-row">
          <span className="cefr-label">I'm at</span>
          <div className="cefr-pills">
            {LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user[cefrKey] === lv ? ' on' : '')}
                onClick={() => updateProfile({ [cefrKey]: lv })}>{lv}</button>
            ))}
          </div>
        </div>
        <div className="cefr-row">
          <span className="cefr-label">Goal</span>
          <div className="cefr-pills">
            {LW_CEFR_ALL.map((lv) => (
              <button key={lv} type="button" className={'cefr-pill' + (user[cefrTargetKey] === lv ? ' on' : '')}
                onClick={() => updateProfile({ [cefrTargetKey]: lv })}>{lv}</button>
            ))}
          </div>
        </div>
      </section>

      <BadgesSection badges={badges} />

      {/* nudge */}
      <section className="cta-card">
        <h2 className="cta-title">{left > 0 ? left + (left === 1 ? ' answer' : ' answers') + ' to today\'s goal' : 'Daily goal reached 🎉'}</h2>
        <p className="cta-sub">{left > 0 ? 'Reach it to earn +' + LW_XP_GOAL_BONUS + ' XP and keep your streak going.' : 'Come back tomorrow to keep your ' + stats.streak + '-day streak.'}</p>
        <button type="button" className="btn btn-primary lg" onClick={goLearn}><Ic.Learn width="18" height="18" /> {left > 0 ? 'Start learning' : 'Keep practicing'}</button>
      </section>

      <h2 className="section-label">Learning</h2>
      <section className="settings-list">
        <div className="setting-row">
          <span className="setting-label"><Ic.Flag /> Daily goal</span>
          <div className="seg">
            {LW_GOAL_OPTIONS.map((g) => (
              <button key={g} type="button" className={'seg-btn' + (stats.goal === g ? ' on' : '')}
                onClick={() => updateProfile({ [lwLangField('dailyGoal', lang)]: g })}>{g}</button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label"><Ic.Swap /> Card direction</span>
          <div className="seg">
            <button type="button" className={'seg-btn' + (direction === 'en-ru' ? ' on' : '')} onClick={() => setDirection('en-ru')}>{lang.toUpperCase()} → RU</button>
            <button type="button" className={'seg-btn' + (direction === 'ru-en' ? ' on' : '')} onClick={() => setDirection('ru-en')}>RU → {lang.toUpperCase()}</button>
          </div>
        </div>
        {/* review schedule (users.srs, every language) */}
        <div className="setting-row setting-row-wrap">
          <span className="setting-label" title="How likely you should still remember a word when it comes back. Higher means more reviews.">
            <Ic.Bulb /> Target memory
          </span>
          <div className="seg">
            {LW_RETENTION_OPTIONS.map((r) => (
              <button key={r} type="button" className={'seg-btn' + (srs.retention === r ? ' on' : '')}
                onClick={() => updateProfile({ srs: { ...srs, retention: r } })}>{Math.round(r * 100)}%</button>
            ))}
          </div>
        </div>
        <div className="setting-row setting-row-wrap">
          <span className="setting-label"><Ic.Repeat /> Review session</span>
          <div className="seg">
            {LW_SESSION_OPTIONS.map((n) => (
              <button key={n} type="button" className={'seg-btn' + (srs.session === n ? ' on' : '')}
                onClick={() => updateProfile({ srs: { ...srs, session: n } })}>{n || 'All'}</button>
            ))}
          </div>
        </div>
        <div className="setting-row setting-row-wrap">
          <span className="setting-label" title="Share of a Focus review given to words from other groups that are about to be forgotten.">
            <Ic.Shuffle /> Other groups in Focus
          </span>
          <div className="seg">
            {LW_BACKGROUND_OPTIONS.map((b) => (
              <button key={b} type="button" className={'seg-btn' + (srs.background === b ? ' on' : '')}
                onClick={() => updateProfile({ srs: { ...srs, background: b } })}>{b ? Math.round(b * 100) + '%' : 'Off'}</button>
            ))}
          </div>
        </div>
        {'speechSynthesis' in window && <VoicePicker key={lang} />}
        <div className="setting-row setting-row-wrap">
          <span className="setting-label"><Ic.Book /> Language you learn</span>
          <div className="seg">
            {langs.map((code) => {
              const l = lwLangInfo(code);
              return (
                <button key={code} type="button" className={'seg-btn' + (lang === code ? ' on' : '')}
                  aria-pressed={lang === code} onClick={() => setLang(code)} title={l.name}>{l.flag} {l.name}</button>
              );
            })}
          </div>
        </div>
        {otherLangs.map((l) => (
          <button key={l.code} type="button" className="setting-row" onClick={() => setLang(l.code)}>
            <span className="setting-label"><Ic.Plus /> Also learn {l.name}</span>
            <span className="setting-value">{l.flag} <Ic.ChevronRight width="16" height="16" /></span>
          </button>
        ))}
        {langs.length > 1 && (
          <button type="button" className="setting-row" onClick={() => {
            if (window.confirm('Stop learning ' + langInfo.name + '? Your ' + langInfo.name + ' words and progress are kept and come back if you add it again.')) removeLang(lang);
          }}>
            <span className="setting-label"><Ic.Close /> Stop learning {langInfo.name}</span>
          </button>
        )}
      </section>

      <h2 className="section-label">App</h2>
      <section className="settings-list">
        <button type="button" className="setting-row" onClick={onToggleTheme}>
          <span className="setting-label"><Ic.Moon /> Dark theme</span>
          <span className={'switch' + (theme === 'dark' ? ' on' : '')} aria-hidden="true" />
        </button>
        <button type="button" className="setting-row" onClick={onGeminiKey}>
          <span className="setting-label"><Ic.Key /> Gemini API key</span>
          <span className="setting-value">{lwHasGeminiKey() ? 'Connected' : 'Not set'} <Ic.ChevronRight width="16" height="16" /></span>
        </button>
      </section>

      <h2 className="section-label">Account</h2>
      <section className="settings-list">
        <div className="setting-row">
          <span className="setting-label">
            <Ic.Google />
            <span className="setting-stack">
              <span>{authInfo.google ? 'Google account linked' : 'Google account'}</span>
              <span className="setting-sub">{authInfo.google ? authInfo.googleEmail : 'Sign in with Google next time'}</span>
            </span>
          </span>
          {authInfo.google ? (
            authInfo.password && (
              <button type="button" className="btn btn-ghost sm" disabled={googleBusy} onClick={() => googleAction(false)}>Unlink</button>
            )
          ) : (
            <button type="button" className="btn btn-soft sm" disabled={googleBusy} onClick={() => googleAction(true)}>Link</button>
          )}
        </div>
        <button type="button" className="setting-row" onClick={onLogout}>
          <span className="setting-label"><Ic.Logout /> Sign out</span>
        </button>
        <button type="button" className="setting-row setting-danger" onClick={onDeleteAccount}>
          <span className="setting-label"><Ic.Trash /> Delete account</span>
        </button>
      </section>
    </div>
  );
}

export {
  DeleteAccountModal, ProfileView,
};
