import { createApiError } from "./error-handler.js";

export function validateObjectBody(schema) {
  const allowedFields = new Set(Object.keys(schema));
  const requiredFields = Object.entries(schema)
    .filter(([, rule]) => rule.required)
    .map(([field]) => field);

  return (request, _response, next) => {
    const body = request.body;

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return next(
        createApiError(400, "INVALID_REQUEST", "Request body must be a JSON object."),
      );
    }

    const unknownFields = Object.keys(body).filter(
      (field) => !allowedFields.has(field),
    );

    if (unknownFields.length > 0) {
      return next(
        createApiError(
          400,
          "UNKNOWN_FIELD",
          `Unknown request field: ${unknownFields[0]}.`,
        ),
      );
    }

    for (const field of requiredFields) {
      if (!Object.hasOwn(body, field)) {
        return next(
          createApiError(
            400,
            "MISSING_FIELD",
            `Required request field is missing: ${field}.`,
          ),
        );
      }
    }

    for (const [field, value] of Object.entries(body)) {
      if (!schema[field].validate(value)) {
        return next(
          createApiError(
            400,
            "INVALID_FIELD",
            `Request field has an invalid value: ${field}.`,
          ),
        );
      }
    }

    return next();
  };
}
