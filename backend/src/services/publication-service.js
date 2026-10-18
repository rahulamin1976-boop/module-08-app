import { createApiError } from "../middleware/error-handler.js";
import {
  buildReportTitle,
  validateReportTitle,
} from "./confluence-destination-service.js";
import { renderReport } from "./report-renderer.js";
import { validateReport } from "./report-validation.js";
import { getReport } from "./report-service.js";

const REPORT_PROPERTY_KEY = "weekly-status-report-id";
const DESTINATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

export async function publishReport({
  pool,
  reportId,
  spaceId,
  parentPageId,
  titleSuffix,
  actorAccountId,
  confluenceClient,
}) {
  validateActor(actorAccountId);
  validateDestinationId(spaceId, "space");
  validateDestinationId(parentPageId, "parent page");
  if (!confluenceClient) {
    throw new Error("A Confluence client is required for publication.");
  }

  const publication = await beginPublication({
    pool,
    reportId,
    spaceId,
    parentPageId,
    titleSuffix,
    actorAccountId,
  });
  if (publication.alreadyPublished) {
    return getReport(pool, reportId);
  }

  try {
    const parent = await confluenceClient.getPage(parentPageId);
    if (
      !parent ||
      String(parent.id) !== parentPageId ||
      String(parent.spaceId) !== spaceId
    ) {
      throw createApiError(
        400,
        "INVALID_PUBLICATION_DESTINATION",
        "Choose a parent page in the selected Confluence space.",
      );
    }

    const matching = await findReportPage({
      confluenceClient,
      spaceId,
      parentPageId,
      title: publication.title,
      reportId,
    });
    if (matching.page) {
      await completePublication(pool, {
        reportId,
        actorAccountId,
        page: matching.page,
        spaceId,
        parentPageId,
        title: publication.title,
        siteUrl: confluenceClient.siteUrl,
      });
      return getReport(pool, reportId);
    }
    if (matching.collision) {
      throw createApiError(
        409,
        "CONFLUENCE_TITLE_CONFLICT",
        "A different Confluence page already uses this title under the selected parent.",
      );
    }

    let page;
    try {
      page = await confluenceClient.createPage({
        spaceId,
        parentId: parentPageId,
        title: publication.title,
        storageValue: markdownToConfluenceStorage(publication.markdown),
      });
    } catch (error) {
      const reconciled = await findReportPage({
        confluenceClient,
        spaceId,
        parentPageId,
        title: publication.title,
        reportId,
      });
      if (reconciled.page) {
        await completePublication(pool, {
          reportId,
          actorAccountId,
          page: reconciled.page,
          spaceId,
          parentPageId,
          title: publication.title,
          siteUrl: confluenceClient.siteUrl,
        });
        return getReport(pool, reportId);
      }
      throw uncertainPublicationError(error, reconciled.collision);
    }
    validateCreatedPage(page);

    try {
      await confluenceClient.createPageProperty(page.id, {
        key: REPORT_PROPERTY_KEY,
        value: { reportId },
      });
    } catch (error) {
      const reconciled = await findReportPage({
        confluenceClient,
        spaceId,
        parentPageId,
        title: publication.title,
        reportId,
      });
      if (reconciled.page) {
        await completePublication(pool, {
          reportId,
          actorAccountId,
          page: reconciled.page,
          spaceId,
          parentPageId,
          title: publication.title,
          siteUrl: confluenceClient.siteUrl,
        });
        return getReport(pool, reportId);
      }
      throw uncertainPublicationError(error, reconciled.collision);
    }

    await completePublication(pool, {
      reportId,
      actorAccountId,
      page,
      spaceId,
      parentPageId,
      title: publication.title,
      siteUrl: confluenceClient.siteUrl,
    });
    return getReport(pool, reportId);
  } catch (error) {
    await failPublication(pool, {
      reportId,
      actorAccountId,
      code: error.code ?? "PUBLICATION_FAILED",
    });
    throw error;
  }
}

export function markdownToConfluenceStorage(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) {
    throw createApiError(400, "INVALID_REPORT_CONTENT", "Report content is empty.");
  }
  const blocks = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      blocks.push("</ul>");
      listOpen = false;
    }
  };
  for (const line of markdown.split("\n")) {
    if (line.trim() === "") {
      closeList();
    } else if (line.startsWith("## ")) {
      closeList();
      blocks.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!listOpen) {
        blocks.push("<ul>");
        listOpen = true;
      }
      blocks.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else {
      throw createApiError(
        400,
        "INVALID_REPORT_CONTENT",
        "Report content does not match the approved Markdown format.",
      );
    }
  }
  closeList();
  return blocks.join("");
}

