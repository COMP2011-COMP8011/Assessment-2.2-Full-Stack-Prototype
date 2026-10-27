import mongoose from 'mongoose';
import { INITIAL_THRESHOLD } from '../utils/xp.js';
import { PARTY_VISIBILITY, RECENT_MEMBERS_LIMIT } from './constants.js';

const { Schema } = mongoose;

const wholeNumber = (label) => ({ validator: Number.isInteger, message: `${label} must be a whole number.` });
const noDuplicates = (label) => ({
  validator: (ids) => new Set(ids.map(String)).size === ids.length,
  message: `${label} can't contain the same person twice.`,
});

const memberSnapshotSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: 'teal' },
  },
  { _id: false },
);

// Parties collection — Assessment 1 §3.4.
const partySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Party name is required.'],
      trim: true,
      minlength: [1, "Party name can't be empty."],
      maxlength: [100, 'Party names are limited to 100 characters.'],
    },
    description: { type: String, trim: true, maxlength: [500, 'Descriptions are limited to 500 characters.'], default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'A party needs an owner.'] },
    // Source of truth for membership (§3.4). Indexed so "parties containing user X" is fast.
    memberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: noDuplicates('Members'),
    },
    // Denormalised caches (§3.7) so party cards render without fetching User documents.
    memberCount: { type: Number, default: 0, min: [0, "Member count can't be negative."], validate: wholeNumber('Member count') },
    recentMembers: {
      type: [memberSnapshotSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= RECENT_MEMBERS_LIMIT,
        message: `recentMembers holds at most ${RECENT_MEMBERS_LIMIT} entries.`,
      },
    },
    currentLevel: { type: Number, default: 1, min: [1, 'Levels start at 1.'], validate: wholeNumber('Level') },
    currentXp: { type: Number, default: 0, min: [0, "XP can't be negative."], validate: wholeNumber('XP') },
    totalXpEarned: { type: Number, default: 0, min: [0, "XP can't be negative."], validate: wholeNumber('XP') }, // never decreases
    xpLevelThreshold: { type: Number, default: INITIAL_THRESHOLD, min: [1, 'The level threshold must be positive.'] },
    settings: {
      visibility: {
        type: String,
        enum: { values: PARTY_VISIBILITY, message: 'Visibility must be private or public.' },
        default: 'private',
      },
      archived: { type: Boolean, default: false },
    },
  },
  { timestamps: true, versionKey: false, id: false, toJSON: { virtuals: true } },
);

partySchema.index({ memberIds: 1 }); // §3.9
partySchema.index({ createdBy: 1 }); // §3.9

// Full member profiles, resolved with populate() only where a screen needs them (Party view).
partySchema.virtual('members', { ref: 'User', localField: 'memberIds', foreignField: '_id' });

export const Party = mongoose.models.Party || mongoose.model('Party', partySchema);
