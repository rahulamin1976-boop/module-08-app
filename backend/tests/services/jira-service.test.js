import assert from "node:assert/strict";
import test from "node:test";
import {
  localDateBoundary,
  searchIssueCandidates,
  searchProjects,
} from "../../src/services/jira-service.js";

const projectId = "50e26a1e-c471-4e54-a938-26269bd764b3";

test("local date boundaries account for timezone offsets and daylight saving", () => {
  assert.equal(
    localDateBoundary("2024-03-10", "America/New_York"),
    "2024-03-10T05:00:00.000Z",
  );
  assert.equal(
    localDateBoundary("2024-03-11", "America/New_York"),
    "2024-03-11T04:00:00.000Z",
  );
});

test("invalid periods and IANA timezones are rejected", async () => {
  await assert.rejects(
    searchIssueCandidates({
      pool: { query: async () => ({ rowCount: 0, rows: [] }) },
      jiraClient: {},
      projectId,
      from: "2024-02-30",
      to: "2024-03-01",
      timezone: "UTC",
    }),
    { status: 400, code: "INVALID_PERIOD" },
  );
  await assert.rejects(
    searchIssueCandidates({
      pool: { query: async () => ({ rowCount: 0, rows: [] }) },
      jiraClient: {},
      projectId,
      from: "2024-03-01",
      to: "2024-03-01",
      timezone: "Not/AZone",
    }),
    { status: 400, code: "INVALID_TIMEZONE" },
  );
});

test("project search persists and returns deduplicated projects with a cursor", async () => {
  const queries = [];
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      return {
        rows: [{
          id: projectId,
          jira_project_id: values[0],
          jira_project_key: values[1],
          name: values[2],
        }],
      };
    },
  };
  const jiraClient = {
    async searchProjects(args) {
      assert.deepEqual(args, { query: "DEMO", startAt: 0, maxResults: 1 });
      return {
        values: [
          { id: "101", key: "DEMO", name: "Demo" },
          { id: "101", key: "DEMO", name: "Duplicate" },
        ],
        isLast: false,
      };
    },
  };

  const result = await searchProjects({
    pool,
    jiraClient,
    query: "DEMO",
    limit: 1,
  });

  assert.equal(queries.length, 1);
  assert.deepEqual(result.items, [{
    id: projectId,
    jiraProjectId: "101",
    key: "DEMO",
    name: "Demo",
  }]);
  assert.equal(Buffer.from(result.nextCursor, "base64url").toString(), "2");
});

test("candidate search uses inclusive dates, an exclusive UTC end, and issue-ID deduplication", async () => {
  const jiraProject = {
    jira_project_id: "101",
    jira_project_key: "DEMO",
  };
  const pool = {
    async query() {
      return { rowCount: 1, rows: [jiraProject] };
    },
  };
  let search;
  const jiraClient = {
    async searchIssues(args) {
      search = args;
      return {
        issues: [
          {
            id: "10",
            key: "DEMO-1",
            self: "https://api.atlassian.com/issue/10",
            fields: {
              summary: "Completed work",
              status: { name: "Done" },
              assignee: { displayName: "Alex" },
              updated: "2024-03-10T10:00:00.000Z",
            },
          },
          {
            id: "10",
            key: "DEMO-1",
            fields: { summary: "Duplicate" },
          },
        ],
        nextPageToken: "page-2",
      };
    },
  };

  const result = await searchIssueCandidates({
    pool,
    jiraClient,
    projectId,
    from: "2024-03-10",
    to: "2024-03-10",
    timezone: "America/New_York",
    limit: 100,
  });

  assert.match(search.jql, /updated >= "2024-03-10 05:00:00"/);
  assert.match(search.jql, /updated < "2024-03-11 04:00:00"/);
  assert.deepEqual(search.fields, ["summary", "status", "assignee", "updated"]);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    issueId: "10",
    issueKey: "DEMO-1",
    summary: "Completed work",
    status: "Done",
    assignee: "Alex",
    updatedAt: "2024-03-10T10:00:00.000Z",
    url: "https://api.atlassian.com/issue/10",
  });
  assert.equal(
    JSON.parse(Buffer.from(result.nextCursor, "base64url").toString()),
    "page-2",
  );
});

test("unknown project and malformed cursors fail explicitly", async () => {
  await assert.rejects(
    searchIssueCandidates({
      pool: { query: async () => ({ rowCount: 0, rows: [] }) },
      jiraClient: {},
      projectId,
      from: "2024-03-01",
      to: "2024-03-01",
      timezone: "UTC",
    }),
    { status: 404, code: "PROJECT_NOT_FOUND" },
  );
  await assert.rejects(
    searchProjects({
      pool: { query: async () => ({ rows: [] }) },
      jiraClient: {},
      cursor: "invalid",
    }),
    { status: 400, code: "INVALID_CURSOR" },
  );
});