async function beginPublication({
  pool,
  reportId,
  spaceId,
  parentPageId,
  titleSuffix,
  actorAccountId,
}) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query(
      `SELECT r.id, r.version, r.status, r.source_snapshot,
              r.confirmed_empty_categories, r.confluence_space_id,
              r.confluence_parent_page_id, r.confluence_page_title,
              r.confluence_page_id, p.jira_project_key,
              r.period_start, r.period_end
       FROM status_reports r
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1
       FOR UPDATE`,
      [reportId],
    );
    if (result.rowCount === 0) {
      throw createApiError(404, "REPORT_NOT_FOUND", "Report was not found.");
    }
    const report = result.rows[0];
    if (report.status === "published") {
      await client.query("COMMIT");
      transactionOpen = false;
      return { alreadyPublished: true };
    }
    if (report.status !== "approved" && report.status !== "publishing") {
      throw createApiError(
        409,
        "REPORT_NOT_APPROVED",
        "Only an approved report can be published.",
      );
    }
    const periodStart = dateOnly(report.period_start);
    const periodEnd = dateOnly(report.period_end);
    const title = buildReportTitle({
      projectKey: report.jira_project_key,
      periodStart,
      periodEnd,
      suffix: titleSuffix,
    });
    validateReportTitle(title, {
      project: { key: report.jira_project_key },
      periodStart,
      periodEnd,
    });
    if (
      report.status === "publishing" &&
      (
        report.confluence_space_id !== spaceId ||
        report.confluence_parent_page_id !== parentPageId ||
        report.confluence_page_title !== title
      )
    ) {
      throw createApiError(
        409,
        "PUBLICATION_DESTINATION_CONFLICT",
        "Retry publication using the destination and title already selected.",
      );
    }
    const itemsResult = await client.query(
      `SELECT category, text
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
        "Complete the report before publishing it.",
      );
      error.details = { validation };
      throw error;
    }

    if (report.status === "approved") {
      await client.query(
        `UPDATE status_reports
         SET status = 'publishing',
             confluence_space_id = $1,
             confluence_parent_page_id = $2,
             confluence_page_title = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [spaceId, parentPageId, title, reportId],
      );
    }
    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'publish_started', $3)`,
      [
        reportId,
        actorAccountId,
        JSON.stringify({ spaceId, parentPageId, title }),
      ],
    );
    await client.query("COMMIT");
    transactionOpen = false;
    const blocks = renderReport({
      items: itemsResult.rows,
      confirmedEmptyCategories: report.confirmed_empty_categories ?? [],
      sourceAvailability,
    });
    return { title, markdown: blocks.markdown };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findReportPage({
  confluenceClient,
  spaceId,
  parentPageId,
  title,
  reportId,
}) {
  const result = await confluenceClient.searchPages({
    spaceId,
    parentId: parentPageId,
    title,
    limit: 100,
  });
  const exactMatches = (result.results ?? []).filter((page) =>
    page.title === title &&
    String(page.spaceId ?? spaceId) === spaceId &&
    String(page.parentId ?? "") === parentPageId,
  );
  let matchingPage;
  for (const page of exactMatches) {
    const properties = await confluenceClient.getPageProperties(page.id, {
      key: REPORT_PROPERTY_KEY,
      limit: 100,
    });
    const hasReportKey = (properties.results ?? []).some((property) =>
      property.key === REPORT_PROPERTY_KEY &&
      (property.value?.reportId === reportId || property.value === reportId),
    );
    if (hasReportKey) {
      if (matchingPage) {
        throw createApiError(
          409,
          "DUPLICATE_REPORT_PAGES",
          "Multiple Confluence pages contain this report identity.",
        );
      }
      matchingPage = page;
    }
  }
  return {
    page: matchingPage,
    collision: exactMatches.length > 0 && !matchingPage,
  };
}

async function completePublication(pool, {
  reportId,
  actorAccountId,
  page,
  spaceId,
  parentPageId,
  title,
  siteUrl,
}) {
  validateCreatedPage(page);
  const pageUrl = createPageUrl(page, siteUrl);
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const current = await client.query(
      "SELECT status FROM status_reports WHERE id = $1 FOR UPDATE",
      [reportId],
    );
    if (current.rowCount === 0) {
      throw createApiError(404, "REPORT_NOT_FOUND", "Report was not found.");
    }
    if (current.rows[0].status === "published") {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }
    if (current.rows[0].status !== "publishing") {
      throw createApiError(
        409,
        "PUBLICATION_STATE_CHANGED",
        "Report publication state changed; reload before continuing.",
      );
    }
    await client.query(
      `UPDATE status_reports
       SET status = 'published',
           confluence_space_id = $1,
           confluence_parent_page_id = $2,
           confluence_page_title = $3,
           confluence_page_id = $4,
           confluence_page_url = $5,
           published_at = NOW(),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $6`,
      [spaceId, parentPageId, title, String(page.id), pageUrl, reportId],
    );
    await client.query(
      `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
       VALUES ($1, $2, 'published', $3)`,
      [
        reportId,
        actorAccountId,
        JSON.stringify({ pageId: String(page.id), spaceId, parentPageId }),
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
}

async function failPublication(pool, { reportId, actorAccountId, code }) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const current = await client.query(
      "SELECT status FROM status_reports WHERE id = $1 FOR UPDATE",
      [reportId],
    );
    if (current.rowCount > 0 && current.rows[0].status === "publishing") {
      await client.query(
        `UPDATE status_reports
         SET status = 'approved',
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [reportId],
      );
      await client.query(
        `INSERT INTO report_audit_events (report_id, actor_account_id, action, details)
         VALUES ($1, $2, 'publish_failed', $3)`,
        [reportId, actorAccountId, JSON.stringify({ code })],
      );
    }
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function uncertainPublicationError(error, collision) {
  if (collision) {
    return createApiError(
      503,
      "PUBLICATION_UNCERTAIN",
      "A page may have been created, but its report identity could not be verified. Resolve the title conflict before retrying.",
    );
  }
  if (error?.exposeApiMessage) return error;
  return createApiError(
    503,
    "PUBLICATION_UNCERTAIN",
    "Confluence did not confirm publication. Retry to reconcile the report page before creating another.",
  );
}

