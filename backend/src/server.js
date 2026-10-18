import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import { loadConfig } from "./config.js";
import { createApiError, errorHandler } from "./middleware/error-handler.js";
import { localOrigin } from "./middleware/local-origin.js";
import { createPool } from "./db/pool.js";
import { createApiRouter } from "./routes/api-routes.js";

export function createApp({ apiRouter } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(localOrigin);
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  if (apiRouter) {
    app.use("/api/v1", apiRouter);
  }

  app.use((_request, _response, next) => {
    next(createApiError(404, "NOT_FOUND", "Route not found."));
  });
  app.use(errorHandler);
  return app;
}

export function startServer(config = loadConfig(), dependencies = {}) {
  const pool = dependencies.pool ??
    (config.databaseUrl ? createPool(config) : undefined);
  const app = createApp({
    apiRouter: pool ? createApiRouter({ pool }) : undefined,
  });
  const server = app.listen(config.port, "127.0.0.1");

  server.on("listening", () => {
    const address = server.address();
    if (address && typeof address !== "string") {
      console.log(`Backend listening on http://127.0.0.1:${address.port}`);
    }
  });

  server.on("error", (error) => {
    console.error(`Backend server failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  server.on("close", () => {
    if (pool && !dependencies.pool) {
      pool.end().catch((error) => {
        console.error(`Backend database pool failed to close: ${error.name}`);
      });
    }
  });

  return server;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  startServer();
}
