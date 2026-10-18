import assert from "node:assert/strict";
import test from "node:test";
import { requestAtlassianJson } from "../../src/integrations/atlassian-http.js";
import { createConfluenceClient } from "../../src/integrations/confluence-client.js";
import { createJiraClient } from "../../src/integrations/jira-client.js";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

test("Atlassian requests attach bearer authorization and JSON bodies", async () => {
  let request;
  const result = await requestAtlassianJson("https://api.atlassian.com/test", {
    accessToken: "secret",
    method: "POST",
    body: { query: "project = DEMO" },
    fetchImpl: async (_url, options) => {
      request = options;
      return jsonResponse({ ok: true });
    },
  });

  assert.equal(request.headers.Authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.body), { query: "project = DEMO" });
  assert.deepEqual(result, { ok: true });
});

test("transient failures retry at most twice and then return a safe error", async () => {
  let calls = 0;
  const waits = [];

  await assert.rejects(
    requestAtlassianJson("https://api.atlassian.com/test", {
      accessToken: "secret",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 503);
      },
      sleepImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    { code: "UPSTREAM_UNAVAILABLE", status: 503 },
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [250, 500]);
});

test("rate-limit retries honor Retry-After and stop after two retries", async () => {
  let calls = 0;
  const waits = [];

  await assert.rejects(
    requestAtlassianJson("https://api.atlassian.com/test", {
      accessToken: "secret",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 429, { "Retry-After": "2" });
      },
      sleepImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    { code: "UPSTREAM_RATE_LIMITED", status: 429, retryAfter: 2 },
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);
});

test("upstream retry waits stay within the 15-second deadline", async () => {
  let calls = 0;
  await assert.rejects(
    requestAtlassianJson("https://api.atlassian.com/test", {
      accessToken: "secret",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 429, { "Retry-After": "20" });
      },
      sleepImpl: async () => assert.fail("must not sleep past the deadline"),
    }),
    { code: "UPSTREAM_TIMEOUT", status: 503 },
  );
  assert.equal(calls, 1);
});

test("authorization and validation errors are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    requestAtlassianJson("https://api.atlassian.com/test", {
      accessToken: "secret",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 403);
      },
    }),
    { code: "UPSTREAM_AUTHORIZATION_FAILED", status: 403 },
  );
  assert.equal(calls, 1);
});

test("provider adapters build bounded Jira and Confluence requests", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return jsonResponse({ values: [] });
  };
  const jira = createJiraClient({
    cloudId: "cloud/site",
    siteUrl: "https://example.atlassian.net",
    accessToken: "secret",
    fetchImpl,
  });
  const confluence = createConfluenceClient({
    cloudId: "cloud/site",
    accessToken: "secret",
    fetchImpl,
  });

  await jira.searchProjects({ query: "DEMO", maxResults: 25 });
  await jira.searchIssues({
    jql: 'project = "DEMO"',
    fields: ["summary", "updated"],
    nextPageToken: "next",
  });
  await confluence.searchSpaces({ query: "ENG", limit: 20 });
  await confluence.searchPages({ spaceId: "42", parentId: "7" });

  assert.match(urls[0], /ex\/jira\/cloud%2Fsite\/rest\/api\/3\/project\/search/);
  assert.match(urls[1], /ex\/jira\/cloud%2Fsite\/rest\/api\/3\/search\/jql/);
  assert.match(urls[2], /ex\/confluence\/cloud%2Fsite\/wiki\/api\/v2\/spaces/);
  assert.match(urls[3], /parent-id=7/);
});
