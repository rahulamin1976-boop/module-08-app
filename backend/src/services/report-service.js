import { randomUUID } from "node:crypto";
import { buildPeriodJql, localDateBoundary, validatePeriod } from "./jira-service.js";
import { createApiError } from "../middleware/error-handler.js";
import { renderReport } from "./report-renderer.js";
import { validateReport } from "./report-validation.js";

const CATEGORIES = new Set(["accomplishment", "blocker", "next_week"]);
const REPORT_STATUSES = new Set(["draft", "approved", "publishing", "published"]);

export async function createReport({
  pool,
  projectId,
  periodStart,
  periodEnd,
  timezone,
  jiraUpdates,
  manualUpdates,
  confirmedEmptyCategories,
  creatorAccountId,
  jiraClient,
  now = () => new Date(),
}) {
  validatePeriod(periodStart, periodEnd, timezone);
  assertCreateInputs({
    projectId,
    jiraUpdates,
    manualUpdates,
    confirmedEmptyCategories,
    creatorAccountId,
  });

  const projectResult = await pool.query(
    `SELECT id, jira_project_id, jira_project_key, name
     FROM projects
     WHERE id = $1`,
    [projectId],
  );
  if (projectResult.rowCount === 0) {
    throw createApiError(404, "PROJECT_NOT_FOUND", "Project was not found.");
  }
  const project = projectResult.rows[0];
  const preparedManualItems = manualUpdates.map(normalizeManualUpdate);
  const normalizedJiraUpdates = jiraUpdates.map(validateJiraSelection);
  ensureNoDuplicateIssueSelections(normalizedJiraUpdates);
  validateEmptyConfirmations(
    confirmedEmptyCategories,
    [...normalizedJiraUpdates, ...preparedManualItems],
  );

  let jiraItems = [];
  let jiraAvailable = false;
  let sourceWarning;
  const retrievedAt = now().toISOString();
  const periodStartUtc = localDateBoundary(periodStart, timezone);
  const periodEndUtc = localDateBoundary(addCalendarDays(periodEnd, 1), timezone);

  try {
    if (!jiraClient) {
      throw createApiError(503, "JIRA_UNAVAILABLE", "Jira is unavailable.");
    }
    if (normalizedJiraUpdates.length === 0) {
      await jiraClient.searchIssues({
        jql: buildPeriodJql(project.jira_project_key, periodStart, periodEnd, timezone),
        fields: ["summary", "status", "assignee", "updated"],
        maxResults: 1,
      });
      jiraAvailable = true;
    } else {
      for (const selection of normalizedJiraUpdates) {
        const issue = await jiraClient.getIssue(selection.issueId);
        jiraItems.push(snapshotSelectedIssue({
          issue,
          selection,
          project,
          siteUrl: jiraClient.siteUrl,
          periodStartUtc,
          periodEndUtc,
          retrievedAt,
        }));
      }
      jiraAvailable = true;
    }
  } catch (error) {
    if (!isSourceUnavailable(error) || preparedManualItems.length === 0) {
      throw error;
    }
    jiraItems = [];
    jiraAvailable = false;
    sourceWarning = {
      code: "JIRA_UNAVAILABLE",
      message: "Jira updates could not be verified; this draft contains manual updates only.",
    };
  }

  if (!jiraAvailable && confirmedEmptyCategories.length > 0) {
    throw createApiError(
      400,
      "EMPTY_CONFIRMATION_UNAVAILABLE",
      "Empty categories cannot be confirmed while Jira data is unavailable.",
    );
  }

  const items = [...jiraItems, ...preparedManualItems];
  const warnings = sourceWarning ? [sourceWarning] : [];
  const sourceSnapshot = {
    jiraStatus: jiraAvailable ? "available" : "unavailable",
    retrievedAt,
    periodStartUtc,
    periodEndUtc,
    selectedIssueIds: jiraItems.map((item) => item.sourceSnapshot.issueId),
  };
  const reportId = randomUUID();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(
      `INSERT INTO status_reports (
         id, project_id, created_by_account_id, period_start, period_end,
         timezone, source_snapshot, confirmed_empty_categories, warnings
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        reportId,
        projectId,
        creatorAccountId,
        periodStart,
        periodEnd,
        timezone,
        sourceSnapshot,
        jiraAvailable ? confirmedEmptyCategories : [],
        JSON.stringify(warnings),
      ],
    );

    const positions = new Map();
    for (const item of items) {
      const position = positions.get(item.category) ?? 0;
      positions.set(item.category, position + 1);
      await client.query(
        `INSERT INTO report_items (
           report_id, category, text, source_type, source_reference,
           source_snapshot, owner, source_updated_at, position
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          reportId,
          item.category,
          item.text,
          item.sourceType,
          item.sourceReference,
          item.sourceSnapshot,
          item.owner,
          item.sourceUpdatedAt,
          position,
        ],
      );
    }

    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'created', $3)`,
      [reportId, creatorAccountId, { sourceCount: items.length }],
    );
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }

  return getReport(pool, reportId);
}

export async function getReport(pool, reportId) {
  const reportResult = await pool.query(
    `SELECT r.id, r.version, r.status, r.created_by_account_id,
            r.approved_by_account_id, r.last_edited_by_account_id,
            r.period_start, r.period_end, r.timezone, r.source_snapshot,
            r.confirmed_empty_categories, r.warnings, r.approved_at,
            r.published_at, r.confluence_space_id, r.confluence_parent_page_id,
            r.confluence_page_id, r.confluence_page_url, r.confluence_page_title,
            r.updated_at,
            p.id AS project_id, p.jira_project_id, p.jira_project_key,
            p.name AS project_name
     FROM status_reports r
     JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1`,
    [reportId],
  );
  if (reportResult.rowCount === 0) {
    throw createApiError(404, "REPORT_NOT_FOUND", "Report was not found.");
  }

  const row = reportResult.rows[0];
  const itemsResult = await pool.query(
    `SELECT id, category, text, source_type, source_reference,
            source_snapshot, edited_by_account_id, owner, source_updated_at,
            position, created_at, updated_at
     FROM report_items
     WHERE report_id = $1
     ORDER BY CASE category
                WHEN 'accomplishment' THEN 1
                WHEN 'blocker' THEN 2
                ELSE 3
              END,
              position, id`,
    [reportId],
  );
  const items = itemsResult.rows.map(mapItem);
  const confirmedEmptyCategories = row.confirmed_empty_categories ?? [];
  const sourceAvailability =
    row.source_snapshot?.jiraStatus === "unavailable" ? "unavailable" : "available";
  const rendered = renderReport({
    items,
    confirmedEmptyCategories,
    sourceAvailability,
  });
  const validation = validateReport({
    items,
    confirmedEmptyCategories,
    sourceAvailability,
    lineCount: rendered.lineCount,
  });

  return {
    id: row.id,
    version: row.version,
    status: row.status,
    project: {
      id: row.project_id,
      jiraProjectId: row.jira_project_id,
      key: row.jira_project_key,
      name: row.project_name,
    },
    periodStart: dateOnly(row.period_start),
    periodEnd: dateOnly(row.period_end),
    timezone: row.timezone,
    createdByAccountId: row.created_by_account_id,
    approvedByAccountId: row.approved_by_account_id,
    lastEditedByAccountId: row.last_edited_by_account_id,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    confluenceSpaceId: row.confluence_space_id,
    confluenceParentPageId: row.confluence_parent_page_id,
    confluencePageId: row.confluence_page_id,
    confluencePageUrl: row.confluence_page_url,
    confluencePageTitle: row.confluence_page_title,
    updatedAt: row.updated_at,
    sourceSnapshot: row.source_snapshot,
    items,
    sections: rendered.sections,
    markdown: rendered.markdown,
    lineCount: rendered.lineCount,
    validation,
    confirmedEmptyCategories,
    warnings: row.warnings ?? [],
  };
}

export async function listReports(pool, {
  projectId,
  status,
  cursor,
  limit = 50,
}) {
  if (projectId !== undefined && !isUuid(projectId)) {
    throw createApiError(400, "INVALID_PROJECT_ID", "Project identifier is invalid.");
  }
  if (status !== undefined && !REPORT_STATUSES.has(status)) {
    throw createApiError(400, "INVALID_STATUS", "Report status is invalid.");
  }

  const cursorValue = decodeListCursor(cursor);
  const clauses = [];
  const values = [];
  if (projectId) {
    values.push(projectId);
    clauses.push(`r.project_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    clauses.push(`r.status = $${values.length}`);
  }
  if (cursorValue) {
    values.push(cursorValue.updatedAt, cursorValue.id);
    clauses.push(`(r.updated_at, r.id) < ($${values.length - 1}, $${values.length})`);
  }
  values.push(limit + 1);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT r.id, r.period_start, r.period_end, r.timezone, r.status,
            r.version, r.updated_at, p.id AS project_id,
            p.jira_project_key, p.name AS project_name
     FROM status_reports r
     JOIN projects p ON p.id = r.project_id
     ${where}
     ORDER BY r.updated_at DESC, r.id DESC
     LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const items = rows.map((row) => ({
    id: row.id,
    project: {
      id: row.project_id,
      key: row.jira_project_key,
      name: row.project_name,
    },
    periodStart: dateOnly(row.period_start),
    periodEnd: dateOnly(row.period_end),
    timezone: row.timezone,
    status: row.status,
    version: row.version,
    updatedAt: row.updated_at,
  }));
  const last = rows.at(-1);
  const nextCursor = hasMore && last
    ? encodeListCursor({ updatedAt: last.updated_at, id: last.id })
    : null;

  return { items, nextCursor };
}

