import { Task, User } from '../models/index.js';
import { awardPartyXp, resolveAssignees } from '../services/partyService.js';
import { ApiError } from '../utils/ApiError.js';
import { canDeleteTask, canModifyTask } from '../utils/permissions.js';
import { runInTransaction } from '../utils/transaction.js';

// Tasks ("Quests") are TaskParty's main resource — full CRUD lives here.
const DEFAULT_ORDER = { createdAt: -1, completedAt: -1, dueDate: 1, pointValue: -1, title: 1 };

function sortSpec(sortBy, order) {
  const direction = order ? (order === 'asc' ? 1 : -1) : DEFAULT_ORDER[sortBy];
  return { [sortBy]: direction, _id: direction }; // _id tie-breaker keeps paging stable
}

async function findTaskOr404(req) {
  const task = await Task.findOne({ _id: req.valid.params.taskId, partyId: req.party._id }).lean();
  if (!task) throw ApiError.notFound('That quest does not exist in this party.');
  return task;
}

/** GET /parties/:partyId/tasks?status=&sortBy=&order=&limit= — the party's Kanban board. */
export async function listPartyTasks(req, res) {
  const { status, sortBy, order, limit } = req.valid.query;
  const filter = { partyId: req.party._id, ...(status && { status }) };
  const tasks = await Task.find(filter).sort(sortSpec(sortBy, order)).limit(limit).lean();
  res.json({ tasks });
}

/** GET /tasks — quests across every party the user belongs to (dashboard "recent quests"). */
export async function listMyTasks(req, res) {
  const { status, sortBy, order, limit } = req.valid.query;
  const filter = { partyId: { $in: req.user.partyIds }, ...(status && { status }) };
  const tasks = await Task.find(filter).sort(sortSpec(sortBy, order)).limit(limit).lean();
  res.json({ tasks });
}

/** POST /parties/:partyId/tasks — create a quest (any party member). */
export async function createTask(req, res) {
  const { title, description = '', pointValue, priority = 'medium', dueDate = null, assignedTo = [] } = req.valid.body;
  const assignees = await resolveAssignees(req.party, assignedTo);
  const task = await Task.create({
    partyId: req.party._id,
    title,
    description,
    pointValue,
    priority,
    dueDate,
    ...assignees,
    createdBy: req.user._id,
  });
  // Assessment 1 §4: 201 with the created task ({ _id, title, status, createdAt, ... }).
  res.status(201).json(task.toJSON());
}

/** GET /parties/:partyId/tasks/:taskId */
export async function getTask(req, res) {
  res.json({ task: await findTaskOr404(req) });
}

/**
 * Assessment 1 §3.8 Scenario B: mark the quest done, add its points to the party's XP
 * (levelling up when the bar fills) and to the completer's total — all in one transaction.
 * The status guard means two people clicking "Complete" at once can't award the XP twice.
 */
async function completeTask({ party, task, userId, extraSet }) {
  return runInTransaction(async (session) => {
    const completed = await Task.findOneAndUpdate(
      { _id: task._id, partyId: party._id, status: { $ne: 'done' } },
      { $set: { ...extraSet, status: 'done', completedAt: new Date(), completedBy: userId } },
      { returnDocument: 'after', runValidators: true, session },
    ).lean();
    if (!completed) throw ApiError.conflict('A teammate already completed this quest.');

    const partyUpdate = await awardPartyXp(party._id, completed.pointValue, session);
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { totalXpEarned: completed.pointValue } },
      { returnDocument: 'after', session },
    )
      .select('totalXpEarned')
      .lean();

    return { task: completed, partyUpdate, userUpdate: { totalXpEarned: user.totalXpEarned } };
  });
}

/**
 * PATCH /parties/:partyId/tasks/:taskId — edit fields or move the quest between columns.
 * Allowed for the quest's assignees and the party owner (unassigned quests: any member).
 * Response (Assessment 1 §4): { message: "Task updated", task, partyUpdate? }.
 */
export async function updateTask(req, res) {
  const { party, user } = req;
  const task = await findTaskOr404(req);
  if (!canModifyTask(party, task, user._id)) {
    throw ApiError.forbidden("Only this quest's assignees or the party owner can change it.");
  }

  // completedBy is accepted for compatibility with the Assessment 1 request body but ignored:
  // the server always records the signed-in user as the person who completed the quest.
  const { status, assignedTo, completedBy: _ignored, ...fields } = req.valid.body;
  const $set = { ...fields };
  if (assignedTo !== undefined) Object.assign($set, await resolveAssignees(party, assignedTo));

  if (status === 'done' && task.status !== 'done') {
    const result = await completeTask({ party, task, userId: user._id, extraSet: $set });
    return res.json({ message: 'Task updated', ...result });
  }
  if (task.status === 'done' && status && status !== 'done') {
    throw ApiError.conflict("Completed quests can't be reopened — their XP has already been awarded.");
  }
  if (task.status === 'done' && status === 'done' && Object.keys($set).length === 0) {
    const mine = String(task.completedBy) === String(user._id);
    throw ApiError.conflict(mine ? 'You already completed this quest.' : 'A teammate already completed this quest.');
  }

  const filter = { _id: task._id, partyId: party._id };
  if (status && status !== 'done') {
    $set.status = status;
    filter.status = { $ne: 'done' }; // don't undo a completion that landed a moment ago
  }
  if (Object.keys($set).length === 0) return res.json({ message: 'Task updated', task });
  const updated = await Task.findOneAndUpdate(filter, { $set }, { returnDocument: 'after', runValidators: true }).lean();
  if (!updated) throw ApiError.conflict('A teammate completed this quest a moment ago.');
  res.json({ message: 'Task updated', task: updated });
}

/** DELETE /parties/:partyId/tasks/:taskId — the quest's creator or the party owner. XP already earned stays. */
export async function deleteTask(req, res) {
  const task = await findTaskOr404(req);
  if (!canDeleteTask(req.party, task, req.user._id)) {
    throw ApiError.forbidden("Only the quest's creator or the party owner can delete it.");
  }
  await Task.deleteOne({ _id: task._id, partyId: req.party._id });
  res.status(204).end();
}
