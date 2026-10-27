// Skeleton placeholders shown while data loads from the API. They are hidden from screen
// readers; each skeleton area carries one visually hidden status message instead.

export function Bone({ width = '100%', height = 14, radius = 6, className = '' }) {
  return <span className={`bone ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

function Announce({ children }) {
  return <span className="visually-hidden" role="status">{children}</span>;
}

export function SidebarSkeleton() {
  return (
    <div className="skeleton-list">
      <Announce>Loading your parties…</Announce>
      {[0, 1].map((i) => (
        <div key={i} className="party-card skeleton-card" aria-hidden="true">
          <Bone width="70%" height={16} />
          <Bone width="45%" height={11} />
          <span className="bone-row"><Bone width={22} height={22} radius={11} /><Bone width={22} height={22} radius={11} /><Bone width={22} height={22} radius={11} /></span>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="stats" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="stat"><Bone width="40%" height={30} /><Bone width="65%" height={12} /></div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5, label = 'Loading quests…' }) {
  return (
    <div className="recent-list">
      <Announce>{label}</Announce>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="recent-row skeleton-row" aria-hidden="true">
          <span className="bone-stack"><Bone width="55%" height={14} /><Bone width="30%" height={11} /></span>
          <Bone width={64} height={20} radius={999} />
          <Bone width={44} height={14} />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="task skeleton-card" aria-hidden="true">
      <span className="bone-row bone-between"><Bone width="60%" height={16} /><Bone width={40} height={14} /></span>
      <Bone width="85%" height={12} />
      <Bone width="50%" height={12} />
      <span className="bone-row"><Bone width={92} height={36} radius={8} /><Bone width={64} height={36} radius={8} /></span>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="kanban">
      <Announce>Loading the quest board…</Announce>
      {['To do', 'In progress', 'Done'].map((title, i) => (
        <section key={title} className="column" aria-hidden="true">
          <h2 className="column-title">{title}</h2>
          {Array.from({ length: i === 1 ? 1 : 2 }, (_, j) => <CardSkeleton key={j} />)}
        </section>
      ))}
    </div>
  );
}

export function MembersSkeleton() {
  return (
    <span className="avatar-row">
      <Announce>Loading members…</Announce>
      {[0, 1, 2].map((i) => <Bone key={i} width={40} height={40} radius={20} />)}
    </span>
  );
}

export function ContributionsSkeleton() {
  return (
    <div className="contrib-list" aria-hidden="true">
      {[0, 1].map((i) => (
        <span key={i} className="bone-row"><Bone width={28} height={28} radius={14} /><Bone width="30%" height={12} /><Bone width="35%" height={8} /></span>
      ))}
    </div>
  );
}
