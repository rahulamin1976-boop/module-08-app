import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createReportRouter } from "../../src/routes/report-routes.js";

async function startTestServer(t, reportRouter) {
  const apiRouter = Router();
  apiRouter.use("/reports", reportRouter);
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function createRouter({
  connected = false,
  pool = { query: async () => ({ rowCount: 0, rows: [] }) },
} = {}) {
  return createReportRouter({
    pool,
    connectionService: {
      async getState() {
        return connected
          ? { connected: true, account: { id: "account-id" } }
          : { connected: false };
      },
    },
    getJiraClient: async () => {
      throw new Error("Jira client must not be requested for rejected requests");
    },
  });
}

test("report list validates exact filters and preserves the pagination envelope", async (t) => {
  const origin = await startTestServer(t, createRouter());
  const invalid = await fetch(`${origin}/api/v1/reports?unexpected=true`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "UNKNOWN_FIELD");

  const invalidStatus = await fetch(`${origin}/api/v1/reports?status=unknown`);
  assert.equal(invalidStatus.status, 400);
  assert.equal((await invalidStatus.json()).error.code, "INVALID_STATUS");
});

test("report creation rejects unknown fields before contacting Atlassian", async (t) => {
  const origin = await startTestServer(t, createRouter());
  const response = await fetch(`${origin}/api/v1/reports`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: "50e26a1e-c471-4e54-a938-26269bd764b3",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-16",
      timezone: "UTC",
      jiraUpdates: [],
      manualUpdates: [],
      confirmedEmptyCategories: [],
      status: "published",
    }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_REQUEST");
});

test("report creation requires the connected Atlassian actor", async (t) => {
  const origin = await startTestServer(t, createRouter());
  const response = await fetch(`${origin}/api/v1/reports`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: "50e26a1e-c471-4e54-a938-26269bd764b3",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-16",
      timezone: "UTC",
      jiraUpdates: [],
      manualUpdates: [{ category: "accomplishment", text: "A verified update" }],
      confirmedEmptyCategories: [],
    }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "NOT_CONNECTED");
});

test("report read validates identifiers and returns structured not-found", async (t) => {
  const origin = await startTestServer(t, createRouter());
  const invalid = await fetch(`${origin}/api/v1/reports/not-a-uuid`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "INVALID_REPORT_ID");

  const absent = await fetch(
    `${origin}/api/v1/reports/d06014bc-a2bf-4152-99a4-a1d5968144ac`,
  );
  assert.equal(absent.status, 404);
  assert.equal((await absent.json()).error.code, "REPORT_NOT_FOUND");
});
