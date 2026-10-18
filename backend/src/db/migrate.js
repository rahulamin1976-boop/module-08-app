import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const MIGRATIONS_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const MIGRATION_LOCK_ID = 81467325015304;

export async function runMigrations(pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID}::bigint)`,
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const names = (await readdir(MIGRATIONS_DIRECTORY))
      .filter((name) => /^\d{3}-[a-z0-9-]+\.sql$/.test(name))
      .sort();
    const appliedResult = await client.query(
      "SELECT name, checksum FROM schema_migrations",
    );
    const applied = new Map(
      appliedResult.rows.map(({ name, checksum }) => [name, checksum]),
    );

    for (const name of names) {
      const sql = await readFile(join(MIGRATIONS_DIRECTORY, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existingChecksum = applied.get(name);

      if (existingChecksum !== undefined) {
        if (existingChecksum !== checksum) {
          throw new Error(`Applied migration was modified: ${name}`);
        }
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = createPool();

  try {
    await runMigrations(pool);
    console.log("Database migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
