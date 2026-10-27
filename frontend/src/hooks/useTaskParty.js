import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { partiesApi, tasksApi } from '../api/endpoints.js';
import { STATUS, upsertTask } from '../logic/tasks.js';
import { applyXp } from '../logic/xp.js';

/**
 * Client-side store for TaskParty, synchronised with the REST API.
 *
 * In 2.1 this hook held local state seeded from mockData.json. In 2.2 it keeps the same role
 * (pages read state and call actions from here) but every action goes through the API:
 *  - Reads load parties and quests from MongoDB (fetch, via src/api).
 *  - Quest changes are optimistic: create, edit, start/move back, complete and delete update the
 *    board immediately, then the server's response replaces the guess. If the request fails the
 *    change is rolled back and the caller is told why. Pending cards carry `_pending`.
 *  - refreshParty() re-reads a party (polled by App) so teammates' changes appear.
 *  - A revision counter, plus a count of changes in flight, stops a slow refresh from
 *    overwriting newer local state.
 */
const XP_FIELDS = ['currentLevel', 'currentXp', 'xpLevelThreshold', 'totalXpEarned'];
const pickXp = (party) => Object.fromEntries(XP_FIELDS.map((key) => [key, party[key]]));
const withoutMembers = ({ members: _members, ...party }) => party;

let tempCounter = 0;
const tempId = () => `temp-${Date.now()}-${(tempCounter += 1)}`;

const assigneeNames = (ids = [], members = []) =>
  ids.map((id) => ({ userId: id, displayName: members.find((m) => m._id === id)?.displayName ?? '…' }));

