import { ApiError } from '../utils/ApiError.js';

const formatIssues = (issues, location) =>
  issues.map((issue) => ({
    field: [location, ...issue.path].filter((p) => p !== 'body').join('.') || location,
    message: issue.message,
  }));

/**
 * Validates req.body / req.params / req.query against zod schemas before a controller runs.
 * Strict schemas reject unknown fields (no mass assignment) and wrong types
 * (e.g. {"$gt": ""} instead of a string), so user input can't inject query operators.
 * Parsed values are exposed on req.valid.{body,params,query}.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const location of ['params', 'query', 'body']) {
      const schema = schemas[location];
      if (!schema) continue;
      const result = schema.safeParse(req[location] ?? {});
      if (!result.success) {
        const details = formatIssues(result.error.issues, location);
        throw ApiError.badRequest(details[0]?.message || 'The request is invalid.', details);
      }
      req.valid[location] = result.data;
    }
    next();
  };
}
