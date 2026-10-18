export function createApiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.exposeApiMessage = true;
  return error;
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const hasHttpStatus =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 600;
  const status = hasHttpStatus ? error.status : 500;
  const isClientError = status < 500;
  if (error.retryAfter !== undefined) {
    response.setHeader("Retry-After", String(error.retryAfter));
  }
  const code =
    typeof error.code === "string"
      ? error.code
      : isClientError
        ? "INVALID_REQUEST"
        : "INTERNAL_ERROR";
  const message =
    (isClientError || error.exposeApiMessage === true) &&
    typeof error.code === "string"
      ? error.message
      : isClientError
        ? "Request could not be processed."
        : "An unexpected error occurred.";

  if (!isClientError && error.exposeApiMessage !== true) {
    console.error("Unhandled API error:", error.name);
  }

  const body = { code, message };
  if (
    (isClientError || error.exposeApiMessage === true) &&
    error.details !== null &&
    typeof error.details === "object" &&
    !Array.isArray(error.details)
  ) {
    body.details = error.details;
  }
  response.status(status).json({ error: body });
}
