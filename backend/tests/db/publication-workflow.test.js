import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPool } from "../../src/db/pool.js";
import { runMigrations } from "../../src/db/migrate.js";
import {
  approveReport,
  createReport,
  getReport,
} from "../../src/services/report-service.js";
import { publishReport } from "../../src/services/publication-service.js";

const projectKey = "PUB";
const spaceId = "space-1";
const parentPageId = "parent-1";

function confluenceFixture({ seededPages = [], createBehavior, propertyBehavior } = {}) {
  const pages = [...seededPages];
  const properties = new Map();
  const calls = { createPage: 0, createPageProperty: 0 };
  return {
    pages,
    properties,
    calls,
    client: {
      siteUrl: "https://example.atlassian.net",
      async getPage(id) {
        return pages.find((page) => page.id === id) ??
          (id === parentPageId ? { id, spaceId } : null);
      },
      async searchPages({ spaceId: requestedSpace, parentId, title }) {
        return {
          results: pages.filter((page) =>
            page.spaceId === requestedSpace &&
            page.parentId === parentId &&
            page.title === title,
          ),
        };
      },
      async getPageProperties(pageId) {
        return { results: properties.get(pageId) ?? [] };
      },
      async createPage(input) {
        calls.createPage += 1;
        const page = {
          id: `created-${calls.createPage}`,
          title: input.title,
          spaceId: input.spaceId,
          parentId: input.parentId,
          storageValue: input.storageValue,
          _links: { webui: `/wiki/pages/created-${calls.createPage}` },
        };
        pages.push(page);
        if (createBehavior) await createBehavior({ page, input, pages });
        return page;
      },
      async createPageProperty(pageId, property) {
        calls.createPageProperty += 1;
        const pageProperties = properties.get(pageId) ?? [];
        pageProperties.push(property);
        properties.set(pageId, pageProperties);
        if (propertyBehavior) await propertyBehavior({ pageId, property, pages });
        return property;
      },
    },
  };
}

async function setupProject(t, pool) {
  const projectId = randomUUID();
  const reportIds = [];
  t.after(async () => {
    try {
      if (reportIds.length) {
        await pool.query("DELETE FROM status_reports WHERE id = ANY($1::uuid[])", [reportIds]);
      }
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    } finally {
      await pool.end();
    }
  });
  await runMigrations(pool);
  await pool.query(
    `INSERT INTO projects (id, jira_project_id, jira_project_key, name)
     VALUES ($1, $2, $3, $4)`,
    [projectId, `publication-${projectId}`, projectKey, "Publication test"],
  );
  return {
    projectId,
    reportIds,
    async createApprovedReport() {
      const report = await createReport({
        pool,
        projectId,
        periodStart: "2026-10-12",
        periodEnd: "2026-10-16",
        timezone: "UTC",
        jiraUpdates: [],
        manualUpdates: [{
          category: "accomplishment",
          text: "Completed a publication test",
        }],
        confirmedEmptyCategories: ["blocker", "next_week"],
        creatorAccountId: "creator-account",
        jiraClient: { async searchIssues() { return { issues: [] }; } },
      });
      reportIds.push(report.id);
      return approveReport(pool, {
        reportId: report.id,
        actorAccountId: "approver-account",
      });
    },
  };
}

test("publication stores the stable report property, confirmed page reference, and audit events", async (t) => {
  const pool = createPool();
  const storage = await setupProject(t, pool);
  const approved = await storage.createApprovedReport();
  const fixture = confluenceFixture();

  const published = await publishReport({
    pool,
    reportId: approved.id,
    spaceId,
    parentPageId,
    actorAccountId: "publisher-account",
    confluenceClient: fixture.client,
  });
  assert.equal(published.status, "published");
  assert.equal(published.confluenceSpaceId, spaceId);
  assert.equal(published.confluenceParentPageId, parentPageId);
  assert.equal(published.confluencePageTitle, "PUB Weekly Status 2026-10-12 to 2026-10-16");
  assert.equal(published.confluencePageUrl, "https://example.atlassian.net/wiki/pages/created-1");
  assert.equal(fixture.calls.createPage, 1);
  assert.equal(fixture.properties.get("created-1")[0].value.reportId, approved.id);
  assert.match(fixture.pages[0].storageValue, /<h2>Accomplishments<\/h2>/);

  const retry = await publishReport({
    pool,
    reportId: approved.id,
    spaceId,
    parentPageId,
    actorAccountId: "publisher-account",
    confluenceClient: fixture.client,
  });
  assert.equal(retry.status, "published");
  assert.equal(fixture.calls.createPage, 1);

  const events = await pool.query(
    `SELECT action FROM report_audit_events
     WHERE report_id = $1 ORDER BY occurred_at, id`,
    [approved.id],
  );
  assert.deepEqual(events.rows.map(({ action }) => action), [
    "created",
    "approved",
    "publish_started",
    "published",
  ]);
});