export async function updateReport(pool, {
  reportId,
  version,
  items,
  confirmedEmptyCategories,
  actorAccountId,
}) {
  validateMutationActor(actorAccountId);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw createApiError(400, "INVALID_VERSION", "Report version is invalid.");
  }
  if (!Array.isArray(items)) {
    throw createApiError(400, "INVALID_REPORT_ITEMS", "Report items are required.");
  }
  const editedItems = items.map(normalizeEditedItem);
  if (new Set(editedItems.map(({ id }) => id)).size !== editedItems.length) {
    throw createApiError(400, "DUPLICATE_REPORT_ITEM", "A report item may appear only once.");
  }
  validateConfirmedCategories(confirmedEmptyCategories);

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const report = await getLockedReport(client, reportId);
    assertDraft(report);
    assertExpectedVersion(report, version);
    const storedItems = await client.query(
      `SELECT id, category, text, source_type, source_reference,
              source_snapshot, edited_by_account_id, owner, source_updated_at,
              position
       FROM report_items
       WHERE report_id = $1
       ORDER BY category, position, id
       FOR UPDATE`,
      [reportId],
    );
    const storedById = new Map(storedItems.rows.map((item) => [item.id, item]));
    for (const item of editedItems) {
      if (!storedById.has(item.id)) {
        throw createApiError(
          400,
          "REPORT_ITEM_NOT_FOUND",
          "A report item does not belong to this report.",
        );
      }
    }

    const populatedCategories = new Set(editedItems.map(({ category }) => category));
    const confirmed = confirmedEmptyCategories.filter(
      (category) => !populatedCategories.has(category),
    );
    if (
      report.source_snapshot?.jiraStatus === "unavailable" &&
      confirmed.length > 0
    ) {
      throw createApiError(
        400,
        "EMPTY_CONFIRMATION_UNAVAILABLE",
        "Empty categories cannot be confirmed while Jira data is unavailable.",
      );
    }

    const changes = editedItems.filter((item) => {
      const previous = storedById.get(item.id);
      return previous.category !== item.category ||
        previous.text !== item.text ||
        (previous.owner ?? "") !== (item.owner ?? "");
    });
    const changedItemIds = changes.map(({ id }) => id);
    const changedIds = new Set(changedItemIds);
    const retainedIds = new Set(editedItems.map(({ id }) => id));
    const removedItemIds = [...storedById.keys()].filter((id) => !retainedIds.has(id));

    await client.query(
      `UPDATE report_items
       SET position = position + 1000000
       WHERE report_id = $1`,
      [reportId],
    );
    const positions = new Map();
    for (const item of editedItems) {
      const previous = storedById.get(item.id);
      const changed = changedIds.has(item.id);
      const position = positions.get(item.category) ?? 0;
      positions.set(item.category, position + 1);
      await client.query(
        `UPDATE report_items
         SET category = $1,
             text = $2,
             owner = $3,
             source_type = $4,
             edited_by_account_id = $5,
             position = $6,
             updated_at = CASE WHEN $7 THEN NOW() ELSE updated_at END
         WHERE id = $8 AND report_id = $9`,
        [
          item.category,
          item.text,
          item.owner,
          changed ? "user_edited" : previous.source_type,
          changed ? actorAccountId : previous.edited_by_account_id,
          position,
          changed,
          item.id,
          reportId,
        ],
      );
    }
    if (removedItemIds.length > 0) {
      await client.query(
        "DELETE FROM report_items WHERE report_id = $1 AND id = ANY($2::uuid[])",
        [reportId, removedItemIds],
      );
    }

    await client.query(
      `UPDATE status_reports
       SET version = version + 1,
           last_edited_by_account_id = $1,
           confirmed_empty_categories = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [actorAccountId, confirmed, reportId],
    );
    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'edited', $3)`,
      [
        reportId,
        actorAccountId,
        JSON.stringify({ changedItemIds, removedItemIds, confirmedEmptyCategories: confirmed }),
      ],
    );
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getReport(pool, reportId);
}

