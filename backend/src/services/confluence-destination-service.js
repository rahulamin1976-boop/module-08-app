import { createApiError } from "../middleware/error-handler.js";

const PAGE_TITLE_LIMIT = 255;
const PROJECT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;

export async function searchSpaces({
  confluenceClient,
  query = "",
  cursor,
  limit = 50,
}) {
  const normalizedQuery = normalizeSearchQuery(query);
  const result = await confluenceClient.searchSpaces({
    query: normalizedQuery,
    cursor,
    limit,
  });
  const seen = new Set();
  const items = [];
  for (const space of result.results ?? []) {
    if (!space.id || !space.key || !space.name || seen.has(String(space.id))) continue;
    seen.add(String(space.id));
    items.push({
      id: String(space.id),
      key: space.key,
      name: space.name,
    });
  }
  return { items, nextCursor: extractNextCursor(result) };
}

export async function searchParentPages({
  confluenceClient,
  spaceId,
  parentId,
  query = "",
  cursor,
  limit = 50,
}) {
  if (typeof spaceId !== "string" || !/^[A-Za-z0-9._:-]{1,255}$/.test(spaceId)) {
    throw createApiError(400, "INVALID_SPACE_ID", "Confluence space identifier is invalid.");
  }
  if (
    parentId !== undefined &&
    (typeof parentId !== "string" || !/^[A-Za-z0-9._:-]{1,255}$/.test(parentId))
  ) {
    throw createApiError(400, "INVALID_PARENT_ID", "Confluence parent page identifier is invalid.");
  }
  const normalizedQuery = normalizeSearchQuery(query);
  const result = await confluenceClient.searchPages({
    spaceId,
    parentId,
    title: normalizedQuery,
    cursor,
    limit,
  });
  const seen = new Set();
  const items = [];
  for (const page of result.results ?? []) {
    if (!page.id || !page.title || seen.has(String(page.id))) continue;
    seen.add(String(page.id));
    items.push({
      id: String(page.id),
      title: page.title,
      parentId: page.parentId == null ? null : String(page.parentId),
    });
  }
  return { items, nextCursor: extractNextCursor(result) };
}

export function buildReportTitle({
  projectKey,
  periodStart,
  periodEnd,
  suffix,
}) {
  if (
    typeof projectKey !== "string" ||
    !PROJECT_KEY_PATTERN.test(projectKey) ||
    !isIsoDate(periodStart) ||
    !isIsoDate(periodEnd) ||
    periodStart > periodEnd
  ) {
    throw createApiError(400, "INVALID_REPORT_TITLE", "Report title details are invalid.");
  }
  const base = `${projectKey} Weekly Status ${periodStart} to ${periodEnd}`;
  if (suffix === undefined || suffix === null || suffix === "") return base;
  if (typeof suffix !== "string" || suffix.trim().length === 0) {
    throw createApiError(400, "INVALID_REPORT_TITLE", "Title suffix must not be empty.");
  }
  const title = `${base} (${suffix.trim()})`;
  if (title.length > PAGE_TITLE_LIMIT) {
    throw createApiError(400, "INVALID_REPORT_TITLE", "Confluence page title must be at most 255 characters.");
  }
  return title;
}

export function validateReportTitle(title, report) {
  const base = buildReportTitle({
    projectKey: report.project.key,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
  });
  if (
    typeof title !== "string" ||
    title.length < 1 ||
    title.length > PAGE_TITLE_LIMIT ||
    (title !== base &&
      (!title.startsWith(`${base} (`) || !title.endsWith(")") ||
        title.slice(base.length + 2, -1).trim().length === 0))
  ) {
    throw createApiError(
      400,
      "INVALID_REPORT_TITLE",
      "Confluence page title must follow the required project and reporting-period format.",
    );
  }
  return title;
}

function normalizeSearchQuery(query) {
  if (query === undefined || query === "") return "";
  if (
    typeof query !== "string" ||
    query.trim().length < 1 ||
    query.trim().length > 100
  ) {
    throw createApiError(400, "INVALID_QUERY", "Search query must contain 1 to 100 characters.");
  }
  return query.trim();
}

function extractNextCursor(result) {
  const next = result._links?.next;
  if (!next) return null;
  try {
    return new URL(next, "https://api.atlassian.com").searchParams.get("cursor");
  } catch {
    throw createApiError(502, "UPSTREAM_INVALID_RESPONSE", "Confluence returned an invalid page cursor.");
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
