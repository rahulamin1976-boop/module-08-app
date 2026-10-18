export function loadConfig(env = process.env) {
  const rawPort = env.PORT;

  if (rawPort === undefined || rawPort.trim() === "") {
    throw new Error(
      "PORT is required. Copy backend/.env.example to backend/.env or set PORT in the environment.",
    );
  }

  if (!/^\d+$/.test(rawPort)) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const port = Number(rawPort);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const databaseUrl = env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    throw new Error(
      "DATABASE_URL is required. Copy backend/.env.example to backend/.env and configure the local database URL.",
    );
  }

  let parsedDatabaseUrl;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid local PostgreSQL connection URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsedDatabaseUrl.hostname) ||
    !parsedDatabaseUrl.username ||
    !parsedDatabaseUrl.password ||
    parsedDatabaseUrl.pathname.length < 2
  ) {
    throw new Error("DATABASE_URL must be a valid local PostgreSQL connection URL.");
  }

  return Object.freeze({ port, databaseUrl });
}
