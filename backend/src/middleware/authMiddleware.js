// authMiddleware: protects routes (2.2 brief, part C).
//  - requireAuth         — a valid JWT is required ("Authorization: Bearer <token>"); loads req.user.
//  - requirePartyMember  — the signed-in user must be a member of :partyId before they can fetch,
//                          create, update or delete anything in that party (403 otherwise).
//  - requirePartyOwner   — only the party's creator (its admin) may continue.
import jwt from 'jsonwebtoken';
import { Party, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { isPartyMember, isPartyOwner } from '../utils/permissions.js';
import { verifyAccessToken } from '../utils/tokens.js';

const PRESENCE_WRITE_INTERVAL_MS = 60_000;

export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthenticated('Sign in to continue.');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw ApiError.unauthenticated('Your session has expired. Sign in again.');
    throw ApiError.unauthenticated('Your sign-in token is invalid. Sign in again.');
  }

  const user = await User.findById(payload.sub).lean(); // the password hash is never selected
  if (!user) throw ApiError.unauthenticated('This account no longer exists.');
  req.user = user;

  // Presence ("online" dot on member avatars): record activity at most once a minute.
  // Fire-and-forget, so it never slows the request down.
  const now = Date.now();
  if (!user.lastSeenAt || now - new Date(user.lastSeenAt).getTime() > PRESENCE_WRITE_INTERVAL_MS) {
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date(now) } }).catch(() => {});
  }
  next();
}

/** Loads req.params.partyId onto req.party; 404 if it doesn't exist, 403 if you're not a member. */
export async function requirePartyMember(req, _res, next) {
  const party = await Party.findById(req.params.partyId).lean();
  if (!party) throw ApiError.notFound('That party does not exist.');
  if (!isPartyMember(party, req.user._id)) throw ApiError.forbidden("You're not a member of this party.");
  req.party = party;
  next();
}

/** Must run after requirePartyMember. */
export function requirePartyOwner(req, _res, next) {
  if (!isPartyOwner(req.party, req.user._id)) throw ApiError.forbidden('Only the party owner can do that.');
  next();
}
