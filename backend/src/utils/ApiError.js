// An error with an HTTP status. Controllers throw these; the global error handler
// (middleware/errorHandler.js) turns them into consistent JSON responses.
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || DEFAULT_CODES[status] || 'ERROR';
    this.details = details;
  }

  static badRequest(message, details) { return new ApiError(400, message, { code: 'VALIDATION_ERROR', details }); }
  static unauthenticated(message = 'Sign in to continue.') { return new ApiError(401, message); }
  static forbidden(message) { return new ApiError(403, message); }
  static notFound(message) { return new ApiError(404, message); }
  static conflict(message) { return new ApiError(409, message); }
}
