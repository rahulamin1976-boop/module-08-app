import { Router } from "express";
import { createApiError } from "../middleware/error-handler.js";
import { paginatedResponse, parsePagination } from "../middleware/pagination.js";
import {
  approveReport,
  createReport,
  deleteReport,
  getReport,
  listReports,
  updateReport,
  withdrawApproval,
} from "../services/report-service.js";
import { validatePeriod } from "../services/jira-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_FIELDS = new Set(["projectId", "status", "cursor", "limit"]);
const CREATE_FIELDS = new Set([
  "projectId",
  "periodStart",
  "periodEnd",
  "timezone",
  "jiraUpdates",
  "manualUpdates",
  "confirmedEmptyCategories",
]);
const CATEGORIES = new Set(["accomplishment", "blocker", "next_week"]);

export function createReportRouter({ pool, connectionService, getJiraClient }) {
  if (!pool || !connectionService || typeof getJiraClient !== "function") {
    throw new Error("Report route dependencies are required.");
  }

  const router = Router();

  router.get("/", parsePagination, async (request, response) => {
    assertAllowedQuery(request.query, LIST_FIELDS);
    const result = await listReports(pool, {
      projectId: request.query.projectId,
      status: request.query.status,
      cursor: request.pagination.cursor,
      limit: request.pagination.limit,
    });
    paginatedResponse(response, result.items, result.nextCursor);
  });

  router.post("/", async (request, response) => {
    assertCreateBody(request.body);
    validatePeriod(
      request.body.periodStart,
      request.body.periodEnd,
      request.body.timezone,
    );
    const connection = await connectionService.getState();
    if (!connection.connected) {
      throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
    }

    let jiraClient;
    try {
      jiraClient = await getJiraClient(request);
    } catch (error) {
      if (!isJiraUnavailable(error)) {
        throw error;
      }
    }

    const report = await createReport({
      pool,
      ...request.body,
      creatorAccountId: connection.account.id,
      jiraClient,
    });
    response.status(201).json(report);
  });

  router.get("/:reportId", async (request, response) => {
    assertUuid(request.params.reportId, "report");
    response.json(await getReport(pool, request.params.reportId));
  });

  router.patch("/:reportId", async (request, response) => {
    assertUuid(request.params.reportId, "report");
    assertUpdateBody(request.body);
    const actorAccountId = await requireActor(connectionService);
    const report = await updateReport(pool, {
      reportId: request.params.reportId,
      ...request.body,
      actorAccountId,
    });
    response.json(report);
  });

  router.post("/:reportId/approve", async (request, response) => {
    assertUuid(request.params.reportId, "report");
    assertConfirmBody(request.body);
    const actorAccountId = await requireActor(connectionService);
    response.json(await approveReport(pool, {
      reportId: request.params.reportId,
      actorAccountId,
    }));
  });

  router.post("/:reportId/withdraw-approval", async (request, response) => {
    assertUuid(request.params.reportId, "report");
    assertConfirmBody(request.body);
    const actorAccountId = await requireActor(connectionService);
    response.json(await withdrawApproval(pool, {
      reportId: request.params.reportId,
      actorAccountId,
    }));
  });

  router.delete("/:reportId", async (request, response) => {
    assertUuid(request.params.reportId, "report");
    assertConfirmBody(request.body);
    const actorAccountId = await requireActor(connectionService);
    response.json(await deleteReport(pool, {
      reportId: request.params.reportId,
      actorAccountId,
      confirm: request.body.confirm,
    }));
  });

  return router;
}

