import assert from "node:assert/strict";
import test from "node:test";
import {
  createReport,
  getReport,
  listReports,
} from "../../src/services/report-service.js";

const projectId = "50e26a1e-c471-4e54-a938-26269bd764b3";
const reportId = "d06014bc-a2bf-4152-99a4-a1d5968144ac";
const project = {
  id: projectId,
  jira_project_id: "101",
  jira_project_key: "OPS",
  name: "Operations",
};

function reportPool({
  sourceSnapshot = { jiraStatus: "available" },
  warnings = [],
  confirmed = [],
  items = [],
} = {}) {
  const statements = [];
  let insertedReport;
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes("INSERT INTO status_reports")) {
        insertedReport = {
          id: values[0],
          source_snapshot: values[6],
          confirmed_empty_categories: values[7],
          warnings: JSON.parse(values[8]),
          period_start: values[3],
          period_end: values[4],
          timezone: values[5],
          created_by_account_id: values[2],
        };
      } else if (sql.includes("INSERT INTO report_items")) {
        items.push({
          id: `item-${items.length + 1}`,
          report_id: values[0],
          category: values[1],
          text: values[2],
          source_type: values[3],
          source_reference: values[4],
          source_snapshot: values[5],
          owner: values[6],
          source_updated_at: values[7],
          position: values[8],
        });
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      if (sql.includes("FROM projects")) {
        return { rowCount: 1, rows: [project] };
      }
      if (sql.includes("FROM status_reports r")) {
        return {
          rowCount: 1,
          rows: [{
            ...insertedReport,
            id: insertedReport?.id ?? reportId,
            source_snapshot: insertedReport?.source_snapshot ?? sourceSnapshot,
            confirmed_empty_categories:
              insertedReport?.confirmed_empty_categories ?? confirmed,
            warnings: insertedReport?.warnings ?? warnings,
            version: 1,
            status: "draft",
            approved_by_account_id: null,
            last_edited_by_account_id: null,
            approved_at: null,
            published_at: null,
            confluence_space_id: null,
            confluence_parent_page_id: null,
            confluence_page_id: null,
            confluence_page_url: null,
            updated_at: "2026-10-18T12:00:00.000Z",
            project_id: projectId,
            jira_project_id: project.jira_project_id,
            jira_project_key: project.jira_project_key,
            project_name: project.name,
          }],
        };
      }
      if (sql.includes("FROM report_items")) {
        return { rowCount: items.length, rows: items };
      }
      return { rowCount: 0, rows: [] };
    },
    async connect() {
      return client;
    },
  };
  return { pool, statements, items, getInsertedReport: () => insertedReport };
}

function baseArgs(overrides = {}) {
  return {
    pool: reportPool().pool,
    projectId,
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    jiraUpdates: [],
    manualUpdates: [],
    confirmedEmptyCategories: [],
    creatorAccountId: "atlassian-account",
    jiraClient: {
      async searchIssues() {
        return { issues: [] };
      },
    },
    now: () => new Date("2026-10-18T12:00:00.000Z"),
    ...overrides,
  };
}

test("manual-only fallback persists a Jira-unavailable warning and report audit", async () => {
  const storage = reportPool();
  const args = baseArgs({
    pool: storage.pool,
    manualUpdates: [{
      category: "accomplishment",
      text: "  Delivered the migration\n  ",
      owner: "  Operations  ",
    }],
    jiraClient: {
      async searchIssues() {
        const error = new Error("private provider response");
        error.status = 503;
        error.code = "UPSTREAM_UNAVAILABLE";
        throw error;
      },
    },
  });

  const report = await createReport(args);

  assert.equal(report.status, "draft");
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].text, "Delivered the migration");
  assert.equal(report.items[0].owner, "Operations");
  assert.equal(report.items[0].sourceType, "manual");
  assert.equal(report.sourceSnapshot.jiraStatus, "unavailable");
  assert.equal(report.warnings[0].code, "JIRA_UNAVAILABLE");
  assert.match(report.markdown, /Jira data unavailable; manually confirm this section/);
  assert.ok(storage.statements.some(({ sql }) => sql.includes("report_audit_events")));
});

