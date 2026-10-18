import { Router } from "express";
import { createAtlassianRouter } from "./atlassian-routes.js";
import { createConfluenceClient } from "../integrations/confluence-client.js";
import { createJiraClient } from "../integrations/jira-client.js";
import { createConfluenceRouter } from "./confluence-routes.js";
import { createJiraRouter } from "./jira-routes.js";
import { createPublicationRouter } from "./publication-routes.js";
import { createReportRouter } from "./report-routes.js";
import { createConnectionService } from "../services/connection-service.js";

export function createApiRouter({ pool, env = process.env, fetchImpl = fetch }) {
  const router = Router();
  const connectionService = createConnectionService({ pool, env, fetchImpl });

  router.use(
    "/integrations/atlassian",
    createAtlassianRouter({ service: connectionService, env, fetchImpl }),
  );
  const getJiraClient = async () => {
    const credentials = await connectionService.getAccessToken();
    return createJiraClient({ ...credentials, fetchImpl });
  };
  router.use("/jira", createJiraRouter({ pool, getJiraClient }));
  const getConfluenceClient = async () => {
    const credentials = await connectionService.getAccessToken();
    return createConfluenceClient({ ...credentials, fetchImpl });
  };
  router.use(
    "/reports",
    createReportRouter({ pool, connectionService, getJiraClient }),
  );
  router.use(
    "/confluence",
    createConfluenceRouter({
      getConfluenceClient,
    }),
  );
  router.use(
    "/reports",
    createPublicationRouter({ pool, connectionService, getConfluenceClient }),
  );

  return router;
}
