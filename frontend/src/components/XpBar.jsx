import { xpPercent, formatXp } from '../logic/xp.js';

// Party-level progress bar. aria-live="polite" per Assessment 1 §2.2.
export default function XpBar({ party }) {
  const pct = xpPercent(party);
  const label = `Level ${party.currentLevel}: ${formatXp(party.currentXp)}/${formatXp(party.xpLevelThreshold)} XP`;
  return (
    <section className="xp" aria-label="XP Progress" aria-live="polite">
      <div className="xp-label">
        <strong>Level {party.currentLevel}</strong>
        <span>{formatXp(party.currentXp)} / {formatXp(party.xpLevelThreshold)} XP</span>
      </div>
      <div
        className="xp-track"
        role="progressbar"
        aria-label={`${party.name} XP towards level ${party.currentLevel + 1}`}
        aria-valuemin={0}
        aria-valuemax={party.xpLevelThreshold}
        aria-valuenow={party.currentXp}
        aria-valuetext={label}
      >
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
