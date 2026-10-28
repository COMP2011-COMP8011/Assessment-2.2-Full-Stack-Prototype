// Loads the demo dataset (seed/demoData.json — the users, parties and quests that were the
// frontend's mockData.json in Assessment 2.1) into MongoDB. The frontend no longer has any mock data.
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { RECENT_MEMBERS_LIMIT } from '../models/constants.js';
import { Party, Task, User } from '../models/index.js';
import { nextThreshold } from '../utils/xp.js';

export const DEMO_PASSWORD = 'password123';
const DAY_MS = 24 * 60 * 60 * 1000;

const data = JSON.parse(readFileSync(new URL('./demoData.json', import.meta.url), 'utf8'));
export const DEMO_EMAILS = data.users.map((u) => u.email);

/** Builds documents from the demo data: its short ids ("u1", "p1"...) become real ObjectIds. */
function buildDocuments(now, passwordHash) {
  const ids = new Map();
  const oid = (key) => {
    if (!ids.has(key)) ids.set(key, new mongoose.Types.ObjectId());
    return ids.get(key);
  };
  const at = (days) => (days === null || days === undefined ? null : new Date(now + days * DAY_MS));
  const userByKey = new Map(data.users.map((u) => [u._id, u]));

  const users = data.users.map((u) => ({
    _id: oid(u._id),
    email: u.email,
    password: passwordHash,
    displayName: u.displayName,
    avatar: u.avatar,
    role: 'user',
    // Derived from Party.memberIds, the source of truth for membership.
    partyIds: data.parties.filter((p) => p.memberIds.includes(u._id)).map((p) => oid(p._id)),
    totalXpEarned: u.totalXpEarned,
    settings: u.settings,
    lastSeenAt: null,
  }));

  const parties = data.parties.map((p) => ({
    _id: oid(p._id),
    name: p.name,
    description: p.description,
    createdBy: oid(p.createdBy),
    memberIds: p.memberIds.map(oid),
    memberCount: p.memberIds.length,
    recentMembers: p.memberIds
      .slice(-RECENT_MEMBERS_LIMIT)
      .reverse()
      .map((key) => ({ userId: oid(key), displayName: userByKey.get(key).displayName, avatar: userByKey.get(key).avatar })),
    currentLevel: p.currentLevel,
    currentXp: p.currentXp,
    totalXpEarned: p.totalXpEarned,
    xpLevelThreshold: nextThreshold(p.currentLevel),
    settings: p.settings,
    createdAt: at(-p.createdDaysAgo),
    updatedAt: at(0),
  }));

  const tasks = data.tasks.map((t) => ({
    _id: oid(t._id),
    partyId: oid(t.partyId),
    title: t.title,
    description: t.description,
    pointValue: t.pointValue,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignedTo.map(oid),
    assignedToNames: t.assignedTo.map((key) => ({ userId: oid(key), displayName: userByKey.get(key).displayName })),
    createdBy: oid(t.createdBy),
    dueDate: at(t.dueInDays),
    completedAt: t.completedDaysAgo === undefined ? null : at(-t.completedDaysAgo),
    completedBy: t.completedBy ? oid(t.completedBy) : null,
    createdAt: at(-t.createdDaysAgo),
    updatedAt: at(t.completedDaysAgo === undefined ? -t.createdDaysAgo : -t.completedDaysAgo),
  }));

  return { users, parties, tasks };
}

/** Replaces all users, parties and quests with the demo data. */
export async function seedDatabase({ now = Date.now() } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);
  const { users, parties, tasks } = buildDocuments(now, passwordHash);

  await Promise.all([User.deleteMany({}), Party.deleteMany({}), Task.deleteMany({})]);
  // Passwords are pre-hashed above, and createdAt values are part of the demo story.
  await User.insertMany(users);
  await Party.insertMany(parties, { timestamps: false });
  await Task.insertMany(tasks, { timestamps: false });

  return { users: users.length, parties: parties.length, tasks: tasks.length };
}

/** Seeds only when the database has no users yet (first run). */
export async function seedIfEmpty() {
  if ((await User.estimatedDocumentCount()) > 0) return null;
  return seedDatabase();
}
