/* admin.jsx — Admin: users and roles, all data. */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LW_COLLECTIONS, lwAdminFetchAllData, lwAdminFetchUsers, lwAdminSetRole, lwDeleteDoc,
  lwDeleteWordsByGroup, lwSetDoc,
} from '../firebase.js';
import { lwDocLang } from '../data.js';
import { Ic, Modal, WordForm } from '../components.jsx';
import { LW_ROLE_LABEL } from './shared.jsx';
import { GroupForm } from './shell.jsx';

/* ---------------- Admin view ---------------- */
const LW_ROLES = ['user', 'premium', 'admin'];

function AdminView({ currentUid }) {
  const [tab, setTab] = useState('users'); // 'users' | 'data'
  const [users, setUsers] = useState(null); // null = loading
  const [allData, setAllData] = useState(null); // null = loading, {groups, words}
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const loadUsers = useCallback(() => {
    setError('');
    lwAdminFetchUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users.'));
  }, []);

  const loadAllData = useCallback(() => {
    setError('');
    lwAdminFetchAllData()
      .then(setAllData)
      .catch(() => setError('Could not load words and groups.'));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === 'data' && !allData) loadAllData(); }, [tab, allData, loadAllData]);

  const changeRole = async (uid, role) => {
    setSavingId(uid);
    try {
      await lwAdminSetRole(uid, role);
      setUsers((list) => list.map((u) => (u.id === uid ? { ...u, role } : u)));
    } catch (e) {
      setError('Could not change the role.');
    } finally {
      setSavingId(null);
    }
  };

  const reload = tab === 'users' ? loadUsers : loadAllData;

  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h1 className="lib-title">Admin</h1>
          <p className="lib-sub">{tab === 'users' ? 'Users and roles' : 'All words and groups'}</p>
        </div>
        <div className="lib-head-actions">
          <div className="seg">
            <button className={'seg-btn' + (tab === 'users' ? ' on' : '')} onClick={() => setTab('users')} type="button">Users</button>
            <button className={'seg-btn' + (tab === 'data' ? ' on' : '')} onClick={() => setTab('data')} type="button">All words and groups</button>
          </div>
          <button className="btn btn-soft" onClick={reload} type="button"><Ic.Shuffle /> Refresh</button>
        </div>
      </div>
      {error && <p className="field-hint" style={{ color: 'var(--error)' }}>{error}</p>}
      {tab === 'users' ? (
        users === null ? (
          <p className="row-empty">Loading…</p>
        ) : (
          <div className="groups-list">
            {users.map((u) => (
              <section className="grp" key={u.id}>
                <header className="grp-head">
                  <div className="grp-toggle" style={{ flex: 1 }}>
                    <span className="grp-name">{u.username || u.id}</span>
                    <span className="grp-count">{u.wordCount} words · {u.groupCount} groups</span>
                  </div>
                  <div className="grp-tools">
                    <select className="input sm" value={u.role || 'user'} disabled={u.id === currentUid || savingId === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{ width: 'auto', padding: '7px 10px' }}>
                      {LW_ROLES.map((r) => (
                        <option key={r} value={r}>{LW_ROLE_LABEL[r] || r}</option>
                      ))}
                    </select>
                  </div>
                </header>
              </section>
            ))}
            {users.length === 0 && <p className="row-empty">No users yet.</p>}
          </div>
        )
      ) : (
        <AdminAllDataView data={allData} onChanged={loadAllData} />
      )}
    </div>
  );
}

