import Avatar from './Avatar.jsx';
import { SidebarSkeleton } from './Skeleton.jsx';

export default function Sidebar({ parties, loading, activeView, activePartyId, onSelect, onHome, onNewParty, currentUser, onProfile, onLogout }) {
  return (
    <nav className="sidebar" aria-label="Main">
      <button type="button" className="wordmark" onClick={onHome} aria-current={activeView === 'dashboard' ? 'page' : undefined}>
        Task Party
      </button>

      <p className="sidebar-heading">Your parties</p>
      {loading ? (
        <SidebarSkeleton />
      ) : parties.length === 0 ? (
        <p className="empty">You're not in any parties yet.</p>
      ) : (
        <ul className="party-list">
          {parties.map((p) => (
            <li key={p._id}>
              <button
                type="button"
                className={`party-card ${p._id === activePartyId ? 'active' : ''}`}
                onClick={() => onSelect(p._id)}
                aria-current={p._id === activePartyId ? 'page' : undefined}
              >
                <span className="party-name">{p.name}</span>
                <span className="party-sub">Level {p.currentLevel} · {p.memberCount} {p.memberCount === 1 ? 'member' : 'members'}</span>
                {/* Party.recentMembers: the denormalised cache from Assessment 1 §3.7 — no User lookups needed. */}
                <span className="party-thumbs" aria-hidden="true">
                  {p.recentMembers.map((m) => <Avatar key={m.userId} name={m.displayName} colour={m.avatar} size="xs" />)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost sidebar-new" onClick={onNewParty}>+ New party</button>

      <div className="sidebar-user">
        <button type="button" className="sidebar-me" onClick={onProfile} aria-current={activeView === 'profile' ? 'page' : undefined}>
          <Avatar name={currentUser.displayName} colour={currentUser.avatar} size="sm" />
          <span className="sidebar-me-text">
            <span className="sidebar-me-name">{currentUser.displayName}</span>
            <span className="sidebar-me-link">Profile & settings</span>
          </span>
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => onLogout()}>Log out</button>
      </div>
    </nav>
  );
}
