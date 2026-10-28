import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { Party, Task, User } from '../src/models/index.js';
import { bearer, createPartyWith, createTask, registerUser, resetDatabase, startTestApp, stopTestApp } from './helpers.js';

let app;
before(async () => { app = await startTestApp(); });
after(stopTestApp);
beforeEach(resetDatabase);

const taskUrl = (partyId, taskId = '') => `/api/v1/parties/${partyId}/tasks${taskId ? `/${taskId}` : ''}`;

async function setup() {
  const owner = await registerUser(app, { displayName: 'Owner' });
  const member = await registerUser(app, { displayName: 'Member' });
  const party = await createPartyWith(app, owner, [member]);
  return { owner, member, party };
}

describe('Quest CRUD (the brief\'s "Echoes" resource)', () => {
  it('creates, reads, updates and deletes a quest', async () => {
    const { owner, member, party } = await setup();

    // Create
    const created = await request(app)
      .post(taskUrl(party._id))
      .set(bearer(owner.token))
      .send({ title: 'Lab report', description: 'Indexing lab', pointValue: 25, priority: 'high', dueDate: '2030-01-15', assignedTo: [member.user._id] })
      .expect(201);
    const task = created.body; // Assessment 1 §4: { _id, title, status: "todo", createdAt, ... }
    assert.ok(task._id && task.createdAt);
    assert.equal(task.status, 'todo');
    assert.equal(task.createdBy, owner.user._id);
    assert.deepEqual(task.assignedToNames, [{ userId: member.user._id, displayName: 'Member' }]);
    assert.equal(new Date(task.dueDate).toISOString().slice(0, 10), '2030-01-15');

    // Read (list + single)
    const list = await request(app).get(taskUrl(party._id)).set(bearer(member.token)).expect(200);
    assert.deepEqual(list.body.tasks.map((t) => t._id), [task._id]);
    const one = await request(app).get(taskUrl(party._id, task._id)).set(bearer(member.token)).expect(200);
    assert.equal(one.body.task.title, 'Lab report');

    // Update
    const updated = await request(app)
      .patch(taskUrl(party._id, task._id))
      .set(bearer(member.token))
      .send({ title: 'Lab report (final)', status: 'in_progress', dueDate: null })
      .expect(200);
    assert.equal(updated.body.task.title, 'Lab report (final)');
    assert.equal(updated.body.task.status, 'in_progress');
    assert.equal(updated.body.task.dueDate, null);

    // Delete
    await request(app).delete(taskUrl(party._id, task._id)).set(bearer(owner.token)).expect(204);
    await request(app).get(taskUrl(party._id, task._id)).set(bearer(owner.token)).expect(404);
  });

  it('validates quests and explains what is wrong', async () => {
    const { owner, party } = await setup();
    for (const pointValue of [0, 51, 2.5, '10']) {
      const res = await request(app).post(taskUrl(party._id)).set(bearer(owner.token)).send({ title: 'x', pointValue }).expect(400);
      assert.equal(res.body.error.details[0].field, 'pointValue');
    }
    const blank = await request(app).post(taskUrl(party._id)).set(bearer(owner.token)).send({ title: '   ', pointValue: 5 }).expect(400);
    assert.match(blank.body.error.message, /can't be empty/);
  });

  it('only assigns quests to members of the party', async () => {
    const { owner, party } = await setup();
    const outsider = await registerUser(app);
    const res = await request(app)
      .post(taskUrl(party._id))
      .set(bearer(owner.token))
      .send({ title: 'x', pointValue: 5, assignedTo: [outsider.user._id] })
      .expect(400);
    assert.match(res.body.error.message, /members of this party/);
  });

  it('keeps pointValue immutable after creation (§3.5)', async () => {
    const { owner, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 10 });
    const res = await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ pointValue: 50 }).expect(400);
    assert.match(res.body.error.message, /can't be changed/);
    assert.equal((await Task.findById(task._id).lean()).pointValue, 10);
  });

  it('hides quests from people outside the party', async () => {
    const { owner, party } = await setup();
    const outsider = await registerUser(app);
    const task = await createTask(app, owner, party._id);
    await request(app).get(taskUrl(party._id, task._id)).set(bearer(outsider.token)).expect(403);
    await request(app).get(taskUrl(party._id, '0123456789abcdef01234567')).set(bearer(owner.token)).expect(404);
  });

  it('filters, sorts and limits the board', async () => {
    const { owner, party } = await setup();
    await createTask(app, owner, party._id, { title: 'A', pointValue: 5 });
    await createTask(app, owner, party._id, { title: 'B', pointValue: 30 });
    const t3 = await createTask(app, owner, party._id, { title: 'C', pointValue: 15 });
    await request(app).patch(taskUrl(party._id, t3._id)).set(bearer(owner.token)).send({ status: 'in_progress' }).expect(200);

    const todo = await request(app).get(`${taskUrl(party._id)}?status=todo&sortBy=pointValue&order=desc&limit=1`).set(bearer(owner.token)).expect(200);
    assert.deepEqual(todo.body.tasks.map((t) => t.title), ['B']);
    await request(app).get(`${taskUrl(party._id)}?status=finished`).set(bearer(owner.token)).expect(400);
    await request(app).get(`${taskUrl(party._id)}?limit=0`).set(bearer(owner.token)).expect(400);
  });

  it('GET /tasks returns quests from all of my parties and nobody else\'s', async () => {
    const { owner, party } = await setup();
    const second = await createPartyWith(app, owner, [], 'Second');
    const stranger = await registerUser(app);
    const strangerParty = await createPartyWith(app, stranger, [], 'Elsewhere');
    await createTask(app, owner, party._id, { title: 'One' });
    await createTask(app, owner, second._id, { title: 'Two' });
    await createTask(app, stranger, strangerParty._id, { title: 'Hidden' });

    const res = await request(app).get('/api/v1/tasks').set(bearer(owner.token)).expect(200);
    assert.deepEqual(res.body.tasks.map((t) => t.title).sort(), ['One', 'Two']);
  });
});

