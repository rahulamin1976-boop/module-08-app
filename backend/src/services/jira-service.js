import { createApiError } from "../middleware/error-handler.js";

const CATEGORIES = new Set(["accomplishment", "blocker", "next_week"]);

export async function searchProjects({
  pool,
  jiraClient,
  query = "",
  cursor,
  limit = 50,
}) {
  const startAt = decodeProjectCursor(cursor);
  const result = await jiraClient.searchProjects({
    query,
    startAt,
    maxResults: limit,
  });
  const seen = new Set();
  const projects = [];

  for (const project of result.values ?? []) {
    if (!project.id || !project.key || !project.name || seen.has(String(project.id))) {
      continue;
    }
    seen.add(String(project.id));
    const saved = await pool.query(
      `INSERT INTO projects (jira_project_id, jira_project_key, name, last_synced_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (jira_project_id) DO UPDATE
         SET jira_project_key = EXCLUDED.jira_project_key,
             name = EXCLUDED.name,
             last_synced_at = NOW(),
             updated_at = NOW()
       RETURNING id, jira_project_id, jira_project_key, name`,
      [String(project.id), project.key, project.name],
    );
    projects.push(mapProject(saved.rows[0]));
  }

  const nextStartAt = startAt + (result.values?.length ?? 0);
  const nextCursor = result.isLast === false
    ? encodeCursor(nextStartAt)
    : null;

  return { items: projects, nextCursor };
}

export async function searchIssueCandidates({
  pool,
  jiraClient,
  projectId,
  from,
  to,
  timezone,
  cursor,
  limit = 50,
}) {
  validatePeriod(from, to, timezone);
  const projectResult = await pool.query(
    `SELECT jira_project_id, jira_project_key
     FROM projects
     WHERE id = $1`,
    [projectId],
  );
  if (projectResult.rowCount === 0) {
    throw createApiError(404, "PROJECT_NOT_FOUND", "Project was not found.");
  }

  const project = projectResult.rows[0];
  const pageToken = decodeIssueCursor(cursor);
  const result = await jiraClient.searchIssues({
    jql: buildPeriodJql(project.jira_project_key, from, to, timezone),
    fields: ["summary", "status", "assignee", "updated"],
    maxResults: limit,
    ...(pageToken ? { nextPageToken: pageToken } : {}),
  });
  const candidates = new Map();

  for (const issue of result.issues ?? []) {
    if (!issue.id || !issue.key || candidates.has(String(issue.id))) {
      continue;
    }
    candidates.set(String(issue.id), {
      issueId: String(issue.id),
      issueKey: issue.key,
      summary: String(issue.fields?.summary ?? ""),
      status: String(issue.fields?.status?.name ?? ""),
      assignee: issue.fields?.assignee?.displayName ?? null,
      updatedAt: issue.fields?.updated ?? null,
      url: jiraClient.issueUrl?.(issue.key) ?? issue.self ?? null,
    });
  }

  return {
    items: [...candidates.values()],
    nextCursor: result.nextPageToken ? encodeIssueCursor(result.nextPageToken) : null,
  };
}

export function buildPeriodJql(projectKey, from, to, timezone) {
  validatePeriod(from, to, timezone);
  const start = localDateBoundary(from, timezone);
  const end = localDateBoundary(addCalendarDays(to, 1), timezone);
  return `project = "${escapeJql(projectKey)}" AND updated >= "${formatJqlDate(start)}" AND updated < "${formatJqlDate(end)}" ORDER BY id ASC`;
}

export function validatePeriod(from, to, timezone) {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw createApiError(
      400,
      "INVALID_PERIOD",
      "Provide valid ordered ISO reporting dates.",
    );
  }

  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw createApiError(400, "INVALID_TIMEZONE", "A valid IANA timezone is required.");
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw createApiError(400, "INVALID_TIMEZONE", "A valid IANA timezone is required.");
  }
}

export function localDateBoundary(date, timezone) {
  validatePeriod(date, date, timezone);
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let candidate = target;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate).map(({ type, value }) => [type, value]),
    );
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const correction = target - represented;
    if (correction === 0) {
      return new Date(candidate).toISOString();
    }
    candidate += correction;
  }

  throw createApiError(
    400,
    "INVALID_PERIOD_BOUNDARY",
    "The reporting date boundary cannot be represented in the selected timezone.",
  );
}

function mapProject(project) {
  return {
    id: project.id,
    jiraProjectId: project.jira_project_id,
    key: project.jira_project_key,
    name: project.name,
  };
}

function decodeProjectCursor(cursor) {
  if (!cursor) return 0;
  const value = decodeCursor(cursor);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createApiError(400, "INVALID_CURSOR", "Project cursor is invalid.");
  }
  return value;
}

function decodeIssueCursor(cursor) {
  if (!cursor) return undefined;
  const value = decodeCursor(cursor);
  if (typeof value !== "string" || value.length === 0) {
    throw createApiError(400, "INVALID_CURSOR", "Issue cursor is invalid.");
  }
  return value;
}

function encodeIssueCursor(token) {
  return Buffer.from(JSON.stringify(token)).toString("base64url");
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(cursor) {
  try {
    const value = Buffer.from(cursor, "base64url").toString("utf8");
    if (Buffer.from(value, "utf8").toString("base64url") !== cursor) {
      throw new Error("non-canonical cursor");
    }
    return JSON.parse(value);
  } catch {
    throw createApiError(400, "INVALID_CURSOR", "Cursor is invalid.");
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addCalendarDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatJqlDate(isoDateTime) {
  return isoDateTime.replace("T", " ").replace(".000Z", "");
}

function escapeJql(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
