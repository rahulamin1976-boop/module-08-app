import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const localDatabaseUrl =
  "postgresql://weekly_status:local_only_weekly_status@127.0.0.1:5432/weekly_status";

test("loadConfig requires PORT", () => {
  assert.throws(() => loadConfig({}), {
    message:
      "PORT is required. Copy backend/.env.example to backend/.env or set PORT in the environment.",
  });
});

test("loadConfig parses a valid port", () => {
  assert.deepEqual(
    loadConfig({ PORT: "3001", DATABASE_URL: localDatabaseUrl }),
    { port: 3001, databaseUrl: localDatabaseUrl },
  );
});

test("loadConfig rejects invalid ports", () => {
  for (const PORT of ["0", "65536", "3.5", "abc"]) {
    assert.throws(() => loadConfig({ PORT }), {
      message: "PORT must be an integer between 1 and 65535.",
    });
  }
});

test("loadConfig requires a local PostgreSQL URL", () => {
  assert.throws(() => loadConfig({ PORT: "3001" }), {
    message:
      "DATABASE_URL is required. Copy backend/.env.example to backend/.env and configure the local database URL.",
  });

  for (const DATABASE_URL of [
    "not-a-url",
    "https://example.com/database",
    "postgresql://user:password@example.com/database",
    "postgresql://user@127.0.0.1/database",
  ]) {
    assert.throws(() => loadConfig({ PORT: "3001", DATABASE_URL }), {
      message: "DATABASE_URL must be a valid local PostgreSQL connection URL.",
    });
  }
});
