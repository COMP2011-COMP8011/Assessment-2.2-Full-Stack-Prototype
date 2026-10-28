import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { DEMO_EMAILS, DEMO_PASSWORD, seedIfEmpty } from './seed/seedData.js';

function printBanner(db, seeded) {
  const line = '─'.repeat(72);
  console.log(`\n${line}`);
  console.log(` TaskParty API listening on port ${env.port}`);
  console.log(` API base URL      ${env.publicApiUrl}/api/v1`);
  console.log(` Database          ${db.mode === 'in-memory' ? 'in-memory demo database (resets when the API stops)' : `"${db.dbName}" at ${db.uri}`}`);
  console.log(` Allowed origins   ${env.clientOrigins.join(', ')}`);
  if (seeded) console.log(` Seeded demo data  ${seeded.users} users, ${seeded.parties} parties, ${seeded.tasks} quests`);
  console.log(` Demo accounts     ${DEMO_EMAILS.join(', ')} (password: ${DEMO_PASSWORD})`);
  if (env.jwtSecretGenerated) {
    console.log(' Warning           JWT_SECRET is not set: using a temporary secret, so sign-ins reset when the API restarts.');
  }
  console.log(`${line}\n`);
}

async function main() {
  const db = await connectDatabase();
  const seeded = env.seedOnEmpty ? await seedIfEmpty() : null;

  const server = http.createServer(createApp());
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[startup] Port ${env.port} is already in use. Stop the other process or set PORT in backend/.env.`);
    } else {
      console.error('[startup]', err);
    }
    process.exit(1);
  });
  server.listen(env.port, () => printBanner(db, seeded));

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — closing the API.`);
    server.close();
    await disconnectDatabase().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(`[startup] ${err.message}`);
  const text = `${err.name} ${err.message}`;
  if (/Download failed|DownloadError/i.test(text)) {
    console.error('[startup] The in-memory demo database downloads MongoDB on first use and that download failed.');
    console.error('[startup] Check your internet connection, or set MONGODB_URI in backend/.env to use MongoDB Atlas instead.');
  } else if (/ECONNREFUSED|ServerSelection|querySrv|ENOTFOUND|bad auth|Authentication failed/i.test(text)) {
    console.error('[startup] Check MONGODB_URI in backend/.env. On MongoDB Atlas, also allow your IP under Network Access (Codespaces needs 0.0.0.0/0).');
  }
  process.exit(1);
});
