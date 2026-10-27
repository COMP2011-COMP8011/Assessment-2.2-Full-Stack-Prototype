import QuickStats from '../components/QuickStats.jsx';
import { ListSkeleton, StatsSkeleton } from '../components/Skeleton.jsx';
import { STATUS_LABEL, byNewest, completedThisWeek } from '../logic/tasks.js';

// Screen 2. Welcome banner, Quick Stats, recent quests across all parties.
export default function DashboardPage({ loading, currentUser, parties, tasks, onOpenParty, onNewParty }) {
  const partyIds = new Set(parties.map((p) => p._id));
  const mine = tasks.filter((t) => partyIds.has(t.partyId));
  const recent = [...mine].sort(byNewest).slice(0, 8);
  const partyName = (id) => parties.find((p) => p._id === id)?.name ?? '';

  return (
    <>
      <header className="banner">
        <h1>Welcome, {currentUser.displayName.split(' ')[0]}!</h1>
        <p>Here's what your parties are working on.</p>
      </header>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <QuickStats totalXp={currentUser.totalXpEarned} partyCount={parties.length} completedThisWeek={completedThisWeek(mine).length} />
      )}

      <section aria-labelledby="recent-heading" className="recent" aria-busy={loading || undefined}>
        <h2 id="recent-heading">Recent quests</h2>
        {loading ? (
          <ListSkeleton rows={5} label="Loading recent quests…" />
        ) : parties.length === 0 ? (
          <div className="empty-state">
            <p>Create a party, then invite your teammates by email to start sharing quests.</p>
            <button type="button" className="btn btn-primary" onClick={onNewParty}>Create your first party</button>
          </div>
        ) : recent.length === 0 ? (
          <p className="empty">No quests yet. Open a party to create one.</p>
        ) : (
          <ul className="recent-list">
            {recent.map((t) => (
              <li key={t._id} className={`recent-row status-${t.status}`}>
                <button type="button" className="recent-link" onClick={() => onOpenParty(t.partyId)}>
                  <span className="recent-title">{t.title}</span>
                  <span className="recent-party">{partyName(t.partyId)}</span>
                </button>
                <span className="pill">{STATUS_LABEL[t.status]}</span>
                <span className="recent-pts">{t.pointValue} XP</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
