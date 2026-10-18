import { Router } from "express";
import { createApiError } from "../middleware/error-handler.js";
import { publishReport } from "../services/publication-service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createPublicationRouter({
  pool,
  connectionService,
  getConfluenceClient,
}) {
  if (!pool || !connectionService || typeof getConfluenceClient !== "function") {
    throw new Error("Publication route dependencies are required.");
  }

  const router = Router();
  router.post("/:reportId/publish", async (request, response) => {
    if (!UUID_PATTERN.test(request.params.reportId)) {
      throw createApiError(400, "INVALID_REPORT_ID", "Report identifier is invalid.");
    }
    const body = validatePublishBody(request.body);
    const connection = await connectionService.getState();
    if (!connection.connected || typeof connection.account?.id !== "string") {
      throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
    }
    const report = await publishReport({
      pool,
      reportId: request.params.reportId,
      ...body,
      actorAccountId: connection.account.id,
      confluenceClient: await getConfluenceClient(request),
    });
    response.json(report);
  });

  return router;
}

function validatePublishBody(body) {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) =>
      !["spaceId", "parentPageId", "titleSuffix"].includes(key),
    ) ||
    !Object.hasOwn(body, "spaceId") ||
    !Object.hasOwn(body, "parentPageId") ||
    typeof body.spaceId !== "string" ||
    typeof body.parentPageId !== "string" ||
    (body.titleSuffix !== undefined &&
      (typeof body.titleSuffix !== "string" ||
        body.titleSuffix.trim().length < 1 ||
        body.titleSuffix.trim().length > 150))
  ) {
    throw createApiError(400, "INVALID_PUBLICATION_REQUEST", "Publication request fields are invalid.");
  }
  return {
    spaceId: body.spaceId,
    parentPageId: body.parentPageId,
    ...(body.titleSuffix === undefined ? {} : { titleSuffix: body.titleSuffix.trim() }),
  };
}