test("unrelated title collisions return a conflict and can be disambiguated without overwriting", async (t) => {
  const pool = createPool();
  const storage = await setupProject(t, pool);
  const approved = await storage.createApprovedReport();
  const existingPage = {
    id: "unrelated-page",
    title: "PUB Weekly Status 2026-10-12 to 2026-10-16",
    spaceId,
    parentId: parentPageId,
  };
  const fixture = confluenceFixture({ seededPages: [existingPage] });

  await assert.rejects(
    publishReport({
      pool,
      reportId: approved.id,
      spaceId,
      parentPageId,
      actorAccountId: "publisher-account",
      confluenceClient: fixture.client,
    }),
    { status: 409, code: "CONFLUENCE_TITLE_CONFLICT" },
  );
  assert.equal(fixture.calls.createPage, 0);
  assert.equal((await getReport(pool, approved.id)).status, "approved");
  assert.equal(fixture.pages[0].id, "unrelated-page");

  const published = await publishReport({
    pool,
    reportId: approved.id,
    spaceId,
    parentPageId,
    titleSuffix: "Team B",
    actorAccountId: "publisher-account",
    confluenceClient: fixture.client,
  });
  assert.equal(published.status, "published");
  assert.equal(
    published.confluencePageTitle,
    "PUB Weekly Status 2026-10-12 to 2026-10-16 (Team B)",
  );
  assert.equal(fixture.calls.createPage, 1);
});

test("uncertain page creation is reconciled by UUID property or fails without creating a duplicate", async (t) => {
  const pool = createPool();
  const storage = await setupProject(t, pool);
  const approved = await storage.createApprovedReport();
  const fixture = confluenceFixture({
    propertyBehavior: async () => {
      const error = new Error("provider response was lost");
      error.status = 503;
      error.code = "UPSTREAM_TIMEOUT";
      error.exposeApiMessage = true;
      throw error;
    },
  });

  const published = await publishReport({
    pool,
    reportId: approved.id,
    spaceId,
    parentPageId,
    actorAccountId: "publisher-account",
    confluenceClient: fixture.client,
  });
  assert.equal(published.status, "published");
  assert.equal(fixture.calls.createPage, 1);
  assert.equal(fixture.calls.createPageProperty, 1);

  const secondApproved = await storage.createApprovedReport();
  const uncertainFixture = confluenceFixture({
    createBehavior: async () => {
      const error = new Error("create response timed out");
      error.status = 503;
      error.code = "UPSTREAM_TIMEOUT";
      error.exposeApiMessage = true;
      throw error;
    },
  });
  await assert.rejects(
    publishReport({
      pool,
      reportId: secondApproved.id,
      spaceId,
      parentPageId,
      actorAccountId: "publisher-account",
      confluenceClient: uncertainFixture.client,
    }),
    { status: 503, code: "PUBLICATION_UNCERTAIN" },
  );
  assert.equal((await getReport(pool, secondApproved.id)).status, "approved");
  assert.equal(uncertainFixture.calls.createPage, 1);

  await assert.rejects(
    publishReport({
      pool,
      reportId: secondApproved.id,
      spaceId,
      parentPageId,
      actorAccountId: "publisher-account",
      confluenceClient: uncertainFixture.client,
    }),
    { status: 409, code: "CONFLUENCE_TITLE_CONFLICT" },
  );
  assert.equal(uncertainFixture.calls.createPage, 1);
});
