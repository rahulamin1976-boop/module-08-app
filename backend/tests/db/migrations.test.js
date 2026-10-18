import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPool } from "../../src/db/pool.js";
import { runMigrations } from "../../src/db/migrate.js";

test("database migrations are repeatable and enforce report constraints", async (t) => {
  const pool = createPool();
  let projectId;

  t.after(async () => {
    try {
      if (projectId) {
        await pool.query("DELETE FROM status_reports WHERE project_id = $1", [
          projectId,
        ]);
        await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
      }
    } finally {
      await pool.end();
    }
  });

  await runMigrations(pool);
  await runMigrations(pool);

  const applied = await pool.query(
    "SELECT name FROM schema_migrations ORDER BY name",
  );
  assert.deepEqual(
    applied.rows.map(({ name }) => name),
    [
      "001-initial-schema.sql",
      "002-connection-account-display.sql",
      "003-report-item-order.sql",
      "004-connection-site-url.sql",
      "005-confluence-page-title.sql",
    ],
  );

  const connectionColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'integration_connections'`,
  );
  assert.ok(
    connectionColumns.rows.some(({ column_name }) => column_name === "account_display_name"),
  );
  const reportColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'status_reports'`,
  );
  assert.ok(
    reportColumns.rows.some(({ column_name }) => column_name === "confluence_page_title"),
  );

  const project = await pool.query(
    `INSERT INTO projects (jira_project_id, jira_project_key, name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [randomUUID(), "TEST", "Migration test"],
  );
  projectId = project.rows[0].id;

  const report = await pool.query(
    `INSERT INTO status_reports (
       project_id, created_by_account_id, period_start, period_end, timezone
     ) VALUES ($1, 'test-account', DATE '2026-10-10', DATE '2026-10-11', 'UTC')
     RETURNING id, confluence_idempotency_key`,
    [projectId],
  );
  const reportId = report.rows[0].id;
  assert.equal(report.rows[0].confluence_idempotency_key, reportId);

  await pool.query(
    `INSERT INTO report_items (report_id, category, text, source_type)
     VALUES ($1, 'accomplishment', 'Completed a test milestone', 'manual')`,
    [reportId],
  );
  await pool.query(
    `INSERT INTO report_audit_events (report_id, actor_account_id, action)
     VALUES ($1, 'test-account', 'created')`,
    [reportId],
  );

  await pool.query("DELETE FROM status_reports WHERE id = $1", [reportId]);
  const cascadedRows = await pool.query(
    `SELECT
       (SELECT count(*) FROM report_items WHERE report_id = $1) AS item_count,
       (SELECT count(*) FROM report_audit_events WHERE report_id = $1) AS event_count,
       (SELECT count(*) FROM projects WHERE id = $2) AS project_count`,
    [reportId, projectId],
  );
  assert.deepEqual(cascadedRows.rows[0], {
    item_count: "0",
    event_count: "0",
    project_count: "1",
  });

  await assert.rejects(
    pool.query(
      `INSERT INTO status_reports (
         project_id, created_by_account_id, period_start, period_end, timezone, status
       ) VALUES ($1, 'test-account', DATE '2026-10-10', DATE '2026-10-11', 'UTC', 'unknown')`,
      [projectId],
    ),
  );
});
