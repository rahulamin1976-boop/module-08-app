import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiError,
  errorHandler,
} from "../../src/middleware/error-handler.js";
import { validateObjectBody } from "../../src/middleware/validate-request.js";

const validateName = validateObjectBody({
  name: {
    required: true,
    validate: (value) => typeof value === "string" && value.length > 0,
  },
});

function validate(body) {
  let result;
  validateName({ body }, {}, (error) => {
    result = error;
  });
  return result;
}

test("object validation accepts valid fields", () => {
  assert.equal(validate({ name: "Weekly report" }), undefined);
});

test("object validation rejects missing, invalid, and unknown fields", () => {
  assert.equal(validate({}).code, "MISSING_FIELD");
  assert.equal(validate({ name: "" }).code, "INVALID_FIELD");
  assert.equal(
    validate({ name: "Report", unexpected: true }).code,
    "UNKNOWN_FIELD",
  );
  assert.equal(validate([]).code, "INVALID_REQUEST");
});

test("error handler returns a structured safe error envelope", () => {
  let status;
  let responseBody;
  const response = {
    headersSent: false,
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      responseBody = value;
    },
  };

  errorHandler(
    createApiError(400, "INVALID_FIELD", "Invalid field."),
    {},
    response,
    assert.fail,
  );

  assert.equal(status, 400);
  assert.deepEqual(responseBody, {
    error: { code: "INVALID_FIELD", message: "Invalid field." },
  });
});