test("selected Jira issues are refetched, period-checked, and snapshotted with a browser URL", async () => {
  const storage = reportPool();
  const report = await createReport(baseArgs({
    pool: storage.pool,
    jiraClient: {
      siteUrl: "https://example.atlassian.net",
      async getIssue(issueId) {
        return {
          id: issueId,
          key: "OPS-9",
          self: "https://api.atlassian.com/issue/9",
          fields: {
            project: { id: "101" },
            summary: "Resolved service issue",
            status: { name: "Done" },
            assignee: { displayName: "Jordan" },
            updated: "2026-10-14T11:00:00.000Z",
          },
        };
      },
    },
    jiraUpdates: [{
      issueId: "9",
      issueKey: "OPS-9",
      category: "accomplishment",
    }],
    confirmedEmptyCategories: ["blocker", "next_week"],
  }));

  assert.equal(report.items[0].sourceType, "jira");
  assert.equal(report.items[0].sourceReference, "OPS-9");
  assert.equal(report.items[0].owner, "Jordan");
  assert.equal(report.items[0].sourceSnapshot.issueId, "9");
  assert.equal(
    report.items[0].sourceSnapshot.url,
    "https://example.atlassian.net/browse/OPS-9",
  );
  assert.equal(report.sections.Blockers[0], "- No items reported.");
  assert.equal(report.sections["Next week"][0], "- No items reported.");
});

test("Jira failure without manual updates creates no report", async () => {
  const storage = reportPool();
  await assert.rejects(
    createReport(baseArgs({
      pool: storage.pool,
      jiraClient: {
        async searchIssues() {
          const error = new Error("unavailable");
          error.status = 503;
          error.code = "UPSTREAM_UNAVAILABLE";
          throw error;
        },
      },
    })),
    { status: 503, code: "UPSTREAM_UNAVAILABLE" },
  );
  assert.equal(
    storage.statements.some(({ sql }) => sql.includes("INSERT INTO status_reports")),
    false,
  );
});

test("manual input and empty-confirmation constraints are enforced", async () => {
  await assert.rejects(
    createReport(baseArgs({
      manualUpdates: [{ category: "blocker", text: "  " }],
    })),
    { status: 400, code: "INVALID_MANUAL_UPDATE" },
  );
  await assert.rejects(
    createReport(baseArgs({
      manualUpdates: [{ category: "blocker", text: "A blocker" }],
      confirmedEmptyCategories: ["blocker"],
    })),
    { status: 400, code: "EMPTY_CATEGORY_HAS_ITEMS" },
  );
});

test("report reads preserve item ordering, section shape, and validation state", async () => {
  const storage = reportPool({
    sourceSnapshot: {
      jiraStatus: "available",
      retrievedAt: "2026-10-18T12:00:00.000Z",
    },
    confirmed: ["blocker", "next_week"],
    items: [{
      id: "item-1",
      report_id: reportId,
      category: "accomplishment",
      text: "Completed milestone",
      source_type: "manual",
      source_reference: null,
      source_snapshot: null,
      owner: null,
      source_updated_at: null,
      position: 0,
    }],
  });
  const report = await getReport(storage.pool, reportId);

  assert.equal(report.sections.Accomplishments[0], "- Completed milestone");
  assert.equal(report.sections.Blockers[0], "- No items reported.");
  assert.equal(report.validation.ready, true);
  assert.equal(report.lineCount, 8);
});

test("report listing rejects invalid status and returns a bounded opaque cursor", async () => {
  await assert.rejects(
    listReports(reportPool().pool, { status: "unknown" }),
    { status: 400, code: "INVALID_STATUS" },
  );
});
