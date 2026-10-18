import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createReportRouter } from "../../src/routes/report-routes.js";

const reportId = "d06014bc-a2bf-4152-99a4-a1d5968144ac";

async function startTestServer(t, { connected = true } = {}) {
  const apiRouter = Router();
  apiRouter.use("/reports", createReportRouter({
    pool: { query: async () => ({ rowCount: 0, rows: [] }) },
    connectionService: {
      async getState() {
        return connected
          ? { connected: true, account: { id: "account-id" } }
          : { connected: false };
      },
    },
    getJiraClient: async () => {
      throw new Error("Jira must not be accessed by report lifecycle routes.");
    },
  }));
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function sendJson(url, method, body) {
  return fetch(url, {
    method,
    headers: {
      Origin: new URL(url).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("report update rejects client-supplied provenance and unknown fields", async (t) => {
  const origin = await startTestServer(t);
  const response = await sendJson(`${origin}/api/v1/reports/${reportId}`, "PATCH", {
    version: 1,
    items: [{
      id: reportId,
      category: "accomplishment",
      text: "Updated text",
      sourceType: "jira",
      sourceSnapshot: { issueId: "forged" },
    }],
    confirmedEmptyCategories: [],
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_REPORT_ITEM");
});

test("report lifecycle mutations require exact explicit confirmation", async (t) => {
  const origin = await startTestServer(t);
  const approve = await sendJson(
    `${origin}/api/v1/reports/${reportId}/approve`,
    "POST",
    { confirm: false, extra: true },
  );
  assert.equal(approve.status, 400);
  assert.equal((await approve.json()).error.code, "CONFIRMATION_REQUIRED");

  const deletion = await sendJson(
    `${origin}/api/v1/reports/${reportId}`,
    "DELETE",
    { confirm: true, remoteDelete: true },
  );
  assert.equal(deletion.status, 400);
  assert.equal((await deletion.json()).error.code, "CONFIRMATION_REQUIRED");
});

test("report edits require a connected Atlassian actor", async (t) => {
  const origin = await startTestServer(t, { connected: false });
  const response = await sendJson(`${origin}/api/v1/reports/${reportId}`, "PATCH", {
    version: 1,
    items: [],
    confirmedEmptyCategories: [],
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "NOT_CONNECTED");
});
