import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Slows down password guessing on /auth routes.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, _res, next) =>
    next(new ApiError(429, 'Too many sign-in attempts. Wait a few minutes and try again.', { code: 'RATE_LIMITED' })),
});