describe('Completing a quest (Assessment 1 §3.8 Scenario B)', () => {
  it('marks it done and adds its points to the party and the completer', async () => {
    const { owner, member, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 25, assignedTo: [member.user._id] });

    const res = await request(app).patch(taskUrl(party._id, task._id)).set(bearer(member.token)).send({ status: 'done' }).expect(200);
    assert.equal(res.body.task.status, 'done');
    assert.equal(res.body.task.completedBy, member.user._id);
    assert.ok(res.body.task.completedAt);
    assert.deepEqual(res.body.partyUpdate, { currentLevel: 1, currentXp: 25, xpLevelThreshold: 2000, totalXpEarned: 25, levelledUp: false });
    assert.equal(res.body.userUpdate.totalXpEarned, 25);

    const stored = await Party.findById(party._id).lean();
    assert.equal(stored.currentXp, 25);
    assert.equal((await User.findById(member.user._id).lean()).totalXpEarned, 25);
  });

  it('levels the party up when the bar fills, resetting XP and raising the threshold', async () => {
    const { owner, party } = await setup();
    await Party.updateOne({ _id: party._id }, { $set: { currentXp: 1990, totalXpEarned: 1990 } });
    const task = await createTask(app, owner, party._id, { pointValue: 15 });

    const res = await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ status: 'done' }).expect(200);
    assert.deepEqual(res.body.partyUpdate, { currentLevel: 2, currentXp: 0, xpLevelThreshold: 3000, totalXpEarned: 2005, levelledUp: true });
  });

  it('accepts the Assessment 1 request body but records the signed-in user as completer', async () => {
    const { owner, member, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 10, assignedTo: [member.user._id] });
    const res = await request(app)
      .patch(taskUrl(party._id, task._id))
      .set(bearer(member.token))
      .send({ status: 'done', completedBy: owner.user._id }) // body shown in Assessment 1 §4
      .expect(200);
    assert.equal(res.body.message, 'Task updated');
    assert.equal(res.body.task.completedBy, member.user._id);
    assert.equal(res.body.partyUpdate.currentXp, 10);
  });

  it('keeps every point when different quests are completed at the same moment ($inc)', async () => {
    const { owner, member, party } = await setup();
    const quests = [];
    for (const pointValue of [10, 20, 30]) quests.push(await createTask(app, owner, party._id, { pointValue }));
    const results = await Promise.all(
      quests.map((t, i) => request(app).patch(taskUrl(party._id, t._id)).set(bearer(i % 2 ? member.token : owner.token)).send({ status: 'done' })),
    );
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
    const stored = await Party.findById(party._id).lean();
    assert.equal(stored.currentXp, 60);
    assert.equal(stored.totalXpEarned, 60);
  });

  it("can't be completed twice or reopened", async () => {
    const { owner, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 10 });
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ status: 'done' }).expect(200);
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ status: 'done' }).expect(409);
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ status: 'todo' }).expect(409);
    assert.equal((await Party.findById(party._id).lean()).currentXp, 10);
  });

  it('awards XP once when two people complete the same quest at the same moment', async () => {
    const { owner, member, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 20, assignedTo: [owner.user._id, member.user._id] });
    const results = await Promise.all(
      [owner, member].map((who) => request(app).patch(taskUrl(party._id, task._id)).set(bearer(who.token)).send({ status: 'done' })),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const stored = await Party.findById(party._id).lean();
    assert.equal(stored.currentXp, 20);
    assert.equal(stored.totalXpEarned, 20);
  });

  it('keeps XP when a completed quest is deleted (totalXpEarned never decreases)', async () => {
    const { owner, party } = await setup();
    const task = await createTask(app, owner, party._id, { pointValue: 30 });
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ status: 'done' }).expect(200);
    await request(app).delete(taskUrl(party._id, task._id)).set(bearer(owner.token)).expect(204);
    assert.equal((await Party.findById(party._id).lean()).totalXpEarned, 30);
  });
});

