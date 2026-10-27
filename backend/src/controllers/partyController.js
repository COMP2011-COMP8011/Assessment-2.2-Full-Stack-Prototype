import { Party, Task, User } from '../models/index.js';
import { RECENT_MEMBERS_LIMIT } from '../models/constants.js';
import { loadPartyDetail, memberSnapshot, refillRecentMembers } from '../services/partyService.js';
import { ApiError } from '../utils/ApiError.js';
import { isPartyMember, isPartyOwner } from '../utils/permissions.js';
import { runInTransaction } from '../utils/transaction.js';

/**
 * GET /parties — every party the signed-in user belongs to (sidebar cards).
 * Uses the memberIds index and the denormalised memberCount/recentMembers, so no User lookups.
 */
export async function listParties(req, res) {
  const parties = await Party.find({ memberIds: req.user._id, 'settings.archived': { $ne: true } })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ parties });
}

/** POST /parties — create a party; the creator becomes its owner and first member. */
export async function createParty(req, res) {
  const { name, description = '' } = req.valid.body;
  const me = req.user;

  const party = await runInTransaction(async (session) => {
    const [created] = await Party.create(
      [{ name, description, createdBy: me._id, memberIds: [me._id], memberCount: 1, recentMembers: [memberSnapshot(me)] }],
      { session },
    );
    await User.updateOne({ _id: me._id }, { $addToSet: { partyIds: created._id } }, { session });
    return created;
  });

  // Assessment 1 §4: 201 with the new party ({ _id, name, createdBy, currentLevel: 1, ... }).
  res.status(201).json(await loadPartyDetail(party._id));
}

/** GET /parties/:partyId — party header data, including members (populated from Users). */
export async function getParty(req, res) {
  res.json({ party: await loadPartyDetail(req.party._id) });
}

/** PATCH /parties/:partyId — owner only: rename, describe, archive. */
export async function updateParty(req, res) {
  const { name, description, settings = {} } = req.valid.body;
  const $set = {};
  if (name !== undefined) $set.name = name;
  if (description !== undefined) $set.description = description;
  for (const [key, value] of Object.entries(settings)) $set[`settings.${key}`] = value;

  if (Object.keys($set).length > 0) await Party.updateOne({ _id: req.party._id }, { $set }, { runValidators: true });
  res.json({ message: 'Party updated', party: await loadPartyDetail(req.party._id) });
}

/** DELETE /parties/:partyId — owner only: removes the party, its quests and every member's link to it. */
export async function deleteParty(req, res) {
  const { _id: partyId, memberIds } = req.party;
  await runInTransaction(async (session) => {
    await Task.deleteMany({ partyId }, { session });
    await User.updateMany({ _id: { $in: memberIds } }, { $pull: { partyIds: partyId } }, { session });
    await Party.deleteOne({ _id: partyId }, { session });
  });
  res.status(204).end();
}

/**
 * POST /parties/:partyId/members — add someone by email (or userId).
 * Assessment 1 §3.8 Scenario A: memberIds, memberCount, recentMembers and the new member's
 * partyIds change together in one transaction.
 */
export async function addMember(req, res) {
  const { email, userId } = req.valid.body;
  const target = await User.findOne(email ? { email } : { _id: userId }).lean();
  if (!target) {
    throw ApiError.notFound(email ? 'No TaskParty account uses that email address. Ask them to register first.' : 'That user does not exist.');
  }
  if (isPartyMember(req.party, target._id)) throw ApiError.conflict(`${target.displayName} is already in this party.`);

  await runInTransaction(async (session) => {
    const result = await Party.updateOne(
      { _id: req.party._id, memberIds: { $ne: target._id } }, // guard against a double add
      {
        $push: {
          memberIds: target._id,
          recentMembers: { $each: [memberSnapshot(target)], $position: 0, $slice: RECENT_MEMBERS_LIMIT },
        },
        $inc: { memberCount: 1 },
      },
      { session },
    );
    if (result.modifiedCount === 0) throw ApiError.conflict(`${target.displayName} is already in this party.`);
    await User.updateOne({ _id: target._id }, { $addToSet: { partyIds: req.party._id } }, { session });
  });

  res.json({ message: 'User added to Party', party: await loadPartyDetail(req.party._id) });
}

/**
 * DELETE /parties/:partyId/members/:userId — leave a party (your own id) or, as the owner,
 * remove someone. Their quest assignments in this party are cleared in the same transaction.
 */
export async function removeMember(req, res) {
  const { userId } = req.valid.params;
  const { party } = req;
  const leaving = String(userId) === String(req.user._id);

  if (!leaving && !isPartyOwner(party, req.user._id)) throw ApiError.forbidden('Only the party owner can remove members.');
  if (isPartyOwner(party, userId)) {
    throw new ApiError(400, "The party owner can't leave. Delete the party instead.", { code: 'OWNER_CANNOT_LEAVE' });
  }
  if (!isPartyMember(party, userId)) throw ApiError.notFound('That person is not a member of this party.');

  await runInTransaction(async (session) => {
    const result = await Party.updateOne(
      { _id: party._id, memberIds: userId },
      { $pull: { memberIds: userId, recentMembers: { userId } }, $inc: { memberCount: -1 } },
      { session },
    );
    if (result.modifiedCount === 0) throw ApiError.notFound('That person is not a member of this party.');
    await User.updateOne({ _id: userId }, { $pull: { partyIds: party._id } }, { session });
    await Task.updateMany(
      { partyId: party._id, assignedTo: userId },
      { $pull: { assignedTo: userId, assignedToNames: { userId } } },
      { session },
    );
    await refillRecentMembers(party._id, session);
  });

  if (leaving) return res.json({ message: 'You left the party' });
  res.json({ message: 'Member removed', party: await loadPartyDetail(party._id) });
}

/**
 * GET /parties/:partyId/stats — one aggregation pipeline that powers the party's
 * "who contributed what" panel: XP per member, quest counts per status and quests done this week.
 */
export async function getPartyStats(req, res) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [result] = await Task.aggregate([
    { $match: { partyId: req.party._id } }, // served by the (partyId, status) index
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        contributions: [
          { $match: { status: 'done', completedBy: { $ne: null } } },
          { $group: { _id: '$completedBy', xp: { $sum: '$pointValue' }, quests: { $sum: 1 } } },
          { $sort: { xp: -1, quests: -1 } },
        ],
        completedThisWeek: [{ $match: { status: 'done', completedAt: { $gte: weekAgo } } }, { $count: 'count' }],
      },
    },
  ]);

  const people = await User.find({ _id: { $in: result.contributions.map((c) => c._id) } }, 'displayName avatar').lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const counts = Object.fromEntries(result.byStatus.map((s) => [s._id, s.count]));

  res.json({
    stats: {
      byStatus: { todo: counts.todo ?? 0, in_progress: counts.in_progress ?? 0, done: counts.done ?? 0 },
      completedThisWeek: result.completedThisWeek[0]?.count ?? 0,
      contributions: result.contributions.map((c) => ({
        userId: c._id,
        displayName: byId.get(String(c._id))?.displayName ?? 'Former member',
        avatar: byId.get(String(c._id))?.avatar ?? 'slate',
        xp: c.xp,
        quests: c.quests,
      })),
    },
  });
}
