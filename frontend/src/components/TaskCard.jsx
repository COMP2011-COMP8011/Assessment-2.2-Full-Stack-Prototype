import Markdown from './Markdown.jsx';
import Spinner from './Spinner.jsx';
import { STATUS, formatDue, isOverdue } from '../logic/tasks.js';

const PENDING_TEXT = { create: 'Saving…', update: 'Saving…', complete: 'Saving…', move: 'Saving…' };

export default function TaskCard({ task, canModify, canDelete, completedByName, onComplete, onMove, onEdit, onDelete }) {
  const done = task.status === STATUS.DONE;
  const pending = Boolean(task._pending); // optimistic change waiting for the server
  const overdue = isOverdue(task);
  const due = formatDue(task.dueDate);
  const assignees = task.assignedToNames.map((a) => a.displayName).join(', ');
  const titleId = `task-${task._id}-title`;

  return (
    <article
      className={`task ${done ? 'task-done' : ''} ${pending ? 'task-pending' : ''} priority-${task.priority}`}
      aria-labelledby={titleId}
      aria-busy={pending || undefined}
    >
      <header className="task-head">
        <h3 id={titleId} className="task-title">{task.title}</h3>
        <span className="task-points">{task.pointValue} XP</span>
      </header>

      {pending && (
        <p className="task-saving">
          <Spinner /> {PENDING_TEXT[task._pending] ?? 'Saving…'}
        </p>
      )}

      {task.description && <Markdown text={task.description} className="task-desc" />}

      <dl className="task-meta">
        <div><dt>Assigned to</dt><dd>{assignees || 'Anyone in the party'}</dd></div>
        <div><dt>Priority</dt><dd>{task.priority}</dd></div>
        {due && (
          <div>
            <dt>Due</dt>
            <dd className={overdue ? 'overdue' : ''}>{due}{overdue ? ' (overdue)' : ''}</dd>
          </div>
        )}
      </dl>

      <footer className="task-actions">
        {done && <span className="task-complete-flag">✓ Completed{completedByName ? ` by ${completedByName}` : ''}</span>}

        {!done && canModify && (
          <>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onComplete(task._id)}>
              Complete
            </button>
            {task.status === STATUS.TODO && (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => onMove(task._id, STATUS.IN_PROGRESS)}>
                Start
              </button>
            )}
            {task.status === STATUS.IN_PROGRESS && (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => onMove(task._id, STATUS.TODO)}>
                Move back
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}>
              Edit
            </button>
          </>
        )}
        {!done && !canModify && <p className="note">Only its assignees or the party owner can update this quest.</p>}

        {canDelete && (
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => onDelete(task._id)} aria-label={`Delete ${task.title}`}>
            Delete
          </button>
        )}
      </footer>
    </article>
  );
}