function assertCreateBody(body) {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !CREATE_FIELDS.has(key)) ||
    [...CREATE_FIELDS].some((key) => !Object.hasOwn(body, key))
  ) {
    throw createApiError(
      400,
      "INVALID_REQUEST",
      "Report request fields are invalid.",
    );
  }

  if (!Array.isArray(body.jiraUpdates) || !Array.isArray(body.manualUpdates)) {
    throw createApiError(400, "INVALID_REQUEST", "Report update lists are required.");
  }
  if (
    typeof body.projectId !== "string" ||
    !UUID_PATTERN.test(body.projectId) ||
    typeof body.periodStart !== "string" ||
    typeof body.periodEnd !== "string" ||
    typeof body.timezone !== "string"
  ) {
    throw createApiError(400, "INVALID_REQUEST", "Report details are invalid.");
  }
  for (const update of body.jiraUpdates) {
    if (
      !isPlainObject(update) ||
      Object.keys(update).some((key) =>
        !["issueId", "issueKey", "category"].includes(key),
      ) ||
      ["issueId", "issueKey", "category"].some((key) => !Object.hasOwn(update, key)) ||
      typeof update.issueId !== "string" ||
      update.issueId.length === 0 ||
      typeof update.issueKey !== "string" ||
      update.issueKey.length === 0 ||
      !CATEGORIES.has(update.category)
    ) {
      throw createApiError(400, "INVALID_JIRA_UPDATE", "Jira update selection is invalid.");
    }
  }
  for (const update of body.manualUpdates) {
    if (
      !isPlainObject(update) ||
      Object.keys(update).some((key) => !["category", "text", "owner"].includes(key)) ||
      !Object.hasOwn(update, "category") ||
      !Object.hasOwn(update, "text") ||
      typeof update.text !== "string" ||
      !CATEGORIES.has(update.category) ||
      (update.owner !== undefined &&
        update.owner !== null &&
        (typeof update.owner !== "string" || update.owner.trim().length > 120)) ||
      update.text.trim().length < 1 ||
      update.text.trim().length > 2000
    ) {
      throw createApiError(400, "INVALID_MANUAL_UPDATE", "Manual update is invalid.");
    }
  }
  if (
    !Array.isArray(body.confirmedEmptyCategories) ||
    body.confirmedEmptyCategories.some((category) => !CATEGORIES.has(category)) ||
    new Set(body.confirmedEmptyCategories).size !== body.confirmedEmptyCategories.length
  ) {
    throw createApiError(
      400,
      "INVALID_EMPTY_CATEGORIES",
      "Confirmed empty categories are invalid.",
    );
  }
}

function assertUpdateBody(body) {
  if (
    !isPlainObject(body) ||
    Object.keys(body).some((key) =>
      !["version", "items", "confirmedEmptyCategories"].includes(key),
    ) ||
    !["version", "items", "confirmedEmptyCategories"].every((key) =>
      Object.hasOwn(body, key),
    ) ||
    !Number.isSafeInteger(body.version) ||
    body.version < 1 ||
    !Array.isArray(body.items) ||
    !Array.isArray(body.confirmedEmptyCategories)
  ) {
    throw createApiError(400, "INVALID_REQUEST", "Report update fields are invalid.");
  }
  for (const item of body.items) {
    if (
      !isPlainObject(item) ||
      Object.keys(item).some((key) => !["id", "category", "text", "owner"].includes(key)) ||
      !Object.hasOwn(item, "id") ||
      !Object.hasOwn(item, "category") ||
      !Object.hasOwn(item, "text") ||
      !UUID_PATTERN.test(item.id) ||
      !CATEGORIES.has(item.category) ||
      typeof item.text !== "string" ||
      item.text.trim().length < 1 ||
      item.text.trim().length > 2000 ||
      (item.owner !== undefined &&
        item.owner !== null &&
        (typeof item.owner !== "string" || item.owner.trim().length > 120))
    ) {
      throw createApiError(400, "INVALID_REPORT_ITEM", "Report item is invalid.");
    }
  }
  if (
    body.confirmedEmptyCategories.some((category) => !CATEGORIES.has(category)) ||
    new Set(body.confirmedEmptyCategories).size !== body.confirmedEmptyCategories.length
  ) {
    throw createApiError(
      400,
      "INVALID_EMPTY_CATEGORIES",
      "Confirmed empty categories are invalid.",
    );
  }
}

function assertConfirmBody(body) {
  if (
    !isPlainObject(body) ||
    Object.keys(body).length !== 1 ||
    body.confirm !== true
  ) {
    throw createApiError(400, "CONFIRMATION_REQUIRED", "Explicit confirmation is required.");
  }
}

async function requireActor(connectionService) {
  const state = await connectionService.getState();
  if (!state.connected || typeof state.account?.id !== "string") {
    throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
  }
  return state.account.id;
}

function assertAllowedQuery(query, allowed) {
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) {
      throw createApiError(400, "UNKNOWN_FIELD", `Unknown query parameter: ${key}.`);
    }
    if (Array.isArray(value)) {
      throw createApiError(
        400,
        "INVALID_QUERY",
        `Query parameter ${key} must appear once.`,
      );
    }
  }
}

function assertUuid(value, entity) {
  if (!UUID_PATTERN.test(value)) {
    throw createApiError(
      400,
      `INVALID_${entity.toUpperCase()}_ID`,
      `${entity[0].toUpperCase()}${entity.slice(1)} identifier is invalid.`,
    );
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJiraUnavailable(error) {
  return [
    "NOT_CONNECTED",
    "REAUTH_REQUIRED",
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_TIMEOUT",
    "UPSTREAM_RATE_LIMITED",
    "UPSTREAM_AUTHORIZATION_FAILED",
  ].includes(error?.code);
}
