import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiRequest } from "../src/services/api-client.js";

test("apiRequest sends same-origin JSON requests and returns the payload", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestUrl;
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify({ id: "report-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await apiRequest("/api/v1/reports", {
    method: "POST",
    body: { projectId: "project-1" },
  });

  assert.equal(requestUrl, "/api/v1/reports");
  assert.equal(requestOptions.credentials, "same-origin");
  assert.equal(requestOptions.headers.get("Content-Type"), "application/json");
  assert.equal(requestOptions.body, '{"projectId":"project-1"}');
  assert.deepEqual(result, { id: "report-1" });
});

test("apiRequest exposes structured server errors without logging them", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { code: "REPORT_NOT_FOUND", message: "Report not found." } }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    apiRequest("/api/v1/reports/missing"),
    (error) => error instanceof ApiError &&
      error.status === 404 &&
      error.code === "REPORT_NOT_FOUND" &&
      error.message === "Report not found.",
  );
});

test("apiRequest rejects non-API paths before fetching", async () => {
  await assert.rejects(
    apiRequest("https://example.com/api/v1/reports"),
    TypeError,
  );
});
