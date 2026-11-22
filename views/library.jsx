/* library.jsx — Library: words, groups and collocations views. */

import { useState, useEffect, useMemo } from 'react';
import {
  LW_COLLECTIONS, lwDeleteDoc, lwDeleteProgressForWords, lwDeleteWordsByGroup, lwSetDoc,
} from '../firebase.js';
import { LW_KEYS, lwAiTagPos, lwHasGeminiKey, lwLoad, lwSave, lwWordOfTheDay } from '../data.js';
import { lwLocalDate, lwWordMastery, lwWordStatus } from '../progress.ts';
import { lwFindCardForClip } from '../reading.ts';
import {
  ActionsMenu, CollocForm, Flashcard, GeminiKeyModal, Ic, Modal, PhotoFill, SpeakButton,
  WordForm, lwLeafGroups,
} from '../components.jsx';
import {
  AnswerButtons, LW_IMPORT_ERROR_MSG, LW_LIB_PAGE, LW_STATUS_LABEL, StatusBadge,
} from './shared.jsx';
import { GroupForm } from './shell.jsx';
import { CollocCatalog, CollocSheet } from './collocations.jsx';
import { ClipModal } from './video.jsx';

const LW_LIB_STATUSES = ['all', 'new', 'learning', 'review', 'mastered'];

const LW_LIB_SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'az', label: 'A–Z' },
  { id: 'due', label: 'Next review' },
];

/* Mastery = the word's FSRS stability on a log scale, full at 30 days (lwWordMastery); new words are 0%. */
function WordCard({ word, group, prog, now, canEdit, onEdit, onDelete, clip, onClip }) {
  const status = lwWordStatus(prog, now);
  const pct = Math.round(lwWordMastery(prog) * 100);
  return (
    <article className="wcard">
      <div className="wcard-top">
        <StatusBadge status={status} />
        {group && <span className="wcard-group"><span className="grp-dot" style={{ background: group.color }} />{group.name}</span>}
        {clip && <button type="button" className="wcard-clip" onClick={onClip} aria-label="Watch the video clip"><Ic.Play width="12" height="12" /> Clip</button>}
        <SpeakButton word={word.word} />
      </div>
      <div className="wcard-head">
        <span className="wcard-word">{word.word}</span>
        {word.ipa && <span className="wcard-ipa">{word.ipa}</span>}
        {word.pos && <span className="wcard-pos">{word.pos}</span>}
      </div>
      <div className="wcard-tr">{word.tr}</div>
      <div className="wcard-foot">
        <span className="wcard-mastery-label">Mastery</span>
        <span className="mastery-track"><span className={'mastery-fill status-' + status} style={{ width: pct + '%' }} /></span>
        <span className="wcard-pct">{pct}%</span>
        {canEdit && (
          <span className="wrow-tools">
            <button className="icon-btn sm" onClick={onEdit} aria-label="Edit"><Ic.Edit /></button>
            <button className="icon-btn sm danger" onClick={onDelete} aria-label="Delete"><Ic.Trash /></button>
          </span>
        )}
      </div>
    </article>
  );
}

function WordOfTheDay({ word, onPractice }) {
  return (
    <section className="wotd">
      <span className="wotd-kicker">Word of the day</span>
      <div className="wotd-head">
        <h2 className="wotd-word">{word.word}</h2>
        <SpeakButton word={word.word} />
      </div>
      {(word.ipa || word.pos) && <p className="wotd-ipa">{word.ipa}{word.ipa && word.pos ? ' · ' : ''}{word.pos}</p>}
      <p className="wotd-tr">{word.tr}</p>
      {word.example && <p className="wotd-ex">“{word.example}”</p>}
      <button type="button" className="btn btn-primary" onClick={onPractice}><Ic.Learn width="16" height="16" /> Practice now</button>
      <Ic.Sparkle className="wotd-art" aria-hidden="true" />
    </section>
  );
}

