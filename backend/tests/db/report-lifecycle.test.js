import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPool } from "../../src/db/pool.js";
import { runMigrations } from "../../src/db/migrate.js";
import {
  approveReport,
  createReport,
  deleteReport,
  getReport,
  updateReport,
  withdrawApproval,
} from "../../src/services/report-service.js";

test("report edits preserve provenance, reject stale versions, and lifecycle transitions audit actors", async (t) => {
  const pool = createPool();
  const projectId = randomUUID();
  const reportIds = [];
  t.after(async () => {
    try {
      if (reportIds.length > 0) {
        await pool.query("DELETE FROM status_reports WHERE id = ANY($1::uuid[])", [
          reportIds,
        ]);
      }
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    } finally {
      await pool.end();
    }
  });

  await runMigrations(pool);
  await pool.query(
    `INSERT INTO projects (id, jira_project_id, jira_project_key, name)
     VALUES ($1, 'lifecycle-test', 'LIFE', 'Lifecycle test')`,
    [projectId],
  );

  const report = await createReport({
    pool,
    projectId,
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    jiraUpdates: [{ issueId: "9", issueKey: "LIFE-9", category: "accomplishment" }],
    manualUpdates: [],
    confirmedEmptyCategories: ["blocker", "next_week"],
    creatorAccountId: "creator-account",
    jiraClient: {
      siteUrl: "https://example.atlassian.net",
      async getIssue(issueId) {
        return {
          id: issueId,
          key: "LIFE-9",
          self: "https://api.atlassian.com/ex/jira/site/rest/api/3/issue/9",
          fields: {
            project: { id: "lifecycle-test" },
            summary: "Completed a verified delivery",
            status: { name: "Done" },
            assignee: { displayName: "Jordan" },
            updated: "2026-10-14T11:00:00.000Z",
          },
        };
      },
    },
  });
  reportIds.push(report.id);
  const originalItem = report.items[0];

  const edited = await updateReport(pool, {
    reportId: report.id,
    version: 1,
    actorAccountId: "editor-account",
    items: [{
      id: originalItem.id,
      category: "blocker",
      text: "Risk: delivery depends on external review",
      owner: "Jordan",
    }],
    confirmedEmptyCategories: ["accomplishment", "next_week"],
  });
  assert.equal(edited.version, 2);
  assert.equal(edited.lastEditedByAccountId, "editor-account");
  assert.equal(edited.items[0].sourceType, "user_edited");
  assert.equal(edited.items[0].sourceReference, "LIFE-9");
  assert.equal(edited.items[0].sourceSnapshot.summary, "Completed a verified delivery");
  assert.deepEqual(edited.confirmedEmptyCategories, ["accomplishment", "next_week"]);

  await assert.rejects(
    updateReport(pool, {
      reportId: report.id,
      version: 1,
      actorAccountId: "stale-editor",
      items: [{
        id: originalItem.id,
        category: "accomplishment",
        text: "Stale edit must not replace the latest content",
      }],
      confirmedEmptyCategories: ["blocker", "next_week"],
    }),
    (error) => error.status === 409 &&
      error.code === "STALE_VERSION" &&
      error.details.latestVersion === 2,
  );
  assert.equal((await getReport(pool, report.id)).items[0].text, "Risk: delivery depends on external review");

  const approved = await approveReport(pool, {
    reportId: report.id,
    actorAccountId: "approver-account",
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.version, 3);
  assert.equal(approved.approvedByAccountId, "approver-account");
  assert.ok(approved.approvedAt);

  const withdrawn = await withdrawApproval(pool, {
    reportId: report.id,
    actorAccountId: "withdrawal-account",
  });
  assert.equal(withdrawn.status, "draft");
  assert.equal(withdrawn.version, 4);
  assert.equal(withdrawn.approvedByAccountId, null);
  assert.equal(withdrawn.approvedAt, null);

  const deletion = await deleteReport(pool, {
    reportId: report.id,
    actorAccountId: "deleter-account",
    confirm: true,
  });
  assert.deepEqual(deletion, { deleted: true, confluencePageRemains: false });
  await assert.rejects(getReport(pool, report.id), {
    status: 404,
    code: "REPORT_NOT_FOUND",
  });
});

test("approval refuses incomplete and overlong reports without changing status", async (t) => {
  const pool = createPool();
  const projectId = randomUUID();
  const reportIds = [];
  t.after(async () => {
    try {
      if (reportIds.length > 0) {
        await pool.query("DELETE FROM status_reports WHERE id = ANY($1::uuid[])", [
          reportIds,
        ]);
      }
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    } finally {
      await pool.end();
    }
  });

  await runMigrations(pool);
  await pool.query(
    `INSERT INTO projects (id, jira_project_id, jira_project_key, name)
     VALUES ($1, 'incomplete-test', 'INC', 'Incomplete test')`,
    [projectId],
  );
  const report = await createReport({
    pool,
    projectId,
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    jiraUpdates: [],
    manualUpdates: [{ category: "accomplishment", text: "One update" }],
    confirmedEmptyCategories: [],
    creatorAccountId: "creator-account",
    jiraClient: { async searchIssues() { return { issues: [] }; } },
  });
  reportIds.push(report.id);

  await assert.rejects(
    approveReport(pool, { reportId: report.id, actorAccountId: "approver-account" }),
    (error) => error.status === 409 &&
      error.code === "REPORT_INCOMPLETE" &&
      error.details.validation.ready === false,
  );
  assert.equal((await getReport(pool, report.id)).status, "draft");
});