export async function approveReport(pool, { reportId, actorAccountId }) {
  validateMutationActor(actorAccountId);
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const report = await getLockedReport(client, reportId);
    if (report.status !== "draft") {
      throw createApiError(409, "REPORT_NOT_DRAFT", "Only a draft report can be approved.");
    }
    const itemsResult = await client.query(
      `SELECT category, text
       FROM report_items
       WHERE report_id = $1`,
      [reportId],
    );
    const sourceAvailability =
      report.source_snapshot?.jiraStatus === "unavailable" ? "unavailable" : "available";
    const rendered = renderReport({
      items: itemsResult.rows,
      confirmedEmptyCategories: report.confirmed_empty_categories ?? [],
      sourceAvailability,
    });
    const validation = validateReport({
      items: itemsResult.rows,
      confirmedEmptyCategories: report.confirmed_empty_categories ?? [],
      sourceAvailability,
      lineCount: rendered.lineCount,
    });
    if (!validation.ready) {
      const error = createApiError(
        409,
        "REPORT_INCOMPLETE",
        "Complete the report before approving it.",
      );
      error.details = { validation };
      throw error;
    }
    await client.query(
      `UPDATE status_reports
       SET status = 'approved',
           approved_by_account_id = $1,
           approved_at = NOW(),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [actorAccountId, reportId],
    );
    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'approved', '{}'::jsonb)`,
      [reportId, actorAccountId],
    );
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getReport(pool, reportId);
}