/* one word as a flashcard with Again / Know — answers count like in Learn */
function PracticeCardModal({ word, group, prog, direction, recordAnswer, onClose }) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(null); // 'known' | 'unknown'
  const answer = (status) => {
    if (status === 'skip') { onClose(); return; }
    if (status !== 'known' && status !== 'unknown') return;
    recordAnswer(word.id, status === 'known', 'study');
    setAnswered(status);
  };
  return (
    <Modal title="Practice" onClose={onClose}>
      <div className="practice">
        {answered ? (
          <div className="practice-done">
            <Ic.Check width="28" height="28" />
            <p className="empty-title">{answered === 'known' ? 'Nice!' : 'It will come back soon'}</p>
            <p className="empty-sub">{answered === 'known' ? 'Answer saved to your progress.' : 'You\'ll see it again in Review in 10 minutes.'}</p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="stage practice-stage">
              <Flashcard entry={word} group={group} flipped={flipped} direction={direction}
                onFlip={() => setFlipped((f) => !f)} onSwipe={answer} onShuffle={() => {}} />
            </div>
            <AnswerButtons prog={prog} wordId={word.id} onAnswer={answer} />
          </>
        )}
      </div>
    </Modal>
  );
}

function LibraryView({ groups, words, userId, username, isAdmin, progress, now, direction, recordAnswer, goImport,
  collocations, saveCollocation, pushToast, clips, groupState, setGroupPaused }) {
  /* paused groups (and subgroups of a paused group) skip Learn → Review */
  const pausedSelf = (id) => !!(groupState && groupState[id] === 'paused');
  const pauseItem = (g) => (pausedSelf(g.id)
    ? { label: 'Resume reviews', icon: <Ic.Play width="15" height="15" />, onClick: () => setGroupPaused(g.id, false) }
    : { label: 'Pause reviews', icon: <Ic.Pause width="15" height="15" />, onClick: () => setGroupPaused(g.id, true) });
  /* a card's clip (Learn → Video), for the ▶ on word cards */
  const clipByWord = useMemo(() => {
    const m = {};
    (clips || []).forEach((c) => { const w = lwFindCardForClip(c, words); if (w && !m[w.id]) m[w.id] = c; });
    return m;
  }, [clips, words]);
  const [clipOpen, setClipOpen] = useState(null);
  const [wordModal, setWordModal] = useState(null); // {mode, initial?, groupId?}
  const [groupModal, setGroupModal] = useState(null); // {mode, initial?, parentGroup?}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);
  const [query, setQuery] = useState('');
  /* Words view filters; remembered on this device */
  const [lib, setLib] = useState(() => ({
    view: 'words', status: 'all', groupId: '', sort: 'recent', collocOwner: 'all', collocSort: 'az',
    ...(lwLoad(LW_KEYS.library, null) || {}),
  }));
  const setLibField = (k, v) => { setLib((l) => ({ ...l, [k]: v })); setLimit(LW_LIB_PAGE); };
  useEffect(() => { lwSave(LW_KEYS.library, lib); }, [lib]);
  const [limit, setLimit] = useState(LW_LIB_PAGE);
  const [practice, setPractice] = useState(null); // word being practised from the word of the day
  const [tagState, setTagState] = useState({ busy: false, done: 0, error: null });
  const [keyModal, setKeyModal] = useState(false);
  const [collocForm, setCollocForm] = useState(null); // { initial? } — create / edit form
  const [collocOpen, setCollocOpen] = useState(null); // id of the entry shown in the sheet
  const [collocDelete, setCollocDelete] = useState(null); // entry awaiting delete confirmation
  const wordsById = useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  const canEditColloc = (e) => (e.shared ? isAdmin : e.userId === userId);
  const submitColloc = (entry, phrases, newPhrases) => {
    setCollocForm(null);
    saveCollocation(entry, phrases, newPhrases)
      .then((doc) => setCollocOpen(doc.id))
      .catch((e) => pushToast({ kind: 'error', title: 'Could not save the collocation', msg: (e && e.message) || String(e) }));
  };

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const topGroups = groups.filter((g) => !g.parentId);
  const subGroupsOf = (id) => groups.filter((g) => g.parentId === id);
  const groupById = (id) => groups.find((g) => g.id === id);

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? words.filter((w) => w.word.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q)))
    : null;

  const canEdit = (item) => item.userId === userId || isAdmin;

  /* ---- Words view: group + search + status filters, sort, paging ---- */
  const statusOf = (w) => lwWordStatus(progress[w.id], now);
  const groupScope = lib.groupId ? [lib.groupId, ...subGroupsOf(lib.groupId).map((g) => g.id)] : null;
  const scoped = words.filter((w) => (!groupScope || groupScope.includes(w.groupId))
    && (!q || w.word.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q)) || (w.pos && w.pos.includes(q))));
  const statusCounts = { all: scoped.length, new: 0, learning: 0, review: 0, mastered: 0 };
  scoped.forEach((w) => { statusCounts[statusOf(w)]++; });
  const dueKey = (w) => {
    const p = progress[w.id];
    if (!p) return now + 1e12; // new: after everything scheduled
    if (p.due > now && lwWordStatus(p, now) === 'mastered') return now + 2e12; // mastered and not due: last
    return p.due;
  };
  const filtered = scoped.filter((w) => lib.status === 'all' || statusOf(w) === lib.status).sort(
    lib.sort === 'az' ? (a, b) => a.word.localeCompare(b.word)
      : lib.sort === 'due' ? (a, b) => dueKey(a) - dueKey(b)
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.word.localeCompare(b.word));
  const mastered = words.filter((w) => statusOf(w) === 'mastered').length;
  const filtersOn = lib.status !== 'all' || !!lib.groupId || !!q;

  /* word of the day: chosen once per day and remembered, so it doesn't change while you study */
  const today = lwLocalDate(now);
  const wotd = useMemo(() => {
    const saved = lwLoad(LW_KEYS.wotd, null);
    const keep = saved && saved.date === today && words.find((w) => w.id === saved.wordId);
    if (keep) return keep;
    const w = lwWordOfTheDay(words, progress, today, now);
    if (w) lwSave(LW_KEYS.wotd, { date: today, wordId: w.id });
    return w;
    // eslint-disable-next-line
  }, [words, today]);

  /* tag parts of speech for words without one (only words this user may edit) */
  const untagged = words.filter((w) => !w.pos && canEdit(w));
  const tagPos = async () => {
    if (!lwHasGeminiKey()) { setKeyModal(true); return; }
    const todo = untagged.slice();
    setTagState({ busy: true, done: 0, error: null });
    try {
      for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50);
        const tags = await lwAiTagPos(batch.map((w) => w.word));
        const byWord = {};
        tags.forEach((t) => { byWord[t.word.toLowerCase()] = t.pos; });
        await Promise.all(batch.filter((w) => byWord[w.word.toLowerCase()])
          .map((w) => lwSetDoc(LW_COLLECTIONS.words, { ...w, pos: byWord[w.word.toLowerCase()] })));
        setTagState({ busy: true, done: Math.min(i + 50, todo.length), error: null });
      }
      setTagState({ busy: false, done: todo.length, error: null });
    } catch (e) {
      setTagState((t) => ({ ...t, busy: false, error: (e && e.code) || 'error' }));
    }
  };

  const saveWord = (w) => {
    // Существующее слово определяем по наличию в списке, а не по w.id — форма
    // всегда генерирует id, в т.ч. для новых слов, где userId/username ещё нет.
    const existing = words.find((x) => x.id === w.id);
    const shared = existing ? existing.shared : isAdmin;
    // legacy-документы могут не иметь userId/username — тогда назначаем владельцем
    // текущего пользователя, иначе слово выпадет из выборки where('userId','==',uid).
    lwSetDoc(LW_COLLECTIONS.words, { ...w, userId: (existing && existing.userId) || userId, username: (existing && existing.username) || username, shared })
      .catch((e) => { console.error('saveWord failed', e); alert('Could not save the word: ' + (e && e.message || e)); });
    setWordModal(null);
  };
  const saveGroup = (g) => {
    const existing = groups.find((x) => x.id === g.id);
    const shared = existing ? existing.shared : isAdmin;
    lwSetDoc(LW_COLLECTIONS.groups, { ...g, userId: (existing && existing.userId) || userId, username: (existing && existing.username) || username, shared })
      .catch((e) => { console.error('saveGroup failed', e); alert('Could not save the group: ' + (e && e.message || e)); });
    if (!openGroups.includes(g.id)) setOpenGroups((o) => [...o, g.id]);
    if (g.parentId && !openGroups.includes(g.parentId)) setOpenGroups((o) => [...o, g.parentId]);
    setGroupModal(null);
  };
  const doDelete = () => {
    if (!confirm) return;
    let deletedWordIds = [];
    if (confirm.kind === 'word') {
      lwDeleteDoc(LW_COLLECTIONS.words, confirm.id);
      deletedWordIds = [confirm.id];
    }
    if (confirm.kind === 'group') {
      const ids = [confirm.id, ...subGroupsOf(confirm.id).map((sg) => sg.id)];
      ids.forEach((id) => {
        lwDeleteDoc(LW_COLLECTIONS.groups, id);
        lwDeleteWordsByGroup(id, isAdmin ? null : userId);
      });
      deletedWordIds = words.filter((w) => ids.includes(w.groupId)).map((w) => w.id);
    }
    /* drop this user's progress for the deleted words (others' progress on a
       deleted shared word is left as orphans that the app ignores) */
    const withProgress = deletedWordIds.filter((id) => progress[id]);
    if (withProgress.length) {
      lwDeleteProgressForWords(userId, withProgress)
        .catch((e) => console.error('delete progress failed', e));
    }
    setConfirm(null);
  };

  const groupLabel = (g) => {
    const parent = g.parentId ? groupById(g.parentId) : null;
    return parent ? parent.name + ' / ' + g.name : g.name;
  };
  const orderedGroups = topGroups.flatMap((g) => [g, ...subGroupsOf(g.id)]);
  const hasLeafGroup = lwLeafGroups(groups).length > 0;

  const renderWords = (items, hue, showEmptyHint = true, showGroup = false) => (
    <div className="word-rows">
      {items.length === 0 && showEmptyHint && <div className="row-empty">No words yet — add the first one.</div>}
      {items.map((w) => {
        const g = showGroup ? groupById(w.groupId) : null;
        return (
          <div className="wrow" key={w.id}>
            <div className="wrow-thumb">{w.photo ? <img className="card-photo-img" src={w.photo} alt="" /> : <PhotoFill word={w.word} hue={showGroup ? (g ? g.color : hue) : hue} />}</div>
            <div className="wrow-main">
              <div className="wrow-top"><span className="wrow-word">{w.word}</span><span className="wrow-ipa">{w.ipa}</span></div>
              <div className="wrow-tr">{w.tr}</div>
              {showGroup && g && <div className="wrow-group">{g.name}</div>}
            </div>
            {canEdit(w) && (
              <div className="wrow-tools">
                <button className="icon-btn sm" onClick={() => setWordModal({ mode: 'edit', initial: w })} aria-label="Edit"><Ic.Edit /></button>
                <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} aria-label="Delete"><Ic.Trash /></button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="library">
      <div className="lib-intro">
        <div>
          <h1 className="lib-title">Library</h1>
          <p className="lib-sub">{words.length} words · {mastered} mastered · {topGroups.length} {topGroups.length === 1 ? 'group' : 'groups'}</p>
        </div>
        <div className="seg lib-views">
          <button type="button" className={'seg-btn' + (lib.view === 'words' ? ' on' : '')} onClick={() => setLibField('view', 'words')}>Words</button>
          <button type="button" className={'seg-btn' + (lib.view === 'groups' ? ' on' : '')} onClick={() => setLibField('view', 'groups')}>Groups</button>
          <button type="button" className={'seg-btn' + (lib.view === 'colloc' ? ' on' : '')} onClick={() => setLibField('view', 'colloc')}>Collocations</button>
        </div>
      </div>
      <div className="lib-head">
        <div className="lib-search">
          <Ic.Search className="lib-search-icon" />
          <input className="input" type="text" placeholder={lib.view === 'colloc' ? 'Search collocations…' : 'Search words or translations…'}
            value={query} onChange={(e) => { setQuery(e.target.value); setLimit(LW_LIB_PAGE); }} />
        </div>
        <div className="lib-head-actions">
          {lib.view !== 'colloc' && <button className="btn btn-soft" onClick={goImport}><Ic.Plus /> Import</button>}
          {lib.view === 'colloc' ? (
            <button className="btn btn-primary lib-add-word" onClick={() => setCollocForm({})}><Ic.Plus /> New collocation</button>
          ) : lib.view === 'groups' ? (
            <button className="btn btn-primary" onClick={() => setGroupModal({ mode: 'new' })}><Ic.Plus /> New group</button>
          ) : hasLeafGroup && (
            <button className="btn btn-primary lib-add-word" onClick={() => setWordModal({ mode: 'new' })}><Ic.Plus /> Add word</button>
          )}
        </div>
      </div>

      {lib.view === 'colloc' ? (
        <CollocCatalog entries={collocations} wordsById={wordsById} userId={userId} query={q}
          owner={lib.collocOwner} sort={lib.collocSort} setLibField={setLibField} limit={limit} setLimit={setLimit}
          onOpen={(e) => setCollocOpen(e.id)} onNew={() => setCollocForm({})} />
      ) : lib.view === 'words' ? (
        <div className="words-pane">
          {wotd && !filtersOn && <WordOfTheDay word={wotd} onPractice={() => setPractice(wotd)} />}

          <div className="lib-filters">
            <div className="status-chips">
              {LW_LIB_STATUSES.map((st) => (
                <button key={st} type="button" className={'chip' + (lib.status === st ? ' chip-on' : '')}
                  onClick={() => setLibField('status', st)}>
                  {st === 'all' ? 'All' : LW_STATUS_LABEL[st]} <span className="chip-count">{statusCounts[st]}</span>
                </button>
              ))}
            </div>
            <div className="lib-selects">
              <select className="input input-sm" value={lib.groupId} onChange={(e) => setLibField('groupId', e.target.value)} aria-label="Group">
                <option value="">All groups</option>
                {orderedGroups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
              </select>
              <select className="input input-sm" value={lib.sort} onChange={(e) => setLibField('sort', e.target.value)} aria-label="Sort">
                {LW_LIB_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {untagged.length > 0 && (
            <div className="tag-pos">
              <span>{tagState.busy ? 'Tagging parts of speech… ' + tagState.done + ' / ' + untagged.length
                : untagged.length + (untagged.length === 1 ? ' word has' : ' words have') + ' no part of speech.'}</span>
              <button type="button" className="btn btn-soft sm" disabled={tagState.busy} onClick={tagPos}>
                {tagState.busy ? <span className="spinner" /> : <Ic.Bulb width="15" height="15" />} Tag with AI
              </button>
              {tagState.error && <span className="tag-pos-error">{LW_IMPORT_ERROR_MSG[tagState.error] || LW_IMPORT_ERROR_MSG.error}</span>}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-card lib-empty">
              <Ic.Search width="26" height="26" />
              <p className="empty-title">{words.length === 0 ? 'No words yet' : 'No words match'}</p>
              <p className="empty-sub">{words.length === 0 ? 'Add your first word or import a list.' : 'Try another filter or search.'}</p>
              {words.length === 0 ? (
                <button className="btn btn-primary" onClick={goImport}><Ic.Plus /> Import words</button>
              ) : (
                <button className="btn btn-soft" onClick={() => { setQuery(''); setLib((l) => ({ ...l, status: 'all', groupId: '' })); }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="wcards">
              {filtered.slice(0, limit).map((w) => (
                <WordCard key={w.id} word={w} group={groupById(w.groupId)} prog={progress[w.id]} now={now}
                  clip={clipByWord[w.id]} onClip={() => setClipOpen(clipByWord[w.id])}
                  canEdit={canEdit(w)} onEdit={() => setWordModal({ mode: 'edit', initial: w })}
                  onDelete={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} />
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <button type="button" className="btn btn-soft lib-more" onClick={() => setLimit((n) => n + LW_LIB_PAGE)}>
              Show more ({filtered.length - limit})
            </button>
          )}
          {hasLeafGroup && (
            <button type="button" className="fab" onClick={() => setWordModal({ mode: 'new' })} aria-label="Add word"><Ic.Plus width="24" height="24" /></button>
          )}
        </div>
      ) : searchResults ? (
        <div className="search-results">
          {searchResults.length === 0
            ? <div className="row-empty">No words match "{query.trim()}".</div>
            : renderWords(searchResults, null, false, true)}
        </div>
      ) : (
      <div className="groups-list">
        {topGroups.map((g) => {
          const items = words.filter((w) => w.groupId === g.id);
          const subGroups = subGroupsOf(g.id);
          const subWordCount = subGroups.reduce((sum, sg) => sum + words.filter((w) => w.groupId === sg.id).length, 0);
          const open = openGroups.includes(g.id);
          return (
            <section className="grp" key={g.id}>
              <header className="grp-head">
                <button className="grp-toggle" onClick={() => toggleOpen(g.id)}>
                  <Ic.Chevron style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                  <span className="grp-dot" style={{ background: g.color }} />
                  <span className="grp-name">{g.name}</span>
                  <span className="grp-count">{items.length + subWordCount}</span>
                  {pausedSelf(g.id) && <span className="grp-paused"><Ic.Pause width="11" height="11" /> Paused</span>}
                </button>
                <div className="grp-tools">
                  <ActionsMenu items={[
                    pauseItem(g),
                    ...(subGroups.length === 0 ? [
                      { label: 'Word', icon: <Ic.Plus width="15" height="15" />, onClick: () => setWordModal({ mode: 'new', groupId: g.id }) },
                    ] : []),
                    ...(items.length === 0 ? [
                      { label: 'Subgroup', icon: <Ic.Plus width="15" height="15" />, onClick: () => setGroupModal({ mode: 'new', parentGroup: g }) },
                    ] : []),
                    ...(canEdit(g) ? [
                      { label: 'Edit group', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: g }) },
                      { label: 'Delete group', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: g.id, label: g.name }) },
                    ] : []),
                  ]} />
                </div>
              </header>
              {open && (
                <div className="grp-body">
                  {renderWords(items, g.color, subGroups.length === 0)}
                  {subGroups.map((sg) => {
                    const subItems = words.filter((w) => w.groupId === sg.id);
                    const subOpen = openGroups.includes(sg.id);
                    return (
                      <section className="grp grp-sub" key={sg.id}>
                        <header className="grp-head">
                          <button className="grp-toggle" onClick={() => toggleOpen(sg.id)}>
                            <Ic.Chevron style={{ transform: subOpen ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                            <span className="grp-dot" style={{ background: sg.color }} />
                            <span className="grp-name">{sg.name}</span>
                            <span className="grp-count">{subItems.length}</span>
                            {(pausedSelf(sg.id) || pausedSelf(g.id)) && <span className="grp-paused"><Ic.Pause width="11" height="11" /> Paused</span>}
                          </button>
                          <div className="grp-tools">
                            <ActionsMenu items={[
                              ...(pausedSelf(g.id) ? [] : [pauseItem(sg)]),
                              { label: 'Word', icon: <Ic.Plus width="15" height="15" />, onClick: () => setWordModal({ mode: 'new', groupId: sg.id }) },
                              ...(canEdit(sg) ? [
                                { label: 'Edit subgroup', icon: <Ic.Edit />, onClick: () => setGroupModal({ mode: 'edit', initial: sg }) },
                                { label: 'Delete subgroup', icon: <Ic.Trash />, danger: true, onClick: () => setConfirm({ kind: 'group', id: sg.id, label: sg.name }) },
                              ] : []),
                            ]} />
                          </div>
                        </header>
                        {subOpen && renderWords(subItems, sg.color)}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      )}

      {collocOpen && collocations.some((e) => e.id === collocOpen) && (() => {
        const entry = collocations.find((e) => e.id === collocOpen);
        return (
          <CollocSheet entry={entry} wordsById={wordsById} canEdit={canEditColloc(entry)}
            onEdit={() => { setCollocOpen(null); setCollocForm({ initial: entry }); }}
            onDelete={() => { setCollocOpen(null); setCollocDelete(entry); }}
            onClose={() => setCollocOpen(null)} />
        );
      })()}
      {collocForm && (
        <Modal title={collocForm.initial ? 'Edit collocation' : 'New collocation'} onClose={() => setCollocForm(null)}>
          <CollocForm initial={collocForm.initial} words={words} entries={collocations} isAdmin={isAdmin} userId={userId}
            onSave={submitColloc} onCancel={() => setCollocForm(null)}
            onOpenExisting={(e) => { setCollocForm(null); setCollocOpen(e.id); }} />
        </Modal>
      )}
      {collocDelete && (
        <Modal title="Delete collocation" onClose={() => setCollocDelete(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setCollocDelete(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => {
              const e = collocDelete;
              setCollocDelete(null);
              lwDeleteDoc(LW_COLLECTIONS.collocations, e.id)
                .catch((err) => pushToast({ kind: 'error', title: 'Could not delete', msg: (err && err.message) || String(err) }));
            }}>Delete</button>
          </>}>
          <p className="confirm-text">Delete collocations for <strong>{collocDelete.word}</strong>{collocDelete.shared ? ' for everyone' : ''}? The phrase cards stay in your words.</p>
        </Modal>
      )}
      {clipOpen && <ClipModal clip={clipOpen} onClose={() => setClipOpen(null)} />}
      {practice && (
        <PracticeCardModal word={practice} group={groupById(practice.groupId)} prog={progress[practice.id]}
          direction={direction} recordAnswer={recordAnswer} onClose={() => setPractice(null)} />
      )}
      {keyModal && <GeminiKeyModal onClose={() => setKeyModal(false)} onSaved={(ok) => { if (ok) tagPos(); }} />}
      {wordModal && (
        <Modal title={wordModal.mode === 'edit' ? 'Edit word' : 'New word'} onClose={() => setWordModal(null)}>
          <WordForm initial={wordModal.initial} groups={groups} defaultGroupId={wordModal.groupId}
            onSave={saveWord} onCancel={() => setWordModal(null)} />
        </Modal>
      )}
      {groupModal && (
        <Modal title={groupModal.mode === 'edit' ? 'Edit group' : (groupModal.parentGroup ? 'New subgroup' : 'New group')} onClose={() => setGroupModal(null)}>
          <GroupForm initial={groupModal.initial} parentGroup={groupModal.parentGroup} onSave={saveGroup} onCancel={() => setGroupModal(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title={'Delete ' + confirm.kind} onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={doDelete}>Delete</button>
          </>}>
          <p className="confirm-text">
            Delete <strong>{confirm.label}</strong>{confirm.kind === 'group' ? ' and all its words' : ''}? This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

export {
  LibraryView,
};
