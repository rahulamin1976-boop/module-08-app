import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createConfluenceRouter } from "../../src/routes/confluence-routes.js";

async function startTestServer(t) {
  const calls = [];
  const apiRouter = Router();
  apiRouter.use("/confluence", createConfluenceRouter({
    async getConfluenceClient() {
      return {
        async searchSpaces(options) {
          calls.push({ type: "spaces", options });
          return { results: [{ id: "space-1", key: "OPS", name: "Operations" }] };
        },
        async searchPages(options) {
          calls.push({ type: "pages", options });
          return { results: [{ id: "page-1", title: "Operations home", parentId: null }] };
        },
      };
    },
  }));
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return { origin: `http://127.0.0.1:${server.address().port}`, calls };
}

test("Confluence destination routes use the standard bounded pagination envelope", async (t) => {
  const { origin, calls } = await startTestServer(t);
  const spacesResponse = await fetch(`${origin}/api/v1/confluence/spaces?query=OPS&limit=10`);
  assert.equal(spacesResponse.status, 200);
  assert.deepEqual(await spacesResponse.json(), {
    items: [{ id: "space-1", key: "OPS", name: "Operations" }],
    nextCursor: null,
  });
  assert.deepEqual(calls[0].options, {
    query: "OPS",
    cursor: undefined,
    limit: 10,
  });

  const pagesResponse = await fetch(
    `${origin}/api/v1/confluence/spaces/space-1/pages?parentId=parent-1&query=Weekly`,
  );
  assert.equal(pagesResponse.status, 200);
  assert.deepEqual(await pagesResponse.json(), {
    items: [{ id: "page-1", title: "Operations home", parentId: null }],
    nextCursor: null,
  });
  assert.equal(calls[1].options.parentId, "parent-1");
  assert.equal(calls[1].options.title, "Weekly");
});

test("Confluence destination routes reject duplicate, unknown, and invalid search fields", async (t) => {
  const { origin, calls } = await startTestServer(t);
  const unknown = await fetch(`${origin}/api/v1/confluence/spaces?unexpected=true`);
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error.code, "UNKNOWN_FIELD");

  const duplicate = await fetch(`${origin}/api/v1/confluence/spaces?query=a&query=b`);
  assert.equal(duplicate.status, 400);
  assert.equal((await duplicate.json()).error.code, "INVALID_QUERY");

  const invalidSpace = await fetch(`${origin}/api/v1/confluence/spaces/%2F/pages`);
  assert.equal(invalidSpace.status, 400);
  assert.equal((await invalidSpace.json()).error.code, "INVALID_SPACE_ID");
  assert.equal(calls.length, 0);
});
