import assert from "node:assert/strict";
import test from "node:test";
import { getAccessibleResources } from "../../src/integrations/atlassian-oauth.js";

function fetchReturning(body) {
  return async () => new Response(JSON.stringify(body), { status: 200 });
}

const site = {
  id: "cloud-1",
  url: "https://example.atlassian.net",
  name: "example",
};

test("duplicate entries for the same cloud ID count as one site", async () => {
  const result = await getAccessibleResources(
    "token",
    fetchReturning([
      { ...site, scopes: ["read:jira-work"] },
      { ...site, scopes: ["read:page:confluence"] },
    ]),
  );
  assert.deepEqual(result, {
    cloudId: "cloud-1",
    url: "https://example.atlassian.net",
    name: "example",
  });
});

test("distinct sites still require site selection", async () => {
  await assert.rejects(
    getAccessibleResources(
      "token",
      fetchReturning([site, { ...site, id: "cloud-2", url: "https://other.atlassian.net" }]),
    ),
    { code: "SITE_SELECTION_REQUIRED" },
  );
});

test("no accessible sites requires site selection", async () => {
  await assert.rejects(getAccessibleResources("token", fetchReturning([])), {
    code: "SITE_SELECTION_REQUIRED",
  });
});

test("malformed site entries are rejected", async () => {
  await assert.rejects(
    getAccessibleResources("token", fetchReturning([site, { id: "cloud-1" }])),
    { message: "Atlassian returned an invalid site response." },
  );
});
