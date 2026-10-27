import { formatXp } from '../logic/xp.js';

export default function QuickStats({ totalXp, partyCount, completedThisWeek }) {
  return (
    <aside className="stats" aria-label="Quick Stats">
      <div className="stat"><span className="stat-num">{formatXp(totalXp)}</span><span className="stat-lbl">Total XP</span></div>
      <div className="stat"><span className="stat-num">{partyCount}</span><span className="stat-lbl">Parties joined</span></div>
      <div className="stat"><span className="stat-num">{completedThisWeek}</span><span className="stat-lbl">Quests done this week</span></div>
    </aside>
  );
}
