import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';

// Only the frontend origins listed in CLIENT_ORIGIN (plus the Codespaces-forwarded
// frontend URL, detected automatically) may call the API from a browser.
export const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (curl, Postman, server-to-server) aren't subject to CORS.
    if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
    console.warn(`[cors] Blocked request from ${origin}. Allowed: ${env.clientOrigins.join(', ')}`);
    return callback(
      new ApiError(403, `Origin ${origin} is not allowed to call this API. Add it to CLIENT_ORIGIN in backend/.env.`, {
        code: 'CORS_REJECTED',
      }),
    );
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // cache preflight responses for 10 minutes
};
