import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { Party, Task, User } from '../src/models/index.js';
import { bearer, createPartyWith, createTask, registerUser, resetDatabase, startTestApp, stopTestApp } from './helpers.js';

let app;
before(async () => { app = await startTestApp(); });
after(stopTestApp);
beforeEach(resetDatabase);

describe('Parties', () => {
  it('creates a party with the creator as owner and first member (both sides of the N:N link)', async () => {
    const owner = await registerUser(app, { displayName: 'Owner' });
    const res = await request(app)
      .post('/api/v1/parties')
      .set(bearer(owner.token))
      .send({ name: '  Team Rockets  ', description: 'Study group' })
      .expect(201);

    const party = res.body; // Assessment 1 §4: { _id, name, createdBy, currentLevel: 1, ... }
    assert.ok(party._id);
    assert.equal(party.name, 'Team Rockets');
    assert.equal(party.createdBy, owner.user._id);
    assert.deepEqual(party.memberIds, [owner.user._id]);
    assert.equal(party.memberCount, 1);
    assert.equal(party.currentLevel, 1);
    assert.equal(party.currentXp, 0);
    assert.equal(party.xpLevelThreshold, 2000);
    assert.equal(party.members[0].displayName, 'Owner');

    const user = await User.findById(owner.user._id).lean();
    assert.deepEqual(user.partyIds.map(String), [party._id]);
  });

  it('lists only the parties you belong to', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await createPartyWith(app, a, [], 'Mine');
    await createPartyWith(app, b, [], 'Theirs');
    const res = await request(app).get('/api/v1/parties').set(bearer(a.token)).expect(200);
    assert.deepEqual(res.body.parties.map((p) => p.name), ['Mine']);
  });

  it('returns 403 to non-members, 404 for unknown parties and 400 for malformed ids', async () => {
    const owner = await registerUser(app);
    const outsider = await registerUser(app);
    const party = await createPartyWith(app, owner);
    const forbidden = await request(app).get(`/api/v1/parties/${party._id}`).set(bearer(outsider.token)).expect(403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');
    await request(app).get('/api/v1/parties/0123456789abcdef01234567').set(bearer(owner.token)).expect(404);
    const bad = await request(app).get('/api/v1/parties/not-an-id').set(bearer(owner.token)).expect(400);
    assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
  });

  it('refuses to let clients write XP directly', async () => {
    const owner = await registerUser(app);
    const party = await createPartyWith(app, owner);
    await request(app).patch(`/api/v1/parties/${party._id}`).set(bearer(owner.token)).send({ currentXp: 99999 }).expect(400);
    const stored = await Party.findById(party._id).lean();
    assert.equal(stored.currentXp, 0);
  });
});

