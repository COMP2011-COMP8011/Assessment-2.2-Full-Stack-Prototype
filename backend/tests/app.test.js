import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, it, mock } from 'node:test';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { Task } from '../src/models/index.js';
import { isTransactionUnsupportedError } from '../src/utils/transaction.js';
import { applyXp, nextThreshold } from '../src/utils/xp.js';
import { bearer, createPartyWith, registerUser, startTestApp, stopTestApp } from './helpers.js';

let app;
before(async () => { app = await startTestApp(); });
after(stopTestApp);

describe('Global error handling', () => {
  it('answers unknown routes with a 404 JSON error', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'message', 'status']);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('answers malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "oops"')
      .expect(400);
    assert.equal(res.body.error.code, 'BAD_JSON');
  });

  it('turns unexpected failures into a 500 with a generic message', async () => {
    const owner = await registerUser(app);
    const party = await createPartyWith(app, owner);
    const restore = mock.method(Task, 'find', () => {
      throw new Error('disk on fire');
    });
    try {
      const res = await request(app).get(`/api/v1/parties/${party._id}/tasks`).set(bearer(owner.token)).expect(500);
      assert.equal(res.body.error.code, 'INTERNAL_ERROR');
      assert.match(res.body.error.message, /Something went wrong/);
      assert.equal(res.body.error.message.includes('disk on fire'), false);
    } finally {
      restore.mock.restore();
    }
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const origin = env.clientOrigins[0];
    const res = await request(app)
      .options('/api/v1/parties')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    assert.equal(res.headers['access-control-allow-origin'], origin);
    assert.match(res.headers['access-control-allow-headers'], /Authorization/i);
  });

  it('rejects any other origin with 403', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example').expect(403);
    assert.equal(res.body.error.code, 'CORS_REJECTED');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });
});

describe('Routing', () => {
  it('serves the same API at /api/v1 (Assessment 1) and /api (2.2 brief)', async () => {
    const { token, user } = await registerUser(app);
    const v1 = await request(app).get('/api/v1/users/me').set(bearer(token)).expect(200);
    const alias = await request(app).get('/api/users/me').set(bearer(token)).expect(200);
    assert.equal(v1.body.user._id, user._id);
    assert.deepEqual(alias.body, v1.body);
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
  });
});

describe('XP rules', () => {
  it('follow Assessment 1: threshold = level × 1000 + 1000, reset to 0 on level-up', () => {
    assert.equal(nextThreshold(1), 2000);
    assert.equal(nextThreshold(3), 4000);
    const party = { currentLevel: 1, currentXp: 1990, xpLevelThreshold: 2000, totalXpEarned: 1990 };
    assert.deepEqual(applyXp(party, 5), { currentLevel: 1, currentXp: 1995, xpLevelThreshold: 2000, totalXpEarned: 1995, levelledUp: false });
    assert.deepEqual(applyXp(party, 10), { currentLevel: 2, currentXp: 0, xpLevelThreshold: 3000, totalXpEarned: 2000, levelledUp: true });
    assert.equal(party.currentXp, 1990, 'input is not mutated');
  });

  const frontendXp = new URL('../../frontend/src/logic/xp.js', import.meta.url);
  it('match the frontend copy used for optimistic updates', { skip: !existsSync(frontendXp) && 'frontend not present' }, async () => {
    const client = await import(frontendXp.href);
    for (const level of [1, 2, 5]) {
      for (const xp of [0, 1500, nextThreshold(level) - 1]) {
        for (const gain of [1, 25, 50]) {
          const party = { currentLevel: level, currentXp: xp, xpLevelThreshold: nextThreshold(level), totalXpEarned: xp + 500 };
          const server = applyXp(party, gain);
          const predicted = client.applyXp(party, gain);
          const { levelledUp, ...fields } = server;
          assert.deepEqual({ ...predicted.party, levelledUp: predicted.levelledUp }, { ...party, ...fields, levelledUp });
        }
      }
    }
  });
});

describe('Transaction fallback', () => {
  it('recognises the errors a standalone MongoDB returns for transactions', () => {
    assert.equal(isTransactionUnsupportedError({ code: 20, message: 'Transaction numbers are only allowed on a replica set member or mongos' }), true);
    assert.equal(
      isTransactionUnsupportedError({ message: 'This MongoDB deployment does not support retryable writes. Please add retryWrites=false to your connection string.', originalError: { code: 20 } }),
      true,
    );
    assert.equal(isTransactionUnsupportedError({ code: 11000, message: 'E11000 duplicate key' }), false);
  });
});