describe('Quest permissions (Assessment 1 §4 RBAC)', () => {
  it('lets assignees and the owner change a quest, but not other members', async () => {
    const owner = await registerUser(app);
    const assignee = await registerUser(app);
    const bystander = await registerUser(app);
    const party = await createPartyWith(app, owner, [assignee, bystander]);
    const task = await createTask(app, owner, party._id, { assignedTo: [assignee.user._id] });

    const denied = await request(app).patch(taskUrl(party._id, task._id)).set(bearer(bystander.token)).send({ status: 'done' }).expect(403);
    assert.match(denied.body.error.message, /assignees or the party owner/);
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(assignee.token)).send({ status: 'in_progress' }).expect(200);
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(owner.token)).send({ priority: 'high' }).expect(200);
  });

  it('lets any member pick up an unassigned quest', async () => {
    const { owner, member, party } = await setup();
    const task = await createTask(app, owner, party._id, { assignedTo: [] });
    await request(app).patch(taskUrl(party._id, task._id)).set(bearer(member.token)).send({ status: 'done' }).expect(200);
  });

  it('lets only the creator or the owner delete a quest', async () => {
    const owner = await registerUser(app);
    const creator = await registerUser(app);
    const other = await registerUser(app);
    const party = await createPartyWith(app, owner, [creator, other]);
    const task = await createTask(app, creator, party._id, { assignedTo: [other.user._id] });

    await request(app).delete(taskUrl(party._id, task._id)).set(bearer(other.token)).expect(403);
    await request(app).delete(taskUrl(party._id, task._id)).set(bearer(creator.token)).expect(204);
    const second = await createTask(app, creator, party._id);
    await request(app).delete(taskUrl(party._id, second._id)).set(bearer(owner.token)).expect(204);
  });
});
