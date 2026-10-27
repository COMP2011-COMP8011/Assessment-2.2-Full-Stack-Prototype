// Pure XP/level rules. Mirrors Assessment 1, Section 3.8 (Scenario B) and
// Section 3.4 (xpLevelThreshold = currentLevel * 1000 + 1000).
// No React here — this is unit-testable business logic.
// 2.2: the API (backend/src/utils/xp.js) now owns these rules. This copy predicts the result
// so the XP bar moves the instant "Complete" is clicked; the server's answer then replaces it.
// A backend test checks the two copies agree.

export function nextThreshold(level) {
  return level * 1000 + 1000;
}

/**
 * Apply a completed task's points to a party. Returns a NEW party object
 * (immutable update) plus a flag indicating whether a level-up occurred.
 */
export function applyXp(party, pointGain) {
  let currentXp = party.currentXp + pointGain;
  let currentLevel = party.currentLevel;
  let xpLevelThreshold = party.xpLevelThreshold;
  let levelledUp = false;

  if (currentXp >= xpLevelThreshold) {
    currentLevel += 1;
    currentXp = 0;
    xpLevelThreshold = nextThreshold(currentLevel);
    levelledUp = true;
  }

  return {
    party: {
      ...party,
      currentXp,
      currentLevel,
      xpLevelThreshold,
      totalXpEarned: party.totalXpEarned + pointGain,
    },
    levelledUp,
  };
}

export function xpPercent(party) {
  if (!party.xpLevelThreshold) return 0;
  return Math.min(100, Math.round((party.currentXp / party.xpLevelThreshold) * 100));
}

export function formatXp(n) {
  return Number(n || 0).toLocaleString('en-AU');
}
