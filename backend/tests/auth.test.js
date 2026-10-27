import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { Party, Task, User } from '../src/models/index.js';
import { bearer, createPartyWith, createTask, registerUser, resetDatabase, startTestApp, stopTestApp } from './helpers.js';

let app;
before(async () => { app = await startTestApp(); });
after(stopTestApp);
beforeEach(resetDatabase);

describe('POST /auth/register', () => {
  it('creates an account, hashes the password and never returns it', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'Alice@Example.com ', password: 'secret-pass-1', displayName: 'Alice', avatar: 'violet' })
      .expect(201);

    assert.equal(res.body.message, 'User created successfully');
    assert.ok(res.body.token);
    assert.equal(res.body.expiresIn, 86_400); // 24 hours (Assessment 1 §4)
    assert.equal(res.body.user.email, 'alice@example.com'); // trimmed + lower-cased
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.avatar, 'violet');

    const stored = await User.findOne({ email: 'alice@example.com' }).select('+password').lean();
    assert.notEqual(stored.password, 'secret-pass-1');
    assert.match(stored.password, /^\$2[aby]\$\d{2}\$/); // bcrypt hash
    assert.ok(Number(stored.password.split('$')[2]) >= 10, 'at least 10 salt rounds');
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser(app, { email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'DUP@example.com', password: 'another-pass', displayName: 'Copy' })
      .expect(409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /already exists/);
  });

  it('validates input and explains every problem (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', displayName: '' })
      .expect(400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['displayName', 'email', 'password']);
  });

  it('refuses fields the client must not set, such as role (mass assignment)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'sneaky@example.com', password: 'long-enough', displayName: 'Sneaky', role: 'admin' })
      .expect(400);
    assert.match(res.body.error.message, /Unrecognized key/);
    assert.equal(await User.countDocuments({ email: 'sneaky@example.com' }), 0);
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password', async () => {
    const { user, password } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password }).expect(200);
    assert.equal(res.body.userId, user._id);
    assert.equal(jwt.verify(res.body.token, env.jwtSecret).sub, user._id);
    assert.equal(res.body.user.password, undefined);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const { user } = await registerUser(app);
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'nope-nope' }).expect(401);
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope' }).expect(401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
  });

  it('rejects query-operator injection instead of passing it to MongoDB', async () => {
    await registerUser(app);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
      .expect(400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('Protected routes', () => {
  it('require a bearer token', async () => {
    const res = await request(app).get('/api/v1/users/me').expect(401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });

  it('reject a tampered token', async () => {
    const { token } = await registerUser(app);
    const tampered = `${token.slice(0, -2)}xx`;
    await request(app).get('/api/v1/users/me').set(bearer(tampered)).expect(401);
  });

  it('reject an expired token with a clear message', async () => {
    const { user } = await registerUser(app);
    const expired = jwt.sign({ sub: user._id }, env.jwtSecret, { expiresIn: -10 });
    const res = await request(app).get('/api/v1/users/me').set(bearer(expired)).expect(401);
    assert.match(res.body.error.message, /expired/i);
  });
});

describe('/users/me', () => {
  it('returns the profile with settings', async () => {
    const { token, user } = await registerUser(app);
    const res = await request(app).get('/api/v1/users/me').set(bearer(token)).expect(200);
    assert.equal(res.body.user._id, user._id);
    assert.deepEqual(res.body.user.settings, { notificationsEnabled: true, audioEnabled: true, highContrastMode: false });
  });

  it('updates settings without touching other fields', async () => {
    const { token } = await registerUser(app, { displayName: 'Keep Me' });
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(bearer(token))
      .send({ settings: { audioEnabled: false } })
      .expect(200);
    assert.equal(res.body.user.settings.audioEnabled, false);
    assert.equal(res.body.user.settings.highContrastMode, false);
    assert.equal(res.body.user.displayName, 'Keep Me');
  });

  it('copies a new display name into the denormalised caches (§3.7)', async () => {
    const owner = await registerUser(app, { displayName: 'Old Name' });
    const party = await createPartyWith(app, owner);
    await createTask(app, owner, party._id, { assignedTo: [owner.user._id] });

    await request(app).patch('/api/v1/users/me').set(bearer(owner.token)).send({ displayName: 'New Name', avatar: 'amber' }).expect(200);

    const storedParty = await Party.findById(party._id).lean();
    assert.equal(storedParty.recentMembers[0].displayName, 'New Name');
    assert.equal(storedParty.recentMembers[0].avatar, 'amber');
    const storedTask = await Task.findOne({ partyId: party._id }).lean();
    assert.equal(storedTask.assignedToNames[0].displayName, 'New Name');
  });

  it('rejects an empty update', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).patch('/api/v1/users/me').set(bearer(token)).send({}).expect(400);
    assert.match(res.body.error.message, /at least one field/);
  });
});
