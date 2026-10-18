import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createJiraRouter } from "../../src/routes/jira-routes.js";

async function startTestServer(t, router) {
  const apiRouter = Router();
  apiRouter.use("/jira", router);
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("Jira project endpoint validates search fields and returns pagination envelope", async (t) => {
  const router = createJiraRouter({
    pool: {
      async query(_sql, values) {
        return {
          rows: [{
            id: "b93f67e0-bcc6-4cda-b874-ed55357391ca",
            jira_project_id: values[0],
            jira_project_key: values[1],
            name: values[2],
          }],
        };
      },
    },
    getJiraClient: async () => ({
      async searchProjects() {
        return {
          values: [{ id: "11", key: "OPS", name: "Operations" }],
          isLast: true,
        };
      },
    }),
  });
  const origin = await startTestServer(t, router);

  const response = await fetch(`${origin}/api/v1/jira/projects?query=OPS&limit=20`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{
      id: "b93f67e0-bcc6-4cda-b874-ed55357391ca",
      jiraProjectId: "11",
      key: "OPS",
      name: "Operations",
    }],
    nextCursor: null,
  });

  const invalid = await fetch(`${origin}/api/v1/jira/projects?unexpected=true`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "UNKNOWN_FIELD");
});

test("Jira candidate endpoint requires valid project and period parameters", async (t) => {
  const router = createJiraRouter({
    pool: {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    },
    getJiraClient: async () => {
      throw new Error("connection must not be requested for invalid route input");
    },
  });
  const origin = await startTestServer(t, router);

  const invalidId = await fetch(
    `${origin}/api/v1/jira/projects/not-a-uuid/updates?from=2026-10-01&to=2026-10-02&timezone=UTC`,
  );
  assert.equal(invalidId.status, 400);
  assert.equal((await invalidId.json()).error.code, "INVALID_PROJECT_ID");

  const invalidPeriod = await fetch(
    `${origin}/api/v1/jira/projects/50e26a1e-c471-4e54-a938-26269bd764b3/updates?from=2026-10-02&to=2026-10-01&timezone=UTC`,
  );
  assert.equal(invalidPeriod.status, 400);
  assert.equal((await invalidPeriod.json()).error.code, "INVALID_PERIOD");
});
