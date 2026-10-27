import TaskCard from './TaskCard.jsx';
import { STATUS_LABEL } from '../logic/tasks.js';

const COLUMNS = ['todo', 'in_progress', 'done'];

/** Three-column board (Assessment 1, Screen 3). `cardProps(task)` supplies per-card permissions. */
export default function KanbanBoard({ grouped, cardProps, onComplete, onMove, onEdit, onDelete }) {
  return (
    <div className="kanban">
      {COLUMNS.map((status) => (
        <section key={status} className="column" aria-labelledby={`col-${status}`}>
          <h2 id={`col-${status}`} className="column-title">
            {STATUS_LABEL[status]} <span className="count">{grouped[status].length}</span>
          </h2>
          {grouped[status].length === 0 ? (
            <p className="empty">{status === 'todo' ? 'No quests waiting. Add one with “New quest”.' : 'Nothing here yet.'}</p>
          ) : (
            grouped[status].map((t) => (
              <TaskCard key={t._id} task={t} {...cardProps(t)} onComplete={onComplete} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
            ))
          )}
        </section>
      ))}
    </div>
  );
}
