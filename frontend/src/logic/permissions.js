// Mirrors backend/src/utils/permissions.js so the UI only offers actions the API will allow.
// The API still enforces every rule; this just avoids buttons that would fail.
const same = (a, b) => a != null && b != null && String(a) === String(b);

export const isPartyOwner = (party, userId) => same(party?.createdBy, userId);

/** Assignees and the party owner can change a quest; unassigned quests are open to any member. */
export function canModifyTask(party, task, userId) {
  if (isPartyOwner(party, userId)) return true;
  if (!task.assignedTo || task.assignedTo.length === 0) return true;
  return task.assignedTo.some((id) => same(id, userId));
}

/** The quest's creator or the party owner can delete it. */
export function canDeleteTask(party, task, userId) {
  return isPartyOwner(party, userId) || same(task.createdBy, userId);
}
