import { Router } from "express";
import { createApiError } from "../middleware/error-handler.js";
import { parsePagination, paginatedResponse } from "../middleware/pagination.js";
import {
  searchIssueCandidates,
  searchProjects,
  validatePeriod,
} from "../services/jira-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createJiraRouter({ pool, getJiraClient }) {
  if (!pool || typeof getJiraClient !== "function") {
    throw new Error("Jira route dependencies are required.");
  }

  const router = Router();

  router.get("/projects", parsePagination, async (request, response) => {
    const query = validateSearchQuery(request.query);
    const result = await searchProjects({
      pool,
      jiraClient: await getJiraClient(request),
      query,
      cursor: request.pagination.cursor,
      limit: request.pagination.limit,
    });
    paginatedResponse(response, result.items, result.nextCursor);
  });

  router.get(
    "/projects/:projectId/updates",
    parsePagination,
    async (request, response) => {
      if (!UUID_PATTERN.test(request.params.projectId)) {
        throw createApiError(400, "INVALID_PROJECT_ID", "Project identifier is invalid.");
      }
      assertAllowedQueryFields(request.query, [
        "from",
        "to",
        "timezone",
        "cursor",
        "limit",
      ]);
      validatePeriod(
        request.query.from,
        request.query.to,
        request.query.timezone,
      );
      const result = await searchIssueCandidates({
        pool,
        jiraClient: await getJiraClient(request),
        projectId: request.params.projectId,
        from: request.query.from,
        to: request.query.to,
        timezone: request.query.timezone,
        cursor: request.pagination.cursor,
        limit: request.pagination.limit,
      });
      paginatedResponse(response, result.items, result.nextCursor);
    },
  );

  return router;
}

function validateSearchQuery(query) {
  assertAllowedQueryFields(query, ["query", "cursor", "limit"]);
  if (query.query === undefined) return "";
  if (typeof query.query !== "string" || query.query.trim().length < 1 || query.query.trim().length > 100) {
    throw createApiError(400, "INVALID_QUERY", "Search query must contain 1 to 100 characters.");
  }
  return query.query.trim();
}

function assertAllowedQueryFields(query, allowed) {
  const unknown = Object.keys(query).find((key) => !allowed.includes(key));
  if (unknown) {
    throw createApiError(400, "UNKNOWN_FIELD", `Unknown query parameter: ${unknown}.`);
  }
  for (const key of allowed) {
    const value = query[key];
    if (Array.isArray(value)) {
      throw createApiError(400, "INVALID_QUERY", `Query parameter ${key} must appear once.`);
    }
  }
}
