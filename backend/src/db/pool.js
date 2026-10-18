import pg from "pg";
import { loadConfig } from "../config.js";

const { Pool } = pg;

export function createPool(config = loadConfig()) {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
}
