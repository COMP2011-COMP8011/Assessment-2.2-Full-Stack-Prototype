import mongoose from 'mongoose';
import { env } from './env.js';
import { Party, Task, User } from '../models/index.js';

mongoose.set('strictQuery', true); // ignore filter fields that aren't in the schema

let memoryServer = null;
let databaseMode = 'disconnected';

/** Hides the password in a connection string before it is logged. */
export const redactUri = (uri) => uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');

async function startMemoryServer() {
  let MongoMemoryReplSet;
  try {
    ({ MongoMemoryReplSet } = await import('mongodb-memory-server-core'));
  } catch {
    throw new Error(
      'MONGODB_URI is not set and the in-memory database package is not installed. ' +
        'Set MONGODB_URI in backend/.env, or run `npm install` from the project root.',
    );
  }
  console.log('[db] MONGODB_URI is not set — starting a temporary in-memory MongoDB for demo use.');
  console.log('[db] The first run downloads the MongoDB binary (about a minute). Data resets when the server stops.');
  // A single-node replica set, so multi-document transactions work just like on Atlas.
  return MongoMemoryReplSet.create({ replSet: { count: 1 } });
}

/**
 * Connects Mongoose. Uses MONGODB_URI (e.g. MongoDB Atlas) when set; otherwise, outside
 * production, starts an in-memory MongoDB so the app runs with zero configuration.
 */
export async function connectDatabase({ uri = env.mongoUri, dbName = env.mongoDbName } = {}) {
  let target = uri;
  if (!target) {
    if (env.isProd) throw new Error('MONGODB_URI must be set in backend/.env when NODE_ENV=production.');
    memoryServer = await startMemoryServer();
    target = memoryServer.getUri();
  }

  await mongoose.connect(target, { dbName, serverSelectionTimeoutMS: 10_000 });
  // Build collections and indexes (unique email, compound partyId+status, ...) before serving traffic.
  await Promise.all([User.init(), Party.init(), Task.init()]);

  databaseMode = memoryServer ? 'in-memory' : 'mongodb';
  return { mode: databaseMode, uri: redactUri(target), dbName };
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  databaseMode = 'disconnected';
}

export const getDatabaseMode = () => databaseMode;
export const isDatabaseConnected = () => mongoose.connection.readyState === 1;