function createPageUrl(page, siteUrl) {
  if (typeof siteUrl !== "string") {
    throw createApiError(
      502,
      "PUBLICATION_REFERENCE_MISSING",
      "Confluence confirmed the page but did not provide a safe page URL.",
    );
  }
  try {
    const base = new URL(siteUrl);
    const pageUrl = new URL(
      page._links?.webui ?? `/wiki/pages/${encodeURIComponent(page.id)}`,
      base,
    );
    if (
      base.protocol !== "https:" ||
      pageUrl.protocol !== "https:" ||
      pageUrl.host !== base.host
    ) {
      throw new Error("Unsafe page URL");
    }
    return pageUrl.toString();
  } catch {
    throw createApiError(
      502,
      "PUBLICATION_REFERENCE_MISSING",
      "Confluence confirmed the page but did not provide a safe page URL.",
    );
  }
}

function validateCreatedPage(page) {
  if (!page || (typeof page.id !== "string" && typeof page.id !== "number")) {
    throw createApiError(
      502,
      "PUBLICATION_REFERENCE_MISSING",
      "Confluence did not confirm the created page identifier.",
    );
  }
}

function validateActor(actorAccountId) {
  if (typeof actorAccountId !== "string" || actorAccountId.trim() === "") {
    throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
  }
}

function validateDestinationId(value, label) {
  if (typeof value !== "string" || !DESTINATION_ID_PATTERN.test(value)) {
    throw createApiError(
      400,
      "INVALID_PUBLICATION_DESTINATION",
      `Confluence ${label} identifier is invalid.`,
    );
  }
}

function dateOnly(value) {
  if (!(value instanceof Date)) return value;
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function renderInline(value) {
  const linkPattern = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  let result = "";
  let offset = 0;
  for (const match of value.matchAll(linkPattern)) {
    const [full, label, href] = match;
    const start = match.index ?? 0;
    result += escapeHtml(value.slice(offset, start));
    let safeHref;
    try {
      const url = new URL(href);
      safeHref = url.protocol === "https:" && !url.username && !url.password
        ? url.toString()
        : null;
    } catch {
      safeHref = null;
    }
    result += safeHref
      ? `<a href="${escapeHtml(safeHref)}">${escapeHtml(label)}</a>`
      : escapeHtml(full);
    offset = start + full.length;
  }
  return `${result}${escapeHtml(value.slice(offset))}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
