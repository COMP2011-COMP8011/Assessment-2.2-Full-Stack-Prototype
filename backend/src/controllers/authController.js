import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/tokens.js';

// Comparing against a throwaway hash when the email is unknown keeps the response time the
// same either way, so the login form can't be used to discover which emails have accounts.
let timingGuardHash;
const timingGuard = async () => (timingGuardHash ??= await bcrypt.hash('taskparty-timing-guard', 10));

/** POST /auth/register — create an account and sign the user in. */
export async function register(req, res) {
  const { email, password, displayName, avatar } = req.valid.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with that email already exists. Sign in instead.');

  const user = await User.create({ email, password, displayName, avatar, lastSeenAt: new Date() });
  const { token, expiresIn } = signAccessToken(user._id);
  res.status(201).json({ message: 'User created successfully', userId: user._id, user: user.toJSON(), token, expiresIn });
}

/** POST /auth/login — check credentials and issue a JWT (24-hour expiry). */
export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+password');
  const passwordOk = user ? await user.verifyPassword(password) : await bcrypt.compare(password, await timingGuard());
  if (!user || !passwordOk) throw ApiError.unauthenticated('Email or password is incorrect.');

  User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  const { token, expiresIn } = signAccessToken(user._id);
  res.json({ message: 'Signed in', userId: user._id, user: user.toJSON(), token, expiresIn });
}
