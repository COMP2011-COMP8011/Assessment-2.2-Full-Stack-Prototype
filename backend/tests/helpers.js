// Shared test setup. Each test file gets a fresh database: an in-memory MongoDB replica set
// (mongodb-memory-server) by default, or TEST_MONGODB_URI if you want to point at your own.
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Party, Task, User } from '../src/models/index.js';

let memoryServer = null;

export async function startTestApp() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server-core');
    memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = memoryServer.getUri();
  }
  await connectDatabase({ uri, dbName: `taskparty_test_${process.pid}` });
  return createApp();
}

export async function stopTestApp() {
  await mongoose.connection.dropDatabase().catch(() => {});
  await disconnectDatabase();
  if (memoryServer) await memoryServer.stop();
}

export async function resetDatabase() {
  await Promise.all([User.deleteMany({}), Party.deleteMany({}), Task.deleteMany({})]);
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
/** Registers a user through the API and returns { token, user }. */
export async function registerUser(app, overrides = {}) {
  counter += 1;
  const body = {
    email: `player${counter}@example.com`,
    password: 'correct-horse-9',
    displayName: `Player ${counter}`,
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(body).expect(201);
  return { token: res.body.token, user: res.body.user, password: body.password };
}

/** Creates a party owned by `owner` and adds the other users as members. Returns the party JSON. */
export async function createPartyWith(app, owner, members = [], name = 'Test Party') {
  const created = await request(app).post('/api/v1/parties').set(bearer(owner.token)).send({ name }).expect(201);
  let party = created.body; // §4: POST /parties returns the new party itself
  for (const member of members) {
    const res = await request(app)
      .post(`/api/v1/parties/${party._id}/members`)
      .set(bearer(owner.token))
      .send({ email: member.user.email })
      .expect(200);
    party = res.body.party;
  }
  return party;
}

export async function createTask(app, who, partyId, overrides = {}) {
  const res = await request(app)
    .post(`/api/v1/parties/${partyId}/tasks`)
    .set(bearer(who.token))
    .send({ title: 'Write the report', pointValue: 10, ...overrides })
    .expect(201);
  return res.body; // §4: POST /parties/:partyId/tasks returns the new task itself
}
