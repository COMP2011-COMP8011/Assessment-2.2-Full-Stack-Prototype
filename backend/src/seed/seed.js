// CLI: `npm run seed` (seed an empty database) or `npm run seed:reset` (wipe and reseed).
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { DEMO_EMAILS, DEMO_PASSWORD, seedDatabase } from './seedData.js';

const reset = process.argv.includes('--reset');

if (!env.mongoUri) {
  console.log('MONGODB_URI is not set, so `npm run dev` uses a temporary in-memory database that seeds itself on start-up.');
  console.log('Set MONGODB_URI in backend/.env to seed a real database (e.g. MongoDB Atlas).');
  process.exit(0);
}

try {
  const db = await connectDatabase();
  const existing = await User.estimatedDocumentCount();
  if (existing > 0 && !reset) {
    console.log(`"${db.dbName}" already has ${existing} user(s). Run \`npm run seed:reset\` to wipe it and load the demo data again.`);
  } else {
    const counts = await seedDatabase();
    console.log(`Seeded "${db.dbName}": ${counts.users} users, ${counts.parties} parties, ${counts.tasks} quests.`);
    console.log(`Demo accounts (password "${DEMO_PASSWORD}"): ${DEMO_EMAILS.join(', ')}`);
  }
} catch (err) {
  console.error(`Seeding failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
