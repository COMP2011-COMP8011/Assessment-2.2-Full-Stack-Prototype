// Party-level role checks (Assessment 1 §4 "Role-Based Access Control").
// The party creator acts as the party's admin.
const same = (a, b) => a != null && b != null && String(a) === String(b);

export const isPartyMember = (party, userId) => party.memberIds.some((id) => same(id, userId));
export const isPartyOwner = (party, userId) => same(party.createdBy, userId);

/**
 * PATCH /tasks/:taskId is "assignee or admin" in Assessment 1. Quests nobody has been
 * assigned to yet can be picked up by any member of the party.
 */
export function canModifyTask(party, task, userId) {
  if (isPartyOwner(party, userId)) return true;
  if (!task.assignedTo || task.assignedTo.length === 0) return true;
  return task.assignedTo.some((id) => same(id, userId));
}

/** DELETE /tasks/:taskId is "creator or admin" in Assessment 1. */
export function canDeleteTask(party, task, userId) {
  return isPartyOwner(party, userId) || same(task.createdBy, userId);
}
