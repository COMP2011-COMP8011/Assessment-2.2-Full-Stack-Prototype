import { Party, Task, User } from '../models/index.js';
import { runInTransaction } from '../utils/transaction.js';

/** GET /users/me — the signed-in user's profile and settings. */
export function getMe(req, res) {
  res.json({ user: req.user });
}

/**
 * PATCH /users/me — update display name, avatar colour or settings.
 * A new name/avatar is copied into the denormalised caches on Parties and Tasks in the
 * same transaction (Assessment 1 §3.7: "Updated on: ... user updates profile").
 */
export async function updateMe(req, res) {
  const { displayName, avatar, settings = {} } = req.valid.body;
  const $set = {};
  if (displayName !== undefined) $set.displayName = displayName;
  if (avatar !== undefined) $set.avatar = avatar;
  for (const [key, value] of Object.entries(settings)) $set[`settings.${key}`] = value;

  if (Object.keys($set).length === 0) return res.json({ message: 'Nothing to update', user: req.user });

  const profileChanged =
    (displayName !== undefined && displayName !== req.user.displayName) || (avatar !== undefined && avatar !== req.user.avatar);

  const user = await runInTransaction(async (session) => {
    const updated = await User.findByIdAndUpdate(req.user._id, { $set }, { returnDocument: 'after', runValidators: true, session }).lean();
    if (profileChanged) {
      await Party.updateMany(
        { 'recentMembers.userId': updated._id },
        { $set: { 'recentMembers.$.displayName': updated.displayName, 'recentMembers.$.avatar': updated.avatar } },
        { session },
      );
      await Task.updateMany(
        { 'assignedToNames.userId': updated._id },
        { $set: { 'assignedToNames.$.displayName': updated.displayName } },
        { session },
      );
    }
    return updated;
  });

  res.json({ message: 'Profile updated', user });
}
