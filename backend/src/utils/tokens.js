import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Access tokens follow Assessment 1 §4: signed JWT, 24-hour expiry, sent as "Authorization: Bearer <token>".
export function signAccessToken(userId) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn, algorithm: 'HS256' });
  const { iat, exp } = jwt.decode(token);
  return { token, expiresIn: exp - iat };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}
