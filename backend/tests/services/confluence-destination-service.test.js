import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportTitle,
  searchParentPages,
  searchSpaces,
  validateReportTitle,
} from "../../src/services/confluence-destination-service.js";

test("space and parent-page searches preserve pagination and deduplicate provider results", async () => {
  const calls = [];
  const confluenceClient = {
    async searchSpaces(options) {
      calls.push({ operation: "spaces", options });
      return {
        results: [
          { id: 1, key: "OPS", name: "Operations" },
          { id: "1", key: "OPS", name: "Duplicate" },
          { id: 2, key: "ENG", name: "Engineering" },
        ],
        _links: { next: "/wiki/api/v2/spaces?cursor=next-token" },
      };
    },
    async searchPages(options) {
      calls.push({ operation: "pages", options });
      return {
        results: [
          { id: 11, title: "Operations home", parentId: 2 },
          { id: "11", title: "Duplicate", parentId: 2 },
          { id: 12, title: "Sprint reports", parentId: "2" },
        ],
        _links: { next: "/wiki/api/v2/pages?cursor=page-token" },
      };
    },
  };

  const spaces = await searchSpaces({
    confluenceClient,
    query: " OPS ",
    cursor: "space-cursor",
    limit: 10,
  });
  assert.deepEqual(spaces, {
    items: [{ id: "1", key: "OPS", name: "Operations" }, { id: "2", key: "ENG", name: "Engineering" }],
    nextCursor: "next-token",
  });
  assert.deepEqual(calls[0].options, {
    query: "OPS",
    cursor: "space-cursor",
    limit: 10,
  });

  const pages = await searchParentPages({
    confluenceClient,
    spaceId: "10",
    parentId: "2",
    query: "Weekly",
    cursor: "page-cursor",
    limit: 5,
  });
  assert.deepEqual(pages, {
    items: [
      { id: "11", title: "Operations home", parentId: "2" },
      { id: "12", title: "Sprint reports", parentId: "2" },
    ],
    nextCursor: "page-token",
  });
  assert.deepEqual(calls[1].options, {
    spaceId: "10",
    parentId: "2",
    title: "Weekly",
    cursor: "page-cursor",
    limit: 5,
  });
});

test("destination search and title validation reject malformed input explicitly", async () => {
  const confluenceClient = {
    async searchSpaces() { return { results: [] }; },
    async searchPages() { return { results: [] }; },
  };
  await assert.rejects(
    searchSpaces({ confluenceClient, query: " ".repeat(2) }),
    { status: 400, code: "INVALID_QUERY" },
  );
  await assert.rejects(
    searchParentPages({ confluenceClient, spaceId: "../other-space" }),
    { status: 400, code: "INVALID_SPACE_ID" },
  );
  await assert.rejects(
    searchParentPages({ confluenceClient, spaceId: "10", parentId: "../untrusted" }),
    { status: 400, code: "INVALID_PARENT_ID" },
  );

  const titleArgs = {
    projectKey: "OPS",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
  };
  const title = buildReportTitle(titleArgs);
  assert.equal(title, "OPS Weekly Status 2026-10-12 to 2026-10-16");
  assert.equal(
    buildReportTitle({ ...titleArgs, suffix: "Second team" }),
    `${title} (Second team)`,
  );
  assert.equal(validateReportTitle(`${title} (Second team)`, {
    project: { key: "OPS" },
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
  }), `${title} (Second team)`);
  assert.throws(
    () => validateReportTitle("Weekly Status", {
      project: { key: "OPS" },
      periodStart: "2026-10-12",
      periodEnd: "2026-10-16",
    }),
    { status: 400, code: "INVALID_REPORT_TITLE" },
  );
  assert.throws(
    () => buildReportTitle({ ...titleArgs, suffix: "x".repeat(256) }),
    { status: 400, code: "INVALID_REPORT_TITLE" },
  );
});