describe('Party membership (Assessment 1 §3.8 Scenario A)', () => {
  it('adds a member by email and keeps memberIds, memberCount, recentMembers and partyIds in sync', async () => {
    const owner = await registerUser(app, { displayName: 'Owner' });
    const friend = await registerUser(app, { displayName: 'Friend', avatar: 'rose' });
    const party = await createPartyWith(app, owner);

    const res = await request(app)
      .post(`/api/v1/parties/${party._id}/members`)
      .set(bearer(owner.token))
      .send({ email: friend.user.email.toUpperCase() })
      .expect(200);

    assert.equal(res.body.message, 'User added to Party');
    assert.equal(res.body.party.memberCount, 2);
    assert.deepEqual(res.body.party.memberIds, [owner.user._id, friend.user._id]);
    assert.deepEqual(res.body.party.recentMembers[0], { userId: friend.user._id, displayName: 'Friend', avatar: 'rose' });
    assert.deepEqual(res.body.party.members.map((m) => m.displayName), ['Owner', 'Friend']);

    const stored = await User.findById(friend.user._id).lean();
    assert.deepEqual(stored.partyIds.map(String), [party._id]);
  });

  it('caps recentMembers at the three newest members', async () => {
    const owner = await registerUser(app);
    const others = [];
    for (let i = 0; i < 4; i += 1) others.push(await registerUser(app, { displayName: `Member ${i}` }));
    const party = await createPartyWith(app, owner, others);
    assert.equal(party.memberCount, 5);
    assert.deepEqual(party.recentMembers.map((m) => m.displayName), ['Member 3', 'Member 2', 'Member 1']);
  });

  it('rejects unknown emails (404) and existing members (409)', async () => {
    const owner = await registerUser(app);
    const friend = await registerUser(app);
    const party = await createPartyWith(app, owner, [friend]);
    const missing = await request(app)
      .post(`/api/v1/parties/${party._id}/members`)
      .set(bearer(owner.token))
      .send({ email: 'nobody@example.com' })
      .expect(404);
    assert.match(missing.body.error.message, /No TaskParty account/);
    await request(app)
      .post(`/api/v1/parties/${party._id}/members`)
      .set(bearer(owner.token))
      .send({ email: friend.user.email })
      .expect(409);
  });

  it('lets a member leave, clearing their assignments', async () => {
    const owner = await registerUser(app);
    const friend = await registerUser(app);
    const party = await createPartyWith(app, owner, [friend]);
    const task = await createTask(app, owner, party._id, { assignedTo: [friend.user._id, owner.user._id] });

    await request(app).delete(`/api/v1/parties/${party._id}/members/${friend.user._id}`).set(bearer(friend.token)).expect(200);

    const stored = await Party.findById(party._id).lean();
    assert.equal(stored.memberCount, 1);
    assert.deepEqual(stored.memberIds.map(String), [owner.user._id]);
    assert.deepEqual(stored.recentMembers.map((m) => String(m.userId)), [owner.user._id]);
    const storedTask = await Task.findById(task._id).lean();
    assert.deepEqual(storedTask.assignedTo.map(String), [owner.user._id]);
    assert.deepEqual(storedTask.assignedToNames.map((a) => String(a.userId)), [owner.user._id]);
    assert.deepEqual((await User.findById(friend.user._id).lean()).partyIds, []);
    await request(app).get(`/api/v1/parties/${party._id}`).set(bearer(friend.token)).expect(403);
  });

  it("doesn't let the owner leave, or members remove each other", async () => {
    const owner = await registerUser(app);
    const a = await registerUser(app);
    const b = await registerUser(app);
    const party = await createPartyWith(app, owner, [a, b]);
    await request(app).delete(`/api/v1/parties/${party._id}/members/${owner.user._id}`).set(bearer(owner.token)).expect(400);
    await request(app).delete(`/api/v1/parties/${party._id}/members/${b.user._id}`).set(bearer(a.token)).expect(403);
    await request(app).delete(`/api/v1/parties/${party._id}/members/${b.user._id}`).set(bearer(owner.token)).expect(200);
  });
});

describe('Owner-only party actions', () => {
  it('lets only the owner rename the party', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const party = await createPartyWith(app, owner, [member]);
    await request(app).patch(`/api/v1/parties/${party._id}`).set(bearer(member.token)).send({ name: 'Hijacked' }).expect(403);
    const res = await request(app).patch(`/api/v1/parties/${party._id}`).set(bearer(owner.token)).send({ name: 'Renamed' }).expect(200);
    assert.equal(res.body.party.name, 'Renamed');
  });

  it('deletes a party together with its quests and every member link', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const party = await createPartyWith(app, owner, [member]);
    await createTask(app, owner, party._id);
    await request(app).delete(`/api/v1/parties/${party._id}`).set(bearer(member.token)).expect(403);
    await request(app).delete(`/api/v1/parties/${party._id}`).set(bearer(owner.token)).expect(204);

    assert.equal(await Party.countDocuments({ _id: party._id }), 0);
    assert.equal(await Task.countDocuments({ partyId: party._id }), 0);
    assert.deepEqual((await User.findById(member.user._id).lean()).partyIds, []);
  });
});

describe('GET /parties/:partyId/stats (aggregation)', () => {
  it('sums XP per contributor and counts quests per status', async () => {
    const owner = await registerUser(app, { displayName: 'Owner' });
    const friend = await registerUser(app, { displayName: 'Friend' });
    const party = await createPartyWith(app, owner, [friend]);
    const t1 = await createTask(app, owner, party._id, { pointValue: 10, assignedTo: [owner.user._id] });
    const t2 = await createTask(app, owner, party._id, { pointValue: 25, assignedTo: [friend.user._id] });
    const t3 = await createTask(app, owner, party._id, { pointValue: 5, assignedTo: [friend.user._id] });
    await createTask(app, owner, party._id, { pointValue: 7 });
    for (const [who, task] of [[owner, t1], [friend, t2], [friend, t3]]) {
      await request(app).patch(`/api/v1/parties/${party._id}/tasks/${task._id}`).set(bearer(who.token)).send({ status: 'done' }).expect(200);
    }

    const res = await request(app).get(`/api/v1/parties/${party._id}/stats`).set(bearer(owner.token)).expect(200);
    const { stats } = res.body;
    assert.deepEqual(stats.byStatus, { todo: 1, in_progress: 0, done: 3 });
    assert.equal(stats.completedThisWeek, 3);
    assert.deepEqual(
      stats.contributions.map(({ displayName, xp, quests }) => ({ displayName, xp, quests })),
      [{ displayName: 'Friend', xp: 30, quests: 2 }, { displayName: 'Owner', xp: 10, quests: 1 }],
    );
  });
});