function useLatest(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function useTaskParty(user) {
  const userId = user._id;
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [parties, setParties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [details, setDetails] = useState({}); // partyId -> { members, stats, error, tasksLoaded }

  const tasksRef = useLatest(tasks);
  const partiesRef = useLatest(parties);
  const detailsRef = useLatest(details);
  const revision = useRef(0);
  const pending = useRef(new Map()); // partyId -> number of changes in flight
  const detailsInFlight = useRef(new Set());

  const startMutation = (partyId) => {
    revision.current += 1;
    pending.current.set(partyId, (pending.current.get(partyId) || 0) + 1);
  };
  const endMutation = (partyId) => {
    revision.current += 1;
    const left = (pending.current.get(partyId) || 1) - 1;
    if (left > 0) pending.current.set(partyId, left);
    else pending.current.delete(partyId);
  };

  const setTask = useCallback((task, replaceId) => setTasks((list) => upsertTask(list, task, replaceId)), []);
  const patchParty = useCallback(
    (partyId, patch) => setParties((list) => list.map((p) => (p._id === partyId ? { ...p, ...patch } : p))),
    [],
  );
  const setPartyDetails = useCallback(
    (partyId, patch) => setDetails((all) => ({ ...all, [partyId]: { ...all[partyId], ...patch } })),
    [],
  );

  const refreshStats = useCallback(
    (partyId) =>
      partiesApi
        .stats(partyId)
        .then(({ stats }) => setPartyDetails(partyId, { stats }))
        .catch(() => {}),
    [setPartyDetails],
  );

  // ---- Loading ----------------------------------------------------------------------------

  /** Sidebar parties plus quests across all of them (dashboard). */
  const loadAll = useCallback(async ({ signal } = {}) => {
    const startedAt = revision.current;
    const [partyRes, taskRes] = await Promise.all([partiesApi.list({ signal }), tasksApi.listMine({ limit: 200 }, { signal })]);
    if (startedAt !== revision.current || pending.current.size > 0) return; // a local change is newer
    setParties(partyRes.parties);
    setTasks(taskRes.tasks);
    setStatus('ready');
    setLoadError(null);
  }, []);

  const initialLoad = useCallback(
    (signal) => {
      setStatus('loading');
      setLoadError(null);
      loadAll({ signal }).catch((error) => {
        if (signal?.aborted) return;
        setLoadError(error);
        setStatus('error');
      });
    },
    [loadAll],
  );

  useEffect(() => {
    const controller = new AbortController();
    initialLoad(controller.signal);
    return () => controller.abort();
  }, [initialLoad]);

  /**
   * Re-reads one party: header and XP, members (with online status), stats and its quests.
   * Returns the quests teammates completed since we last looked (for the audio cue).
   */
  const refreshParty = useCallback(
    async (partyId) => {
      const startedAt = revision.current;
      let results;
      try {
        results = await Promise.all([partiesApi.get(partyId), tasksApi.listForParty(partyId, { limit: 200 }), partiesApi.stats(partyId)]);
      } catch (error) {
        if (!detailsRef.current[partyId]?.members) setPartyDetails(partyId, { error });
        throw error;
      }
      const [{ party }, { tasks: partyTasks }, { stats }] = results;
      setPartyDetails(partyId, { members: party.members, stats, error: null, tasksLoaded: true });
      if (startedAt !== revision.current || pending.current.has(partyId)) return { completedByOthers: [], members: party.members };

      const before = new Map(tasksRef.current.filter((t) => t.partyId === partyId).map((t) => [t._id, t]));
      const completedByOthers = partyTasks.filter(
        (t) => t.status === STATUS.DONE && before.has(t._id) && before.get(t._id).status !== STATUS.DONE && String(t.completedBy) !== String(userId),
      );
      setTasks((list) => [...list.filter((t) => t.partyId !== partyId), ...partyTasks]);
      setParties((list) => list.map((p) => (p._id === partyId ? withoutMembers(party) : p)));
      return { completedByOthers, members: party.members };
    },
    [userId, tasksRef, detailsRef, setPartyDetails],
  );

  /** Loads a party's member list if we don't have it yet (the quest dialog needs it). */
  const ensurePartyDetails = useCallback(
    async (partyId) => {
      if (!partyId || detailsRef.current[partyId]?.members || detailsInFlight.current.has(partyId)) return;
      detailsInFlight.current.add(partyId);
      try {
        const { party } = await partiesApi.get(partyId);
        setPartyDetails(partyId, { members: party.members, error: null });
      } catch (error) {
        setPartyDetails(partyId, { error });
      } finally {
        detailsInFlight.current.delete(partyId);
      }
    },
    [detailsRef, setPartyDetails],
  );

  /** Removes a party from local state (deleted, left, or access lost). */
  const forgetParty = useCallback((partyId) => {
    revision.current += 1;
    setParties((list) => list.filter((p) => p._id !== partyId));
    setTasks((list) => list.filter((t) => t.partyId !== partyId));
    setDetails(({ [partyId]: _gone, ...rest }) => rest);
  }, []);

  // ---- Quests (optimistic) ---------------------------------------------------------------

  /** Create: the card appears at once with a "Saving…" marker; the server's copy replaces it. */
  const createTask = useCallback(
    async (partyId, fields) => {
      const id = tempId();
      const optimistic = {
        _id: id,
        partyId,
        description: '',
        priority: 'medium',
        dueDate: null,
        ...fields,
        assignedTo: fields.assignedTo ?? [],
        assignedToNames: assigneeNames(fields.assignedTo, detailsRef.current[partyId]?.members),
        status: STATUS.TODO,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        completedAt: null,
        completedBy: null,
        _pending: 'create',
      };
      startMutation(partyId);
      setTasks((list) => [optimistic, ...list]);
      try {
        const task = await tasksApi.create(partyId, fields);
        setTask(task, id);
        return { ok: true, task };
      } catch (error) {
        setTasks((list) => list.filter((t) => t._id !== id));
        return { ok: false, error };
      } finally {
        endMutation(partyId);
      }
    },
    [userId, detailsRef, setTask],
  );

  /** Edit from the quest dialog: show the new values immediately, roll back if refused. */
  const updateTask = useCallback(
    async (taskId, changes) => {
      const original = tasksRef.current.find((t) => t._id === taskId);
      if (!original) return { ok: false, skipped: true };
      const members = detailsRef.current[original.partyId]?.members;
      const optimistic = {
        ...original,
        ...changes,
        assignedToNames: changes.assignedTo ? assigneeNames(changes.assignedTo, members) : original.assignedToNames,
        _pending: 'update',
      };
      startMutation(original.partyId);
      setTask(optimistic);
      try {
        const { task } = await tasksApi.update(original.partyId, taskId, changes);
        setTask(task);
        return { ok: true, task };
      } catch (error) {
        setTask(original);
        return { ok: false, error, partyId: original.partyId };
      } finally {
        endMutation(original.partyId);
      }
    },
    [tasksRef, detailsRef, setTask],
  );

  /** Scenario B: the card moves to Done and the XP bar fills at once (predicted with applyXp). */
  const completeTask = useCallback(
    async (taskId) => {
      const task = tasksRef.current.find((t) => t._id === taskId);
      const party = partiesRef.current.find((p) => p._id === task?.partyId);
      if (!task || !party || task.status === STATUS.DONE || task._pending) return { ok: false, skipped: true };

      startMutation(party._id);
      setTask({ ...task, status: STATUS.DONE, completedAt: new Date().toISOString(), completedBy: userId, _pending: 'complete' });
      patchParty(party._id, pickXp(applyXp(party, task.pointValue).party));
      try {
        const res = await tasksApi.update(party._id, taskId, { status: STATUS.DONE });
        const { levelledUp, ...xp } = res.partyUpdate;
        setTask(res.task);
        patchParty(party._id, xp);
        refreshStats(party._id);
        return { ok: true, task: res.task, pointGain: res.task.pointValue, levelledUp, totalXpEarned: res.userUpdate?.totalXpEarned };
      } catch (error) {
        setTask(task);
        patchParty(party._id, pickXp(party));
        return { ok: false, error, partyId: party._id };
      } finally {
        endMutation(party._id);
      }
    },
    [userId, tasksRef, partiesRef, setTask, patchParty, refreshStats],
  );

  /** Start / Move back between "To do" and "In progress". */
  const moveTask = useCallback(
    async (taskId, nextStatus) => {
      const task = tasksRef.current.find((t) => t._id === taskId);
      if (!task || task.status === nextStatus || task._pending) return { ok: false, skipped: true };
      startMutation(task.partyId);
      setTask({ ...task, status: nextStatus, _pending: 'move' });
      try {
        const res = await tasksApi.update(task.partyId, taskId, { status: nextStatus });
        setTask(res.task);
        return { ok: true, task: res.task };
      } catch (error) {
        setTask(task);
        return { ok: false, error, partyId: task.partyId };
      } finally {
        endMutation(task.partyId);
      }
    },
    [tasksRef, setTask],
  );

  /** Delete: the card disappears at once and comes back if the server refuses. */
  const deleteTask = useCallback(
    async (taskId) => {
      const index = tasksRef.current.findIndex((t) => t._id === taskId);
      const task = tasksRef.current[index];
      if (!task || task._pending) return { ok: false, skipped: true };
      startMutation(task.partyId);
      setTasks((list) => list.filter((t) => t._id !== taskId));
      try {
        await tasksApi.remove(task.partyId, taskId);
        refreshStats(task.partyId);
        return { ok: true, task };
      } catch (error) {
        setTasks((list) => [...list.slice(0, index), task, ...list.slice(index)]);
        return { ok: false, error, partyId: task.partyId };
      } finally {
        endMutation(task.partyId);
      }
    },
    [tasksRef, refreshStats],
  );

  // ---- Parties ------------------------------------------------------------------------

  const createParty = useCallback(
    async (fields) => {
      revision.current += 1;
      const party = await partiesApi.create(fields); // §4: the new party itself, with members
      setParties((list) => [...list, withoutMembers(party)]);
      setPartyDetails(party._id, { members: party.members, stats: null, tasksLoaded: true });
      return party;
    },
    [setPartyDetails],
  );

  /** Scenario A: add a member by email. */
  const addMember = useCallback(
    async (partyId, email) => {
      startMutation(partyId);
      try {
        const { party } = await partiesApi.addMember(partyId, email);
        patchParty(partyId, withoutMembers(party));
        setPartyDetails(partyId, { members: party.members });
        return party;
      } finally {
        endMutation(partyId);
      }
    },
    [patchParty, setPartyDetails],
  );

  const leaveParty = useCallback(
    async (partyId) => {
      await partiesApi.removeMember(partyId, userId);
      forgetParty(partyId);
    },
    [userId, forgetParty],
  );

  const deleteParty = useCallback(
    async (partyId) => {
      await partiesApi.remove(partyId);
      forgetParty(partyId);
    },
    [forgetParty],
  );

  /** After a profile change the server updates cached names; reload so the UI shows them. */
  const reloadAfterProfileChange = useCallback(async () => {
    setDetails({});
    await loadAll().catch(() => {});
  }, [loadAll]);

  return {
    status,
    loadError,
    parties,
    tasks,
    details,
    retry: () => initialLoad(),
    loadAll,
    refreshParty,
    ensurePartyDetails,
    forgetParty,
    createTask,
    updateTask,
    completeTask,
    moveTask,
    deleteTask,
    createParty,
    addMember,
    leaveParty,
    deleteParty,
    reloadAfterProfileChange,
  };
}
