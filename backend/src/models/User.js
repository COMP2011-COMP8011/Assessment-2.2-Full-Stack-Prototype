import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AVATAR_COLOURS, EMAIL_PATTERN, USER_ROLES } from './constants.js';

const { Schema } = mongoose;

const settingsSchema = new Schema(
  {
    notificationsEnabled: { type: Boolean, default: true },
    audioEnabled: { type: Boolean, default: true },
    highContrastMode: { type: Boolean, default: false },
  },
  { _id: false },
);

// Users collection — Assessment 1 §3.3.
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true, // unique index: fast login lookups and no duplicate registrations (§3.9)
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email addresses are limited to 254 characters.'],
      match: [EMAIL_PATTERN, 'Enter a valid email address.'],
    },
    // Stored as a bcrypt hash, never as plain text (see the pre-save hook below).
    // `select: false` keeps it out of every query result unless a query asks for it (only login does).
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Use at least 8 characters for your password.'], // checked before hashing
      select: false,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required.'],
      trim: true,
      minlength: [1, "Display name can't be empty."],
      maxlength: [50, 'Display names are limited to 50 characters.'],
    },
    avatar: {
      type: String,
      enum: { values: AVATAR_COLOURS, message: '"{VALUE}" is not one of the avatar colours.' },
      default: 'teal',
    },
    role: { type: String, enum: { values: USER_ROLES, message: '"{VALUE}" is not a valid role.' }, default: 'user' },
    // Inverse of Party.memberIds, kept in sync inside transactions (§3.6, Relationship 1).
    partyIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Party' }], default: [] },
    totalXpEarned: {
      type: Number,
      default: 0,
      min: [0, "XP can't be negative."],
      validate: { validator: Number.isInteger, message: 'XP must be a whole number.' },
    },
    settings: { type: settingsSchema, default: () => ({}) },
    // Addition for 2.2: drives the "online" dot on party member avatars (Assessment 1, Screen 3).
    lastSeenAt: { type: Date, default: null },
  },
  {
    timestamps: true, // createdAt / updatedAt (§3.3)
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password; // "Never returned in API responses" (§3.3)
        return ret;
      },
    },
  },
);

userSchema.index({ partyIds: 1 }); // §3.9: "What parties does this user belong to?"

// Hash the password with bcrypt (12 salt rounds by default, minimum 10) whenever it changes.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
});

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