function AdminAllDataView({ data, onChanged }) {
  const [wordModal, setWordModal] = useState(null); // {initial}
  const [groupModal, setGroupModal] = useState(null); // {initial}
  const [confirm, setConfirm] = useState(null); // {kind, id, label}
  const [openGroups, setOpenGroups] = useState([]);

  const toggleOpen = (id) => setOpenGroups((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

  const words = data ? data.words : [];
  const wordsByGroup = useMemo(() => {
    const m = {};
    words.forEach((w) => { (m[w.groupId] = m[w.groupId] || []).push(w); });
    return m;
  }, [words]);

  if (!data) return <p className="row-empty">Loading…</p>;
  const { groups } = data;
  const ownerLabel = (item) => item.username || item.userId || '—';

  const saveWord = (w) => {
    lwSetDoc(LW_COLLECTIONS.words, { ...w, userId: wordModal.initial.userId, username: wordModal.initial.username, shared: wordModal.initial.shared,
      lang: lwDocLang(groups.find((g) => g.id === w.groupId) || wordModal.initial) });
    setWordModal(null);
    onChanged();
  };
  const saveGroup = (g) => {
    lwSetDoc(LW_COLLECTIONS.groups, { ...g, userId: groupModal.initial.userId, username: groupModal.initial.username, shared: groupModal.initial.shared,
      lang: lwDocLang(groups.find((x) => x.id === (g.parentId || g.id)) || groupModal.initial) });
    setGroupModal(null);
    onChanged();
  };
  const doDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'word') lwDeleteDoc(LW_COLLECTIONS.words, confirm.id);
    if (confirm.kind === 'group') {
      const subGroupIds = groups.filter((sg) => sg.parentId === confirm.id).map((sg) => sg.id);
      [confirm.id, ...subGroupIds].forEach((id) => {
        lwDeleteDoc(LW_COLLECTIONS.groups, id);
        lwDeleteWordsByGroup(id);
      });
    }
    setConfirm(null);
    onChanged();
  };

  /* admins see every language here: writes keep each doc's own (legacy docs: English) */
  const makeWordShared = (w) => {
    lwSetDoc(LW_COLLECTIONS.words, { ...w, shared: true, lang: lwDocLang(w) });
    onChanged();
  };
  const makeGroupShared = (g) => {
    const subGroupIds = groups.filter((sg) => sg.parentId === g.id).map((sg) => sg.id);
    [g, ...groups.filter((sg) => subGroupIds.includes(sg.id))].forEach((grp) => {
      lwSetDoc(LW_COLLECTIONS.groups, { ...grp, shared: true, lang: lwDocLang(grp) });
    });
    [g.id, ...subGroupIds].forEach((groupId) => {
      (wordsByGroup[groupId] || []).forEach((w) => {
        lwSetDoc(LW_COLLECTIONS.words, { ...w, shared: true, lang: lwDocLang(w) });
      });
    });
    onChanged();
  };

  if (groups.length === 0) return <p className="row-empty">No groups yet.</p>;

  return (
    <div className="groups-list">
      {groups.map((g) => {
        const open = openGroups.includes(g.id);
        return (
        <section className="grp" key={g.id}>
          <header className="grp-head">
            <button className="grp-toggle" onClick={() => toggleOpen(g.id)}>
              <Ic.Chevron style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
              <span className="grp-name">{g.name}</span>
              <span className="grp-count">{(wordsByGroup[g.id] || []).length} words · added by {ownerLabel(g)}</span>
            </button>
            <div className="grp-tools">
              {!g.shared && <button className="btn btn-soft sm" onClick={() => makeGroupShared(g)} type="button">Make shared</button>}
              <button className="icon-btn sm" onClick={() => setGroupModal({ initial: g })} aria-label="Edit"><Ic.Edit /></button>
              <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'group', id: g.id, label: g.name })} aria-label="Delete"><Ic.Trash /></button>
            </div>
          </header>
          {open && (
          <div className="word-rows">
            {(wordsByGroup[g.id] || []).map((w) => (
              <div className="wrow" key={w.id}>
                <div className="wrow-main">
                  <div className="wrow-top">
                    <span className="wrow-word">{w.word}</span>
                    {w.tr && <span className="wrow-tr">{w.tr}</span>}
                  </div>
                </div>
                <span className="grp-count">added by {ownerLabel(w)}</span>
                <div className="wrow-tools">
                  {!w.shared && <button className="btn btn-soft sm" onClick={() => makeWordShared(w)} type="button">Make shared</button>}
                  <button className="icon-btn sm" onClick={() => setWordModal({ initial: w })} aria-label="Edit"><Ic.Edit /></button>
                  <button className="icon-btn sm danger" onClick={() => setConfirm({ kind: 'word', id: w.id, label: w.word })} aria-label="Delete"><Ic.Trash /></button>
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
        );
      })}

      {wordModal && (
        <Modal title="Edit word" onClose={() => setWordModal(null)}>
          <WordForm initial={wordModal.initial} groups={groups} onSave={saveWord} onCancel={() => setWordModal(null)} />
        </Modal>
      )}
      {groupModal && (
        <Modal title="Edit group" onClose={() => setGroupModal(null)}>
          <GroupForm initial={groupModal.initial} onSave={saveGroup} onCancel={() => setGroupModal(null)} />
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
  AdminView,
};