export async function withdrawApproval(pool, { reportId, actorAccountId }) {
  validateMutationActor(actorAccountId);
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const report = await getLockedReport(client, reportId);
    if (report.status !== "approved") {
      throw createApiError(
        409,
        "REPORT_NOT_APPROVED",
        "Only an approved report can have its approval withdrawn.",
      );
    }
    await client.query(
      `UPDATE status_reports
       SET status = 'draft',
           approved_by_account_id = NULL,
           approved_at = NULL,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [reportId],
    );
    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'approval_withdrawn', '{}'::jsonb)`,
      [reportId, actorAccountId],
    );
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getReport(pool, reportId);
}

export async function deleteReport(pool, { reportId, actorAccountId, confirm }) {
  validateMutationActor(actorAccountId);
  if (confirm !== true) {
    throw createApiError(400, "CONFIRMATION_REQUIRED", "Confirm before deleting the report.");
  }
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const report = await getLockedReport(client, reportId);
    if (report.status === "publishing") {
      throw createApiError(
        409,
        "REPORT_PUBLISHING",
        "A report cannot be deleted while publication is in progress.",
      );
    }
    await client.query("DELETE FROM status_reports WHERE id = $1", [reportId]);
    await client.query("COMMIT");
    transactionOpen = false;
    return {
      deleted: true,
      confluencePageRemains: Boolean(report.confluence_page_id),
    };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function assertCreateInputs({
  projectId,
  jiraUpdates,
  manualUpdates,
  confirmedEmptyCategories,
  creatorAccountId,
}) {
  if (!isUuid(projectId)) {
    throw createApiError(400, "INVALID_PROJECT_ID", "Project identifier is invalid.");
  }
  if (!Array.isArray(jiraUpdates) || !Array.isArray(manualUpdates)) {
    throw createApiError(400, "INVALID_REQUEST", "Report update lists are required.");
  }
  if (
    !Array.isArray(confirmedEmptyCategories) ||
    confirmedEmptyCategories.some((category) => !CATEGORIES.has(category)) ||
    new Set(confirmedEmptyCategories).size !== confirmedEmptyCategories.length
  ) {
    throw createApiError(
      400,
      "INVALID_EMPTY_CATEGORIES",
      "Confirmed empty categories are invalid.",
    );
  }
  if (typeof creatorAccountId !== "string" || creatorAccountId.length === 0) {
    throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
  }
}

function validateJiraSelection(selection) {
  if (
    selection === null ||
    typeof selection !== "object" ||
    Array.isArray(selection) ||
    Object.keys(selection).some((key) => !["issueId", "issueKey", "category"].includes(key)) ||
    typeof selection.issueId !== "string" ||
    selection.issueId.length === 0 ||
    typeof selection.issueKey !== "string" ||
    selection.issueKey.length === 0 ||
    !CATEGORIES.has(selection.category)
  ) {
    throw createApiError(400, "INVALID_JIRA_UPDATE", "Jira update selection is invalid.");
  }
  return selection;
}

function normalizeManualUpdate(update) {
  if (
    update === null ||
    typeof update !== "object" ||
    Array.isArray(update) ||
    Object.keys(update).some((key) => !["category", "text", "owner"].includes(key)) ||
    !CATEGORIES.has(update.category) ||
    typeof update.text !== "string"
  ) {
    throw createApiError(400, "INVALID_MANUAL_UPDATE", "Manual update is invalid.");
  }
  const text = update.text.replace(/\s+/g, " ").trim();
  const owner =
    update.owner === undefined || update.owner === null
      ? null
      : typeof update.owner === "string"
        ? update.owner.trim()
        : undefined;
  if (
    text.length < 1 ||
    text.length > 2000 ||
    owner === undefined ||
    owner?.length > 120
  ) {
    throw createApiError(400, "INVALID_MANUAL_UPDATE", "Manual update is invalid.");
  }
  return {
    category: update.category,
    text,
    sourceType: "manual",
    sourceReference: null,
    sourceSnapshot: null,
    owner,
    sourceUpdatedAt: null,
  };
}

function snapshotSelectedIssue({
  issue,
  selection,
  project,
  siteUrl,
  periodStartUtc,
  periodEndUtc,
  retrievedAt,
}) {
  const updatedAt = issue.fields?.updated;
  const updatedTime = Date.parse(updatedAt);
  if (
    !issue.id ||
    String(issue.id) !== selection.issueId ||
    issue.key !== selection.issueKey ||
    String(issue.fields?.project?.id ?? "") !== project.jira_project_id ||
    !Number.isFinite(updatedTime) ||
    updatedTime < Date.parse(periodStartUtc) ||
    updatedTime >= Date.parse(periodEndUtc) ||
    typeof issue.fields?.summary !== "string" ||
    typeof issue.fields?.status?.name !== "string" ||
    typeof issue.self !== "string"
  ) {
    throw createApiError(
      409,
      "JIRA_ISSUE_CHANGED",
      "A selected Jira issue changed or no longer matches this report.",
    );
  }

  const sourceSnapshot = {
    issueId: String(issue.id),
    issueKey: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee?.displayName ?? null,
    updatedAt,
    url: siteUrl
      ? new URL(`/browse/${encodeURIComponent(issue.key)}`, siteUrl).toString()
      : issue.self,
    retrievedAt,
  };
  return {
    category: selection.category,
    text: issue.fields.summary,
    sourceType: "jira",
    sourceReference: issue.key,
    sourceSnapshot,
    owner: sourceSnapshot.assignee,
    sourceUpdatedAt: updatedAt,
  };
}

function validateEmptyConfirmations(confirmed, items) {
  const populated = new Set(items.map(({ category }) => category));
  if (confirmed.some((category) => populated.has(category))) {
    throw createApiError(
      400,
      "EMPTY_CATEGORY_HAS_ITEMS",
      "A category containing report items cannot be confirmed empty.",
    );
  }
}

function ensureNoDuplicateIssueSelections(updates) {
  if (new Set(updates.map(({ issueId }) => issueId)).size !== updates.length) {
    throw createApiError(400, "DUPLICATE_JIRA_ISSUE", "A Jira issue may be selected only once.");
  }
}

function isSourceUnavailable(error) {
  return (
    error?.code === "JIRA_UNAVAILABLE" ||
    error?.code === "UPSTREAM_UNAVAILABLE" ||
    error?.code === "UPSTREAM_TIMEOUT" ||
    error?.code === "UPSTREAM_RATE_LIMITED" ||
    error?.code === "UPSTREAM_AUTHORIZATION_FAILED" ||
    error?.code === "REAUTH_REQUIRED" ||
    error?.code === "NOT_CONNECTED" ||
    (Number.isInteger(error?.status) && error.status >= 500)
  );
}

function mapItem(row) {
  return {
    id: row.id,
    category: row.category,
    text: row.text,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    sourceSnapshot: row.source_snapshot,
    editedByAccountId: row.edited_by_account_id,
    owner: row.owner,
    sourceUpdatedAt: row.source_updated_at,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dateOnly(value) {
  if (!(value instanceof Date)) return value;
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function addCalendarDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function decodeListCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    if (Buffer.from(json).toString("base64url") !== cursor) {
      throw new Error("invalid encoding");
    }
    const value = JSON.parse(json);
    if (
      !value ||
      typeof value.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.updatedAt)) ||
      !isUuid(value.id)
    ) {
      throw new Error("invalid cursor");
    }
    return value;
  } catch {
    throw createApiError(400, "INVALID_CURSOR", "Report cursor is invalid.");
  }
}

function encodeListCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function validateMutationActor(actorAccountId) {
  if (typeof actorAccountId !== "string" || actorAccountId.trim() === "") {
    throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
  }
}

function getLockedReport(client, reportId) {
  return client.query(
    `SELECT id, version, status, source_snapshot, confirmed_empty_categories,
            confluence_page_id
     FROM status_reports
     WHERE id = $1
     FOR UPDATE`,
    [reportId],
  ).then((result) => {
    if (result.rowCount === 0) {
      throw createApiError(404, "REPORT_NOT_FOUND", "Report was not found.");
    }
    return result.rows[0];
  });
}

function assertDraft(report) {
  if (report.status !== "draft") {
    throw createApiError(409, "REPORT_NOT_DRAFT", "Only draft reports can be edited.");
  }
}

function assertExpectedVersion(report, version) {
  if (report.version === version) return;
  const error = createApiError(
    409,
    "STALE_VERSION",
    "The report changed in another session. Reload the latest report before saving.",
  );
  error.details = { latestVersion: report.version };
  throw error;
}

function normalizeEditedItem(item) {
  if (
    item === null ||
    typeof item !== "object" ||
    Array.isArray(item) ||
    Object.keys(item).some((key) => !["id", "category", "text", "owner"].includes(key)) ||
    !isUuid(item.id) ||
    !CATEGORIES.has(item.category) ||
    typeof item.text !== "string"
  ) {
    throw createApiError(400, "INVALID_REPORT_ITEM", "Report item is invalid.");
  }
  const text = item.text.replace(/\s+/g, " ").trim();
  const owner = item.owner === undefined || item.owner === null
    ? null
    : typeof item.owner === "string"
      ? item.owner.trim() || null
      : undefined;
  if (text.length < 1 || text.length > 2000 || owner === undefined || owner?.length > 120) {
    throw createApiError(400, "INVALID_REPORT_ITEM", "Report item is invalid.");
  }
  return { id: item.id, category: item.category, text, owner };
}

function validateConfirmedCategories(categories) {
  if (
    !Array.isArray(categories) ||
    categories.some((category) => !CATEGORIES.has(category)) ||
    new Set(categories).size !== categories.length
  ) {
    throw createApiError(
      400,
      "INVALID_EMPTY_CATEGORIES",
      "Confirmed empty categories are invalid.",
    );
  }
}
