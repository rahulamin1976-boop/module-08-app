import { Router } from "express";
import { createApiError } from "../middleware/error-handler.js";
import { paginatedResponse, parsePagination } from "../middleware/pagination.js";
import {
  searchParentPages,
  searchSpaces,
} from "../services/confluence-destination-service.js";

const SPACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

export function createConfluenceRouter({ getConfluenceClient }) {
  if (typeof getConfluenceClient !== "function") {
    throw new Error("Confluence client factory is required.");
  }

  const router = Router();

  router.get("/spaces", parsePagination, async (request, response) => {
    assertAllowedQuery(request.query, ["query", "cursor", "limit"]);
    const result = await searchSpaces({
      confluenceClient: await getConfluenceClient(request),
      query: request.query.query,
      cursor: request.pagination.cursor,
      limit: request.pagination.limit,
    });
    paginatedResponse(response, result.items, result.nextCursor);
  });

  router.get("/spaces/:spaceId/pages", parsePagination, async (request, response) => {
    if (!SPACE_ID_PATTERN.test(request.params.spaceId)) {
      throw createApiError(400, "INVALID_SPACE_ID", "Confluence space identifier is invalid.");
    }
    assertAllowedQuery(request.query, ["query", "parentId", "cursor", "limit"]);
    const result = await searchParentPages({
      confluenceClient: await getConfluenceClient(request),
      spaceId: request.params.spaceId,
      parentId: request.query.parentId,
      query: request.query.query,
      cursor: request.pagination.cursor,
      limit: request.pagination.limit,
    });
    paginatedResponse(response, result.items, result.nextCursor);
  });

  return router;
}

function assertAllowedQuery(query, allowed) {
  const unknown = Object.keys(query).find((key) => !allowed.includes(key));
  if (unknown) {
    throw createApiError(400, "UNKNOWN_FIELD", `Unknown query parameter: ${unknown}.`);
  }
  if (Object.values(query).some(Array.isArray)) {
    throw createApiError(400, "INVALID_QUERY", "Search parameters must appear once.");
  }
}
