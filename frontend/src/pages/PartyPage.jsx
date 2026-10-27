import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Contributions from '../components/Contributions.jsx';
import InviteMemberForm from '../components/InviteMemberForm.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import Markdown from '../components/Markdown.jsx';
import { BoardSkeleton, MembersSkeleton } from '../components/Skeleton.jsx';
import XpBar from '../components/XpBar.jsx';
import { canDeleteTask, canModifyTask, isPartyOwner } from '../logic/permissions.js';
import { completedThisWeek, groupByStatus, tasksForParty } from '../logic/tasks.js';

// Screen 3. Party header (name, members, XP bar), Kanban board and "completed this week".
export default function PartyPage({ party, details = {}, tasks, currentUserId, onRetry, onComplete, onMove, onEdit, onDelete, onNewTask, onInvite, onLeave, onDeleteParty }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const { members, stats, error, tasksLoaded } = details;
  const partyTasks = tasksForParty(tasks, party._id);
  const grouped = groupByStatus(partyTasks);
  const weekDone = completedThisWeek(partyTasks);
  const owner = isPartyOwner(party, currentUserId);
  const nameOf = (userId) => members?.find((m) => m._id === userId)?.displayName;
  const boardLoading = !tasksLoaded && partyTasks.length === 0 && !error;

  const cardProps = (task) => ({
    canModify: canModifyTask(party, task, currentUserId),
    canDelete: canDeleteTask(party, task, currentUserId),
    completedByName: task.completedBy === currentUserId ? 'you' : nameOf(task.completedBy),
  });

  return (
    <>
      <header className="party-header">
        <div className="party-header-top">
          <div>
            <h1>{party.name}</h1>
            {party.description && <Markdown text={party.description} className="party-desc" />}
            <p className="party-role">{owner ? 'You own this party.' : 'You are a member of this party.'}</p>
          </div>
          {members ? (
            <ul className="avatar-row" aria-label="Party members">
              {members.map((m) => (
                <li key={m._id}><Avatar name={m.displayName} colour={m.avatar} online={m.online} /></li>
              ))}
            </ul>
          ) : (
            !error && <MembersSkeleton />
          )}
        </div>
        <XpBar party={party} />
      </header>

      {error && !members && (
        <div className="notice notice-error" role="alert">
          <p><strong>Couldn't load this party.</strong> {error.message}</p>
          <button type="button" className="btn btn-ghost" onClick={onRetry}>Try again</button>
        </div>
      )}

      <div className="party-panels">
        <Contributions stats={stats} />
        <section className="members-panel" aria-labelledby="members-heading">
          <h2 id="members-heading">Members</h2>
          <InviteMemberForm onInvite={onInvite} />
          <button type="button" className="link link-danger" onClick={owner ? onDeleteParty : onLeave}>
            {owner ? 'Delete this party' : 'Leave this party'}
          </button>
        </section>
      </div>

      <div className="board-toolbar">
        <h2 className="visually-hidden">Quest board</h2>
        <button type="button" className="btn btn-primary" onClick={onNewTask}>+ New quest</button>
      </div>

      {boardLoading ? (
        <BoardSkeleton />
      ) : (
        <KanbanBoard grouped={grouped} cardProps={cardProps} onComplete={onComplete} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
      )}

      <section className="completed-week">
        <button type="button" className="link" aria-expanded={showCompleted} onClick={() => setShowCompleted((s) => !s)}>
          {showCompleted ? 'Hide' : 'Show'} quests completed this week ({weekDone.length})
        </button>
        {showCompleted && (
          <ul className="recent-list">
            {weekDone.map((t) => (
              <li key={t._id} className="recent-row status-done">
                <span className="recent-title">{t.title}</span>
                <span className="recent-party">{t.completedBy === currentUserId ? 'You' : nameOf(t.completedBy) ?? 'A former member'}</span>
                <span className="recent-pts">{t.pointValue} XP</span>
              </li>
            ))}
            {weekDone.length === 0 && <li className="empty">Nothing completed in the last 7 days.</li>}
          </ul>
        )}
      </section>
    </>
  );
}
