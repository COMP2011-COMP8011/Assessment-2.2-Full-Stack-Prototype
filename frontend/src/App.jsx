import { useCallback, useEffect, useState } from 'react';
import { usersApi } from './api/endpoints.js';
import FabMenu from './components/FabMenu.jsx';
import PartyModal from './components/PartyModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import TaskModal from './components/TaskModal.jsx';
import Toast from './components/Toast.jsx';
import { useApiHealth } from './hooks/useApiHealth.js';
import { useAudioCues } from './hooks/useAudioCues.js';
import { usePolling } from './hooks/usePolling.js';
import { useSession } from './hooks/useSession.js';
import { useTaskParty } from './hooks/useTaskParty.js';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PartyPage from './pages/PartyPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

const PARTY_POLL_MS = 10_000;
const DASHBOARD_POLL_MS = 30_000;

/**
 * App = routing + orchestration. Screens live in /pages, reusable UI in /components,
 * server state in /hooks (useSession, useTaskParty) and pure rules in /logic.
 * Components never call the API directly.
 */
export default function App() {
  const session = useSession();
  if (!session.user) return <AuthScreens session={session} />;
  // Keyed by user so signing in as someone else starts with fresh state.
  return <TaskPartyApp key={session.user._id} session={session} />;
}

function AuthScreens({ session }) {
  const [mode, setMode] = useState('login');
  const health = useApiHealth();
  const audio = useAudioCues(true);

  useEffect(() => {
    document.documentElement.classList.remove('high-contrast');
  }, []);

  return mode === 'login' ? (
    <LoginPage
      health={health}
      notice={session.notice}
      onLogin={session.login}
      onShowRegister={() => {
        session.clearNotice();
        setMode('register');
      }}
      onError={audio.error}
    />
  ) : (
    <RegisterPage health={health} onRegister={session.register} onShowLogin={() => setMode('login')} onError={audio.error} />
  );
}

