// XP and levelling rules from Assessment 1 §3.4 and §3.8 (Scenario B).
export const LEVEL_STEP = 1000;
export const LEVEL_BASE = 1000;

/** XP needed to finish `level`: (currentLevel * 1000) + 1000. */
export function nextThreshold(level) {
  return level * LEVEL_STEP + LEVEL_BASE;
}

export const INITIAL_THRESHOLD = nextThreshold(1);

/** The fields a level-up writes (Scenario B step 6): next level, XP back to 0, new threshold. */
export function levelUp(currentLevel) {
  const nextLevel = currentLevel + 1;
  return { currentLevel: nextLevel, currentXp: 0, xpLevelThreshold: nextThreshold(nextLevel) };
}

/**
 * The whole Scenario B rule as a pure function: add `pointGain`, and level up when the bar
 * fills. services/partyService.js#awardPartyXp applies the same rule to MongoDB with $inc;
 * the frontend copy (frontend/src/logic/xp.js) uses it to predict the result optimistically.
 * A test checks all three agree.
 */
export function applyXp(party, pointGain) {
  const currentXp = party.currentXp + pointGain;
  const totalXpEarned = party.totalXpEarned + pointGain;
  if (currentXp >= party.xpLevelThreshold) {
    return { ...levelUp(party.currentLevel), totalXpEarned, levelledUp: true };
  }
  return { currentLevel: party.currentLevel, currentXp, xpLevelThreshold: party.xpLevelThreshold, totalXpEarned, levelledUp: false };
}
