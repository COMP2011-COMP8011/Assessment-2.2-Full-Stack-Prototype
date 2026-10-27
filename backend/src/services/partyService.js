// Party helpers shared by several controllers: member snapshots, XP awards, member lists.
import { Party, User } from '../models/index.js';
import { RECENT_MEMBERS_LIMIT } from '../models/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { isPartyMember } from '../utils/permissions.js';
import { levelUp } from '../utils/xp.js';

const ONLINE_WINDOW_MS = 2 * 60_000;
const MEMBER_FIELDS = 'displayName avatar lastSeenAt';

export const memberSnapshot = (user) => ({ userId: user._id, displayName: user.displayName, avatar: user.avatar });

export function toMemberJson(user) {
  const lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
  return { _id: user._id, displayName: user.displayName, avatar: user.avatar, online: Date.now() - lastSeen < ONLINE_WINDOW_MS };
}

/** A party plus its full member list (populated from Users), in join order. */
export async function loadPartyDetail(partyId) {
  const party = await Party.findById(partyId).populate({ path: 'members', select: MEMBER_FIELDS }).lean();
  if (!party) return null;
  const order = new Map(party.memberIds.map((id, i) => [String(id), i]));
  const members = (party.members || [])
    .slice()
    .sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)))
    .map(toMemberJson);
  return { ...party, members };
}

const XP_FIELDS = 'currentLevel currentXp xpLevelThreshold totalXpEarned';
const pickXp = ({ currentLevel, currentXp, xpLevelThreshold, totalXpEarned }) => ({ currentLevel, currentXp, xpLevelThreshold, totalXpEarned });

/**
 * Assessment 1 §3.8 Scenario B, steps 4–6. Runs inside the caller's transaction (step 1/7):
 *   4. Party.currentXp     += pointGain   (atomic $inc)
 *   5. Party.totalXpEarned += pointGain   (atomic $inc)
 *   6. IF currentXp >= xpLevelThreshold: currentLevel += 1, currentXp = 0,
 *      xpLevelThreshold = (currentLevel * 1000) + 1000
 * The step-6 filter only matches while the bar is still full, so a level-up is applied once.
 */
export async function awardPartyXp(partyId, pointGain, session) {
  const party = await Party.findByIdAndUpdate(
    partyId,
    { $inc: { currentXp: pointGain, totalXpEarned: pointGain } },
    { returnDocument: 'after', session },
  )
    .select(XP_FIELDS)
    .lean();
  if (!party) throw ApiError.notFound('That party no longer exists.');
  if (party.currentXp < party.xpLevelThreshold) return { ...pickXp(party), levelledUp: false };

  const levelled = await Party.findOneAndUpdate(
    { _id: partyId, currentLevel: party.currentLevel, currentXp: { $gte: party.xpLevelThreshold } },
    { $set: levelUp(party.currentLevel) },
    { returnDocument: 'after', session },
  )
    .select(XP_FIELDS)
    .lean();
  if (levelled) return { ...pickXp(levelled), levelledUp: true };

  // Only reachable without transactions: a simultaneous completion levelled the party up first.
  const latest = await Party.findById(partyId).select(XP_FIELDS).session(session).lean();
  return { ...pickXp(latest), levelledUp: false };
}

/** Keeps Party.recentMembers (last 3 joiners) filled after someone leaves. */
export async function refillRecentMembers(partyId, session) {
  const party = await Party.findById(partyId, 'memberIds recentMembers', { session }).lean();
  if (!party || party.recentMembers.length >= Math.min(RECENT_MEMBERS_LIMIT, party.memberIds.length)) return;
  const latestIds = party.memberIds.slice(-RECENT_MEMBERS_LIMIT).reverse();
  const users = await User.find({ _id: { $in: latestIds } }, 'displayName avatar', { session }).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const recentMembers = latestIds.map((id) => byId.get(String(id))).filter(Boolean).map(memberSnapshot);
  await Party.updateOne({ _id: partyId }, { $set: { recentMembers } }, { session });
}

/** Validates that every assignee belongs to the party and builds the assignedToNames cache. */
export async function resolveAssignees(party, ids) {
  const unique = [...new Set(ids.map(String))];
  if (unique.some((id) => !isPartyMember(party, id))) {
    throw ApiError.badRequest('Quests can only be assigned to members of this party.', [
      { field: 'assignedTo', message: 'Every assignee must be a member of this party.' },
    ]);
  }
  const users = await User.find({ _id: { $in: unique } }, 'displayName').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    assignedTo: unique,
    assignedToNames: unique.map((id) => ({ userId: id, displayName: byId.get(id)?.displayName ?? 'Former member' })),
  };
}
