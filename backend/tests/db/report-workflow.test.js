import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPool } from "../../src/db/pool.js";
import { runMigrations } from "../../src/db/migrate.js";
import { createReport, getReport, listReports } from "../../src/services/report-service.js";

test("report service persists a complete draft and a recoverable manual-only draft", async (t) => {
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
     VALUES ($1, 'report-service-test', 'RPT', 'Report service test')`,
    [projectId],
  );

  const complete = await createReport({
    pool,
    projectId,
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    jiraUpdates: [],
    manualUpdates: [{
      category: "accomplishment",
      text: "Completed a database-backed report",
      owner: "Prototype team",
    }],
    confirmedEmptyCategories: ["blocker", "next_week"],
    creatorAccountId: "db-test-account",
    jiraClient: {
      async searchIssues() {
        return { issues: [] };
      },
    },
  });
  reportIds.push(complete.id);
  assert.equal(complete.status, "draft");
  assert.equal(complete.items.length, 1);
  assert.equal(complete.sections.Blockers[0], "- No items reported.");
  assert.equal(complete.validation.ready, true);
  const reread = await getReport(pool, complete.id);
  assert.equal(reread.items[0].text, "Completed a database-backed report");

  const manualOnly = await createReport({
    pool,
    projectId,
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    timezone: "UTC",
    jiraUpdates: [],
    manualUpdates: [{
      category: "next_week",
      text: "Follow up with the project team",
    }],
    confirmedEmptyCategories: [],
    creatorAccountId: "db-test-account",
    jiraClient: {
      async searchIssues() {
        const error = new Error("transient upstream failure");
        error.status = 503;
        error.code = "UPSTREAM_UNAVAILABLE";
        throw error;
      },
    },
  });
  reportIds.push(manualOnly.id);
  assert.equal(manualOnly.sourceSnapshot.jiraStatus, "unavailable");
  assert.equal(manualOnly.warnings[0].code, "JIRA_UNAVAILABLE");
  assert.equal(manualOnly.sections.Accomplishments[0].includes("Jira data unavailable"), true);

  const list = await listReports(pool, { projectId, limit: 100 });
  assert.equal(list.items.length, 2);
  assert.ok(list.items.every(({ status }) => status === "draft"));
});
