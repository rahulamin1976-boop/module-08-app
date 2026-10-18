import test from "node:test";
import assert from "node:assert/strict";
import {
  paginatedResponse,
  parsePagination,
} from "../../src/middleware/pagination.js";

function parse(query) {
  const request = { query };
  let error;
  parsePagination(request, {}, (received) => {
    error = received;
  });
  return { error, pagination: request.pagination };
}

test("pagination defaults to 50 and accepts a cursor and bounded limit", () => {
  assert.deepEqual(parse({}), {
    error: undefined,
    pagination: { cursor: undefined, limit: 50 },
  });
  assert.deepEqual(parse({ cursor: "opaque", limit: "100" }), {
    error: undefined,
    pagination: { cursor: "opaque", limit: 100 },
  });
});

test("pagination rejects invalid limits and oversized cursors", () => {
  for (const limit of ["0", "101", "1.5", "many"]) {
    assert.equal(parse({ limit }).error.code, "INVALID_LIMIT");
  }
  assert.equal(parse({ cursor: "x".repeat(2049) }).error.code, "INVALID_CURSOR");
});

test("paginatedResponse uses the documented response envelope", () => {
  let body;
  paginatedResponse(
    {
      json(value) {
        body = value;
      },
    },
    [{ id: "one" }],
    "next",
  );
  assert.deepEqual(body, { items: [{ id: "one" }], nextCursor: "next" });
});
