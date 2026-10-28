import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** 404 for any route that didn't match. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}.`));
}

/** Converts known error types into an ApiError with the right HTTP status. */
function normalise(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest(details[0]?.message || 'The data is invalid.', details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}.`, [{ field: err.path, message: 'Invalid value.' }]);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    return field === 'email'
      ? ApiError.conflict('An account with that email already exists. Sign in instead.')
      : ApiError.conflict(`That ${field} is already in use.`);
  }
  // Errors raised by express.json() for bad request bodies.
  if (err?.type === 'entity.parse.failed') return new ApiError(400, 'The request body is not valid JSON.', { code: 'BAD_JSON' });
  if (err?.type === 'entity.too.large') return new ApiError(413, 'The request body is too large.');
  if (err?.name === 'MongoServerSelectionError' || err?.name === 'MongoNetworkError') {
    return new ApiError(503, 'The database is unavailable right now. Try again shortly.');
  }
  return null;
}

/** Global error handler: every error leaves the API as { error: { status, code, message, details? } }. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // let Express close a response that already started
  const apiError = normalise(err);
  const status = apiError?.status ?? 500;

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  const body = {
    error: {
      status,
      code: apiError?.code ?? 'INTERNAL_ERROR',
      message: apiError?.message ?? 'Something went wrong on our side. Try again in a moment.',
    },
  };
  if (apiError?.details) body.error.details = apiError.details;
  if (!apiError && !env.isProd) body.error.debug = err?.message; // never exposed in production

  res.status(status).json(body);
}
