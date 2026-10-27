// Request schemas (zod). Strict objects reject unexpected fields, so clients can't set
// server-owned values such as currentXp, role or createdBy.
import { z } from 'zod';
import { AVATAR_COLOURS, PARTY_VISIBILITY, TASK_PRIORITIES, TASK_STATUSES } from '../models/constants.js';

const text = (label, { min = 1, max }) =>
  z
    .string({ error: (issue) => (issue.input === undefined ? `${label} is required.` : `${label} must be text.`) })
    .trim()
    .min(min, min === 1 ? `${label} can't be empty.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label, max) =>
  z.string({ error: `${label} must be text.` }).trim().max(max, `${label} must be ${max} characters or fewer.`);

export const objectId = (label = 'id') =>
  z.string({ error: `${label} is required.` }).regex(/^[a-f\d]{24}$/i, `That ${label} isn't valid.`);

const email = z
  .string({ error: (issue) => (issue.input === undefined ? 'Email is required.' : 'Email must be text.') })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be 254 characters or fewer.')
  .pipe(z.email({ error: 'Enter a valid email address.' }));

const password = z
  .string({ error: (issue) => (issue.input === undefined ? 'Password is required.' : 'Password must be text.') })
  .min(8, 'Use at least 8 characters for your password.')
  .max(128, 'Passwords are limited to 128 characters.');

const boolean = (label) => z.boolean({ error: `${label} must be true or false.` });

const dueDate = z
  .string({ error: 'Due date must be a date string.' })
  .nullable()
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Enter a valid due date.')
  .transform((v) => (v === null ? null : new Date(v)));

const atLeastOneField = (schema) =>
  schema.refine((value) => Object.keys(value).length > 0, { error: 'Send at least one field to update.' });

// ---- Auth (Assessment 1 §4: POST /auth/register, POST /auth/login)
export const registerSchema = z.strictObject({
  email,
  password,
  displayName: text('Display name', { max: 50 }),
  avatar: z.enum(AVATAR_COLOURS, { error: 'Choose one of the avatar colours.' }).optional(),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(128),
});

// ---- Users
export const updateMeSchema = atLeastOneField(
  z.strictObject({
    displayName: text('Display name', { max: 50 }).optional(),
    avatar: z.enum(AVATAR_COLOURS, { error: 'Choose one of the avatar colours.' }).optional(),
    settings: z
      .strictObject({
        notificationsEnabled: boolean('Teammate alerts').optional(),
        audioEnabled: boolean('Audio cues').optional(),
        highContrastMode: boolean('High contrast').optional(),
      })
      .optional(),
  }),
);

// ---- Parties
export const partyParamsSchema = z.object({ partyId: objectId('party id') });

export const createPartySchema = z.strictObject({
  name: text('Party name', { max: 100 }),
  description: optionalText('Description', 500).optional(),
});

export const updatePartySchema = atLeastOneField(
  z.strictObject({
    name: text('Party name', { max: 100 }).optional(),
    description: optionalText('Description', 500).optional(),
    settings: z
      .strictObject({
        visibility: z.enum(PARTY_VISIBILITY, { error: 'Visibility must be private or public.' }).optional(),
        archived: boolean('Archived').optional(),
      })
      .optional(),
  }),
);

export const addMemberSchema = z.union([z.strictObject({ email }), z.strictObject({ userId: objectId('user id') })], {
  error: 'Send the email address of the person to add.',
});

export const memberParamsSchema = z.object({ partyId: objectId('party id'), userId: objectId('user id') });

// ---- Tasks ("Quests")
export const taskParamsSchema = z.object({ partyId: objectId('party id'), taskId: objectId('task id') });

const assignees = z.array(objectId('assignee id'), { error: 'assignedTo must be a list of user ids.' }).max(20, 'Assign 20 people or fewer.');

export const createTaskSchema = z.strictObject({
  title: text('Title', { max: 200 }),
  description: optionalText('Description', 5000).optional(),
  pointValue: z
    .number({ error: 'Points must be a number from 1 to 50.' })
    .int('Points must be a whole number.')
    .min(1, 'Points must be between 1 and 50.')
    .max(50, 'Points must be between 1 and 50.'),
  priority: z.enum(TASK_PRIORITIES, { error: 'Priority must be low, medium or high.' }).optional(),
  dueDate: dueDate.optional(),
  assignedTo: assignees.optional(),
});

export const updateTaskSchema = atLeastOneField(
  z.strictObject({
    title: text('Title', { max: 200 }).optional(),
    description: optionalText('Description', 5000).optional(),
    priority: z.enum(TASK_PRIORITIES, { error: 'Priority must be low, medium or high.' }).optional(),
    dueDate: dueDate.optional(),
    assignedTo: assignees.optional(),
    status: z.enum(TASK_STATUSES, { error: 'Status must be todo, in_progress or done.' }).optional(),
    // Part of the Assessment 1 request body; accepted but ignored (the server uses the signed-in user).
    completedBy: objectId('completedBy').optional(),
    // Assessment 1 §3.5: pointValue is immutable once the quest exists.
    pointValue: z.never({ error: "Points can't be changed after a quest is created." }).optional(),
  }),
);

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES, { error: 'status must be todo, in_progress or done.' }).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'pointValue', 'title', 'completedAt'], { error: 'Unsupported sortBy value.' }).default('createdAt'),
  order: z.enum(['asc', 'desc'], { error: 'order must be asc or desc.' }).optional(),
  limit: z.coerce.number({ error: 'limit must be a number.' }).int().min(1, 'limit must be at least 1.').max(200, 'limit can be at most 200.').default(100),
});
