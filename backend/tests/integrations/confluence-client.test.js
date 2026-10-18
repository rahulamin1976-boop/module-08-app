import assert from "node:assert/strict";
import test from "node:test";
import { createConfluenceClient } from "../../src/integrations/confluence-client.js";

test("Confluence client builds destination, child-page, and content-property requests", async () => {
  const requests = [];
  const client = createConfluenceClient({
    cloudId: "cloud-1",
    accessToken: "access-token",
    siteUrl: "https://example.atlassian.net",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ results: [], id: "page-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await client.searchSpaces({ query: "OPS", cursor: "space-cursor", limit: 20 });
  await client.searchPages({
    spaceId: "space 1",
    parentId: "parent-1",
    title: "Weekly",
    cursor: "page-cursor",
    limit: 30,
  });
  await client.createPage({
    spaceId: "space-1",
    parentId: "parent-1",
    title: "OPS Weekly Status 2026-10-12 to 2026-10-16",
    storageValue: "<h2>Accomplishments</h2>",
  });
  await client.getPageProperties("page-1", { key: "weekly-status-report-id" });
  await client.createPageProperty("page-1", {
    key: "weekly-status-report-id",
    value: { reportId: "report-1" },
  });

  const spaceUrl = new URL(requests[0].url);
  assert.equal(spaceUrl.pathname.endsWith("/spaces"), true);
  assert.equal(spaceUrl.searchParams.get("keys"), "OPS");
  assert.equal(spaceUrl.searchParams.get("cursor"), "space-cursor");

  const pageUrl = new URL(requests[1].url);
  assert.equal(pageUrl.searchParams.get("space-id"), "space 1");
  assert.equal(pageUrl.searchParams.get("parent-id"), "parent-1");
  assert.equal(pageUrl.searchParams.get("title"), "Weekly");

  assert.equal(requests[2].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    spaceId: "space-1",
    parentId: "parent-1",
    status: "current",
    title: "OPS Weekly Status 2026-10-12 to 2026-10-16",
    body: {
      representation: "storage",
      value: "<h2>Accomplishments</h2>",
    },
  });
  assert.match(requests[3].url, /\/pages\/page-1\/properties\?limit=100&key=weekly-status-report-id$/);
  assert.equal(requests[4].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[4].options.body), {
    key: "weekly-status-report-id",
    value: { reportId: "report-1" },
  });
  assert.equal(client.siteUrl, "https://example.atlassian.net");
});
