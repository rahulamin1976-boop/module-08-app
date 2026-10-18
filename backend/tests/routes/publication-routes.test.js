import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createPublicationRouter } from "../../src/routes/publication-routes.js";

const reportId = "d06014bc-a2bf-4152-99a4-a1d5968144ac";

async function startTestServer(t, { connected = true } = {}) {
  const apiRouter = Router();
  apiRouter.use("/reports", createPublicationRouter({
    pool: {},
    connectionService: {
      async getState() {
        return connected
          ? { connected: true, account: { id: "account-id" } }
          : { connected: false };
      },
    },
    async getConfluenceClient() {
      throw new Error("Invalid or disconnected requests must not create a provider client.");
    },
  }));
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function post(origin, report, body) {
  return fetch(`${origin}/api/v1/reports/${report}/publish`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("publication route rejects unknown fields, invalid identifiers, and malformed titles", async (t) => {
  const origin = await startTestServer(t);
  const unknown = await post(origin, reportId, {
    spaceId: "space-1",
    parentPageId: "parent-1",
    reportId: "forged",
  });
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error.code, "INVALID_PUBLICATION_REQUEST");

  const invalidId = await post(origin, "not-a-uuid", {
    spaceId: "space-1",
    parentPageId: "parent-1",
  });
  assert.equal(invalidId.status, 400);
  assert.equal((await invalidId.json()).error.code, "INVALID_REPORT_ID");

  const invalidSuffix = await post(origin, reportId, {
    spaceId: "space-1",
    parentPageId: "parent-1",
    titleSuffix: " ".repeat(2),
  });
  assert.equal(invalidSuffix.status, 400);
  assert.equal((await invalidSuffix.json()).error.code, "INVALID_PUBLICATION_REQUEST");
});

test("publication route requires a connected Atlassian actor", async (t) => {
  const origin = await startTestServer(t, { connected: false });
  const response = await post(origin, reportId, {
    spaceId: "space-1",
    parentPageId: "parent-1",
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "NOT_CONNECTED");
});
