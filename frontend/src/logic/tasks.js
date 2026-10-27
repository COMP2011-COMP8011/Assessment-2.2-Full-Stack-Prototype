// Pure task helpers.

export const STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export const STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function tasksForParty(tasks, partyId) {
  return tasks.filter((t) => t.partyId === partyId);
}

export function groupByStatus(tasks) {
  return {
    todo: tasks.filter((t) => t.status === STATUS.TODO),
    in_progress: tasks.filter((t) => t.status === STATUS.IN_PROGRESS),
    done: tasks.filter((t) => t.status === STATUS.DONE),
  };
}

export function completedThisWeek(tasks, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return tasks.filter(
    (t) => t.status === STATUS.DONE && t.completedAt && new Date(t.completedAt) >= weekAgo
  );
}

export function isOverdue(task, now = new Date()) {
  return task.status !== STATUS.DONE && task.dueDate && new Date(task.dueDate) < now;
}

export function formatDue(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/** Newest first — used for the dashboard's "recent quests". */
export function byNewest(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

/** Converts a stored ISO date to the yyyy-mm-dd value an <input type="date"> expects. */
export function toDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converts an <input type="date"> value to an ISO timestamp at the end of that local day. */
export function fromDateInputValue(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 0).toISOString();
}

/**
 * Puts `task` into the list in place of the task with id `replaceId` (default: its own id),
 * adding it to the front if neither is there and never leaving duplicates. Used to swap an
 * optimistic placeholder ("temp-…") for the server's saved copy.
 */
export function upsertTask(list, task, replaceId = task._id) {
  const index = list.findIndex((t) => t._id === replaceId || t._id === task._id);
  if (index === -1) return [task, ...list];
  const next = list.slice();
  next[index] = task;
  return next.filter((t, i) => i === index || t._id !== task._id);
}
