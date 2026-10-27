import { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner.jsx';
import { fromDateInputValue, toDateInputValue } from '../logic/tasks.js';

const fieldErrorsFrom = (error) => Object.fromEntries((error?.details || []).map((d) => [d.field, d.message]));

/**
 * Screen 4: create a quest, or edit one when `task` is passed.
 * Saving is optimistic: the dialog hands the values to `onSubmit` and closes, and the card
 * appears straight away. If the server then rejects the change, the dialog reopens with
 * `draft` (what the user typed) and `error` (why it failed).
 * With `pickParty` (quick create from the dashboard FAB) the user also chooses the party.
 */
export default function TaskModal({ parties, pickParty = false, initialPartyId, getMembers, onPartyChange, task, draft, error, onSubmit, onClose, onError }) {
  const editing = Boolean(task);
  const source = draft ?? task ?? {};
  const [partyId, setPartyId] = useState(initialPartyId ?? parties[0]?._id);
  const [title, setTitle] = useState(source.title ?? '');
  const [description, setDescription] = useState(source.description ?? '');
  const [pointValue, setPointValue] = useState(source.pointValue ?? 10);
  const [assignedTo, setAssignedTo] = useState(source.assignedTo ?? []);
  const [dueDate, setDueDate] = useState(toDateInputValue(source.dueDate));
  const [priority, setPriority] = useState(source.priority ?? 'medium');
  const [showMore, setShowMore] = useState(false);
  const [errors, setErrors] = useState(() => fieldErrorsFrom(error));
  const firstField = useRef(null);

  const party = parties.find((p) => p._id === partyId);
  const { members, error: membersError } = getMembers(partyId);

  useEffect(() => {
    firstField.current?.focus(); // focus the first field once, when the dialog opens
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (partyId) onPartyChange?.(partyId); // make sure the member list is loaded
  }, [partyId, onPartyChange]);

  function toggleMember(id) {
    setAssignedTo((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function choosePartyFor(id) {
    setPartyId(id);
    setAssignedTo([]); // assignees must belong to the chosen party
  }

  function submit(e) {
    e.preventDefault();
    const next = {};
    if (!title.trim()) next.title = 'Give the quest a title.';
    const pts = Number(pointValue);
    if (!editing && (!Number.isInteger(pts) || pts < 1 || pts > 50)) next.pointValue = 'Points must be a whole number from 1 to 50.';
    if (!partyId) next.party = 'Choose a party for this quest.';
    setErrors(next);
    if (Object.keys(next).length) {
      onError?.();
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: fromDateInputValue(dueDate),
      assignedTo,
    };
    if (!editing) fields.pointValue = pts;
    onSubmit(fields, partyId);
  }

  const heading = editing ? `Edit “${task.title}”` : pickParty || !party ? 'New quest' : `New quest in ${party.name}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-title">{heading}</h2>
        <form onSubmit={submit} noValidate>
          {error && (
            <p className="form-error" role="alert">
              {editing ? "Your changes weren't saved" : "The quest wasn't created"}: {error.message}
            </p>
          )}

          {pickParty && (
            <div className="field">
              <label htmlFor="q-party">Party</label>
              <select id="q-party" value={partyId ?? ''} onChange={(e) => choosePartyFor(e.target.value)} aria-invalid={!!errors.party}>
                {parties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {errors.party && <p className="error" role="alert">{errors.party}</p>}
            </div>
          )}

          <div className="field">
            <label htmlFor="q-title">Title</label>
            <input id="q-title" ref={firstField} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'q-title-err' : undefined} required />
            {errors.title && <p id="q-title-err" className="error" role="alert">{errors.title}</p>}
          </div>

          <div className="field">
            <label htmlFor="q-desc">Description (optional)</label>
            <textarea id="q-desc" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} aria-describedby="q-desc-hint" />
            <p id="q-desc-hint" className="hint">Markdown works: **bold**, *italic*, `code`, [link](https://…) and “- ” lists.</p>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="q-points">Points (1–50)</label>
              <input
                id="q-points"
                type="number"
                min={1}
                max={50}
                value={pointValue}
                disabled={editing}
                onChange={(e) => setPointValue(e.target.value)}
                aria-invalid={!!errors.pointValue}
                aria-describedby={errors.pointValue ? 'q-points-err' : editing ? 'q-points-hint' : undefined}
              />
              {editing && <p id="q-points-hint" className="hint">Points are fixed once a quest exists.</p>}
              {errors.pointValue && <p id="q-points-err" className="error" role="alert">{errors.pointValue}</p>}
            </div>
            <div className="field">
              <label htmlFor="q-priority">Priority</label>
              <select id="q-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="q-due">Due date</label>
              <input id="q-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={!!errors.dueDate} />
              {errors.dueDate && <p className="error" role="alert">{errors.dueDate}</p>}
            </div>
          </div>

          <fieldset className="field">
            <legend>Assign to</legend>
            {members ? (
              <div className="checks">
                {members.map((m) => (
                  <label key={m._id} className="check">
                    <input type="checkbox" checked={assignedTo.includes(m._id)} onChange={() => toggleMember(m._id)} />
                    {m.displayName}
                  </label>
                ))}
              </div>
            ) : membersError ? (
              <p className="hint">Couldn't load this party's members. You can create the quest now and assign it later.</p>
            ) : (
              <p className="hint loading-line"><Spinner label="Loading members…" /> Loading members…</p>
            )}
            <p className="hint">Leave everyone unticked to let any member pick it up.</p>
            {errors.assignedTo && <p className="error" role="alert">{errors.assignedTo}</p>}
          </fieldset>

          <button type="button" className="link" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)}>
            {showMore ? 'Fewer options' : 'More options'}
          </button>
          {showMore && (
            <div className="more-options">
              <label className="check"><input type="checkbox" disabled /> Recurring quest (planned, not in this release)</label>
              <label className="check"><input type="checkbox" disabled /> Custom category (planned, not in this release)</label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Create quest'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