function TaskPartyApp({ session }) {
  const { user, updateUser, logout } = session;
  const store = useTaskParty(user);
  const audio = useAudioCues(user.settings.audioEnabled);
  const [view, setView] = useState({ name: 'dashboard', partyId: null }); // dashboard | party | profile
  const [modal, setModal] = useState(null); // { type: 'task', partyId, pickParty, task?, draft?, error? } | { type: 'party' }
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(false);

  const notify = useCallback((message, tone = 'info') => setToast({ message, tone, id: Date.now() }), []);
  const fail = useCallback(
    (error, fallback) => {
      audio.error(); // Assessment 1 §2.3: double beep when an API error occurs
      notify(error?.message || fallback, 'error');
    },
    [audio, notify],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.tone === 'error' ? 7000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', !!user.settings.highContrastMode);
  }, [user.settings.highContrastMode]);

  // Re-read the profile once (keeps settings and XP current if they changed elsewhere).
  useEffect(() => {
    usersApi.me().then(({ user: fresh }) => updateUser(fresh)).catch(() => {});
  }, [updateUser]);

  const ready = store.status === 'ready';
  const activeParty = view.name === 'party' ? store.parties.find((p) => p._id === view.partyId) : null;

  // ---- Navigation (Assessment 1 §2.3: "whoosh" when switching parties or opening/closing dialogs)
  const go = useCallback(
    (next) => {
      setView(next);
      audio.navigate();
    },
    [audio],
  );
  const goHome = useCallback(() => go({ name: 'dashboard', partyId: null }), [go]);
  const openParty = useCallback((partyId) => go({ name: 'party', partyId }), [go]);
  const openProfile = useCallback(() => go({ name: 'profile', partyId: null }), [go]);

  const openModal = useCallback(
    (next) => {
      setModal(next);
      audio.navigate();
    },
    [audio],
  );
  const closeModal = useCallback(() => {
    setModal(null);
    audio.navigate();
  }, [audio]);

  // ---- Keeping the UI in sync with the database ---------------------------------------
  /**
   * Re-reads a party. `conflictTaskId` is set after a 409 ("already completed"): that quest is
   * then reported as the error it is, naming who completed it, instead of as teammate news.
   */
  const syncParty = useCallback(
    async (partyId, { conflictTaskId } = {}) => {
      try {
        const { completedByOthers, members = [] } = await store.refreshParty(partyId);
        setOffline(false);
        const nameOf = (userId) => members.find((m) => m._id === userId)?.displayName || 'A teammate';
        const conflict = completedByOthers.find((t) => t._id === conflictTaskId);
        if (conflict) notify(`${nameOf(conflict.completedBy)} already completed “${conflict.title}”.`, 'error');
        const news = completedByOthers.filter((t) => t._id !== conflictTaskId);
        if (news.length && user.settings.notificationsEnabled) {
          const [first] = news;
          const more = news.length > 1 ? ` and ${news.length - 1} more` : '';
          audio.taskCompleted(); // §2.3: also play the cue when another member completes a quest
          notify(`${nameOf(first.completedBy)} completed “${first.title}” (+${first.pointValue} XP)${more}.`);
        }
      } catch (error) {
        if (error.isNetworkError) {
          setOffline(true);
        } else if (error.status === 403 || error.status === 404) {
          store.forgetParty(partyId);
          setView({ name: 'dashboard', partyId: null });
          notify('That party is no longer available to you.', 'error');
        }
      }
    },
    [store, user.settings.notificationsEnabled, audio, notify],
  );

  const syncAll = useCallback(async () => {
    try {
      await store.loadAll();
      setOffline(false);
    } catch (error) {
      if (error.isNetworkError) setOffline(true);
    }
  }, [store]);

  useEffect(() => {
    if (view.name === 'party' && ready) syncParty(view.partyId);
    // Only when the user opens a party (not on every store change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.name, view.partyId, ready]);

  usePolling(() => syncParty(view.partyId), { intervalMs: PARTY_POLL_MS, enabled: view.name === 'party' && ready });
  usePolling(syncAll, { intervalMs: DASHBOARD_POLL_MS, enabled: view.name === 'dashboard' && ready });

  // If the open party disappears (deleted elsewhere), go back to the dashboard.
  useEffect(() => {
    if (view.name === 'party' && ready && !activeParty) setView({ name: 'dashboard', partyId: null });
  }, [view.name, ready, activeParty]);

  // ---- Quest actions (optimistic: see hooks/useTaskParty.js) ----------------------------
  async function handleComplete(taskId) {
    const result = await store.completeTask(taskId);
    if (result.skipped) return;
    if (!result.ok) {
      fail(result.error, "Couldn't complete that quest.");
      if (result.error?.status === 409) syncParty(result.partyId, { conflictTaskId: taskId });
      return;
    }
    audio.taskCompleted(); // played once the server has confirmed the completion
    if (result.totalXpEarned !== undefined) updateUser((u) => ({ ...u, totalXpEarned: result.totalXpEarned }));
    notify(result.levelledUp ? `Quest complete. +${result.pointGain} XP — level up!` : `Quest complete. +${result.pointGain} XP`);
  }

  async function handleMove(taskId, status) {
    const result = await store.moveTask(taskId, status);
    if (!result.ok && !result.skipped) {
      fail(result.error, "Couldn't move that quest.");
      syncParty(result.partyId);
    }
  }

  async function handleDelete(taskId) {
    const task = store.tasks.find((t) => t._id === taskId);
    if (!task || !window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    const result = await store.deleteTask(taskId);
    if (result.ok) {
      audio.taskDeleted(); // §2.3: "thud" after the user confirms deletion
      notify('Quest deleted.');
    } else if (!result.skipped) {
      fail(result.error, "Couldn't delete that quest.");
    }
  }

  /** Create or edit from the quest dialog. The dialog closes at once; on failure it reopens. */
  async function handleSaveTask(fields, partyId) {
    const current = modal;
    const editing = current.task;
    closeModal();
    const result = editing ? await store.updateTask(editing._id, fields) : await store.createTask(partyId, fields);
    if (result.ok) {
      const where = current.pickParty ? ` in ${store.parties.find((p) => p._id === partyId)?.name ?? 'your party'}` : '';
      notify(editing ? 'Quest updated.' : `Quest created${where}.`);
    } else if (!result.skipped) {
      fail(result.error, editing ? "Couldn't save your changes." : "Couldn't create the quest.");
      setModal({ ...current, partyId, draft: fields, error: result.error }); // reopen with what they typed
    }
  }

  // ---- Party, profile and settings actions ---------------------------------------------
  async function handleCreateParty(fields) {
    const party = await store.createParty(fields); // PartyModal shows errors in place
    setModal(null);
    notify('Party created. Invite your teammates by email.');
    openParty(party._id);
  }

  async function handleInvite(email) {
    const party = await store.addMember(activeParty._id, email);
    return party.recentMembers[0]?.displayName ?? 'They'; // the newest member comes first
  }

  async function handleLeaveOrDelete() {
    const owner = activeParty.createdBy === user._id;
    const question = owner
      ? `Delete "${activeParty.name}" and all of its quests for everyone? This can't be undone.`
      : `Leave "${activeParty.name}"? You'll lose access to its quests.`;
    if (!window.confirm(question)) return;
    try {
      if (owner) await store.deleteParty(activeParty._id);
      else await store.leaveParty(activeParty._id);
      if (owner) audio.taskDeleted();
      notify(owner ? 'Party deleted.' : 'You left the party.');
      goHome();
    } catch (error) {
      fail(error, owner ? "Couldn't delete the party." : "Couldn't leave the party.");
    }
  }

  async function handlePreferences(patch) {
    const previous = user.settings;
    updateUser((u) => ({ ...u, settings: { ...u.settings, ...patch } })); // instant feedback
    try {
      const { user: saved } = await usersApi.updateMe({ settings: patch });
      updateUser(saved);
    } catch (error) {
      updateUser((u) => ({ ...u, settings: previous }));
      fail(error, "Couldn't save that setting.");
    }
  }

  async function handleSaveProfile(changes) {
    const { user: saved } = await usersApi.updateMe(changes); // ProfilePage shows errors in place
    updateUser(saved);
    store.reloadAfterProfileChange(); // parties and quests cache your name and avatar
  }

  // ---- Render -----------------------------------------------------------------------------
  let content;
  if (store.status === 'error') {
    content = (
      <div className="status-screen notice notice-error" role="alert">
        <p><strong>Couldn't load your parties.</strong> {store.loadError?.message}</p>
        <button type="button" className="btn btn-ghost" onClick={store.retry}>Try again</button>
      </div>
    );
  } else if (view.name === 'profile') {
    content = (
      <ProfilePage
        user={user}
        partyCount={store.parties.length}
        onSaveProfile={handleSaveProfile}
        onPreferences={handlePreferences}
        onLogout={logout}
        onError={audio.error}
      />
    );
  } else if (activeParty) {
    content = (
      <PartyPage
        party={activeParty}
        details={store.details[activeParty._id]}
        tasks={store.tasks}
        currentUserId={user._id}
        onRetry={() => syncParty(activeParty._id)}
        onComplete={handleComplete}
        onMove={handleMove}
        onEdit={(task) => openModal({ type: 'task', partyId: task.partyId, task })}
        onDelete={handleDelete}
        onNewTask={() => openModal({ type: 'task', partyId: activeParty._id })}
        onInvite={handleInvite}
        onLeave={handleLeaveOrDelete}
        onDeleteParty={handleLeaveOrDelete}
      />
    );
  } else {
    content = (
      <DashboardPage
        loading={store.status === 'loading'}
        currentUser={user}
        parties={store.parties}
        tasks={store.tasks}
        onOpenParty={openParty}
        onNewParty={() => openModal({ type: 'party' })}
      />
    );
  }

  return (
    <div className="shell">
      <a href="#main" className="skip">Skip to content</a>
      <Sidebar
        parties={store.parties}
        loading={store.status === 'loading'}
        activeView={view.name}
        activePartyId={view.partyId}
        onSelect={openParty}
        onHome={goHome}
        onNewParty={() => openModal({ type: 'party' })}
        currentUser={user}
        onProfile={openProfile}
        onLogout={logout}
      />

      <main id="main" className="content" aria-busy={store.status === 'loading' || undefined}>
        {offline && (
          <p className="notice notice-warn" role="status">
            Can't reach the server — showing the last data we loaded. It will refresh when the connection is back.
          </p>
        )}
        {content}
      </main>

      {ready && view.name === 'dashboard' && (
        <FabMenu
          canCreateQuest={store.parties.length > 0}
          onNewQuest={() => openModal({ type: 'task', pickParty: true, partyId: store.parties[0]?._id })}
          onNewParty={() => openModal({ type: 'party' })}
        />
      )}
      {ready && activeParty && (
        <button type="button" className="fab" onClick={() => openModal({ type: 'task', partyId: activeParty._id })} aria-label="Create a new quest">
          + Quest
        </button>
      )}

      {modal?.type === 'task' && (
        <TaskModal
          key={`${modal.task?._id ?? 'new'}-${modal.draft ? 'retry' : 'fresh'}`}
          parties={store.parties}
          pickParty={Boolean(modal.pickParty)}
          initialPartyId={modal.partyId}
          getMembers={(id) => ({ members: store.details[id]?.members, error: store.details[id]?.error })}
          onPartyChange={store.ensurePartyDetails}
          task={modal.task}
          draft={modal.draft}
          error={modal.error}
          onSubmit={handleSaveTask}
          onClose={closeModal}
          onError={audio.error}
        />
      )}
      {modal?.type === 'party' && <PartyModal onSubmit={handleCreateParty} onClose={closeModal} onError={audio.error} />}

      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
