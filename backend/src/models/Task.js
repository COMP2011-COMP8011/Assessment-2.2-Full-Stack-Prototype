import mongoose from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES } from './constants.js';

const { Schema } = mongoose;

const MAX_ASSIGNEES = 20;

const assigneeSnapshotSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
  },
  { _id: false },
);

// Tasks ("Quests") collection — Assessment 1 §3.5.
const taskSchema = new Schema(
  {
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: [true, 'A quest must belong to a party.'] },
    title: {
      type: String,
      required: [true, 'Give the quest a title.'],
      trim: true,
      minlength: [1, "The title can't be empty."],
      maxlength: [200, 'Titles are limited to 200 characters.'],
    },
    description: { type: String, trim: true, maxlength: [5000, 'Descriptions are limited to 5,000 characters.'], default: '' },
    pointValue: {
      type: Number,
      required: [true, 'Points are required.'],
      min: [1, 'Points must be between 1 and 50.'],
      max: [50, 'Points must be between 1 and 50.'],
      validate: { validator: Number.isInteger, message: 'Points must be a whole number.' },
      immutable: true, // "Immutable after creation" (§3.5)
    },
    status: {
      type: String,
      enum: { values: TASK_STATUSES, message: '"{VALUE}" is not a valid status (todo, in_progress or done).' },
      default: 'todo',
    },
    priority: {
      type: String,
      enum: { values: TASK_PRIORITIES, message: '"{VALUE}" is not a valid priority (low, medium or high).' },
      default: 'medium',
    },
    assignedTo: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: [
        { validator: (ids) => ids.length <= MAX_ASSIGNEES, message: `Assign ${MAX_ASSIGNEES} people or fewer.` },
        { validator: (ids) => new Set(ids.map(String)).size === ids.length, message: 'Each person can only be assigned once.' },
      ],
    },
    // Denormalised cache (§3.7): task cards show assignee names without fetching users.
    assignedToNames: { type: [assigneeSnapshotSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null }, // set in the same transaction as the XP award (§3.8)
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

taskSchema.index({ partyId: 1, status: 1 }); // compound index for Kanban queries (§3.9)
taskSchema.index({ dueDate: 1 }); // §3.9
taskSchema.index({ assignedTo: 1 }); // §3.9

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
