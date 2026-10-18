import { createApiError } from "./error-handler.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CURSOR_LENGTH = 2048;

export function parsePagination(request, _response, next) {
  const { cursor, limit } = request.query;

  if (
    cursor !== undefined &&
    (typeof cursor !== "string" || cursor.length > MAX_CURSOR_LENGTH)
  ) {
    return next(
      createApiError(
        400,
        "INVALID_CURSOR",
        "Cursor must be a string of at most 2048 characters.",
      ),
    );
  }

  if (
    limit !== undefined &&
    (typeof limit !== "string" || !/^\d+$/.test(limit))
  ) {
    return next(
      createApiError(
        400,
        "INVALID_LIMIT",
        "Limit must be an integer from 1 to 100.",
      ),
    );
  }

  const parsedLimit = limit === undefined ? DEFAULT_LIMIT : Number(limit);
  if (
    !Number.isSafeInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_LIMIT
  ) {
    return next(
      createApiError(
        400,
        "INVALID_LIMIT",
        "Limit must be an integer from 1 to 100.",
      ),
    );
  }

  request.pagination = Object.freeze({
    cursor,
    limit: parsedLimit,
  });
  return next();
}

export function paginatedResponse(response, items, nextCursor = null) {
  return response.json({ items, nextCursor });
}
