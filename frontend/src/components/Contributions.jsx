import Avatar from './Avatar.jsx';
import { ContributionsSkeleton } from './Skeleton.jsx';
import { formatXp } from '../logic/xp.js';

/** XP each member has earned for the party, from the stats aggregation endpoint. */
export default function Contributions({ stats }) {
  if (!stats) {
    return (
      <section className="contrib" aria-labelledby="contrib-heading">
        <h2 id="contrib-heading">Contributions</h2>
        <span className="visually-hidden" role="status">Loading contributions…</span>
        <ContributionsSkeleton />
      </section>
    );
  }
  const top = stats.contributions.slice(0, 5);
  const most = top[0]?.xp || 1;
  return (
    <section className="contrib" aria-labelledby="contrib-heading">
      <h2 id="contrib-heading">Contributions</h2>
      {top.length === 0 ? (
        <p className="empty">No completed quests on this board yet.</p>
      ) : (
        <ol className="contrib-list">
          {top.map((c) => (
            <li key={c.userId} className="contrib-row">
              <Avatar name={c.displayName} colour={c.avatar} size="sm" />
              <span className="contrib-name">{c.displayName}</span>
              <span className="contrib-bar" aria-hidden="true"><span style={{ width: `${Math.max(6, (c.xp / most) * 100)}%` }} /></span>
              <span className="contrib-xp">{formatXp(c.xp)} XP · {c.quests} {c.quests === 1 ? 'quest' : 'quests'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
