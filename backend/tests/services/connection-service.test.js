import assert from "node:assert/strict";
import test from "node:test";
import { createTokenEncryption } from "../../src/db/token-encryption.js";
import { createConnectionService } from "../../src/services/connection-service.js";

const key = Buffer.alloc(32, 11).toString("base64url");
const env = {
  ATLASSIAN_CLIENT_ID: "client",
  ATLASSIAN_CLIENT_SECRET: "client-secret",
  ATLASSIAN_REDIRECT_URI: "http://127.0.0.1:3001/callback",
  ATLASSIAN_SCOPES: "read:jira-work offline_access",
  TOKEN_ENCRYPTION_KEY: key,
  TOKEN_ENCRYPTION_KEY_ID: "test-key",
};

function connectionClient({ accountId = "account-1", expiresAt } = {}) {
  const encryption = createTokenEncryption(key, "test-key");
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("SELECT account_id")) {
        return { rowCount: 1, rows: [{ account_id: accountId }] };
      }
      if (sql.includes("SELECT cloud_id")) {
        return {
          rowCount: 1,
          rows: [{
            cloud_id: "cloud-id",
            site_url: "https://example.atlassian.net",
            access_token_ciphertext: encryption.encrypt("old-access"),
            refresh_token_ciphertext: encryption.encrypt("old-refresh"),
            expires_at: expiresAt,
            scopes: ["read:jira-work", "offline_access"],
          }],
        };
      }
      if (sql.includes("SELECT refresh_token_ciphertext")) {
        return {
          rowCount: 1,
          rows: [{
            refresh_token_ciphertext: encryption.encrypt("old-refresh"),
            encryption_key_reference: "test-key",
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  return { client, queries };
}

test("connection state exposes account and expiry but no token data", async () => {
  const pool = {
    async query() {
      return {
        rowCount: 1,
        rows: [{
          account_id: "account-1",
          account_display_name: "Weekly Reporter",
          scopes: ["read:jira-work"],
          expires_at: "2026-10-18T20:00:00.000Z",
        }],
      };
    },
  };
  const service = createConnectionService({ pool, env });
  const state = await service.getState();

  assert.deepEqual(state, {
    connected: true,
    account: { id: "account-1", displayName: "Weekly Reporter" },
    capabilities: ["read:jira-work"],
    expiresAt: "2026-10-18T20:00:00.000Z",
  });
  assert.equal(JSON.stringify(state).includes("token"), false);
});

test("connection tokens are encrypted before persistent storage", async () => {
  const { client, queries } = connectionClient();
  const pool = {
    connect: async () => client,
  };
  const service = createConnectionService({ pool, env });
  await service.storeTokens({
    site: { cloudId: "cloud-id", url: "https://example.atlassian.net", name: "Example" },
    identity: { accountId: "account-2", displayName: "Reporter" },
    tokens: {
      accessToken: "private-access",
      refreshToken: "private-refresh",
      expiresIn: 3600,
      scopes: ["read:jira-work", "offline_access"],
    },
    confirmAccountSwitch: true,
  });

  const insert = queries.find(({ sql }) => sql.includes("INSERT INTO integration_connections"));
  assert.ok(insert);
  assert.equal(insert.values[3], "https://example.atlassian.net");
  assert.notEqual(insert.values[4], "private-access");
  assert.notEqual(insert.values[5], "private-refresh");
  assert.equal(insert.values[6], "test-key");
  assert.equal(queries.at(-1).sql, "COMMIT");
});

test("access tokens refresh under a database row lock and rotate atomically", async () => {
  const { client, queries } = connectionClient({
    expiresAt: "2026-10-18T19:00:00.000Z",
  });
  const pool = { connect: async () => client };
  const fetchImpl = async (_url, options) => {
    assert.equal(JSON.parse(options.body).refresh_token, "old-refresh");
    return new Response(JSON.stringify({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
      scope: "read:jira-work offline_access",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const service = createConnectionService({
    pool,
    env,
    fetchImpl,
    now: () => new Date("2026-10-18T19:30:00.000Z"),
  });

  const result = await service.getAccessToken();
  assert.deepEqual(result, {
    cloudId: "cloud-id",
    siteUrl: "https://example.atlassian.net",
    accessToken: "new-access",
  });
  assert.ok(queries.some(({ sql }) => sql.includes("FOR UPDATE")));
  assert.ok(queries.some(({ sql, values }) =>
    sql.includes("UPDATE integration_connections") &&
    values[0] !== "new-access" &&
    values[1] !== "new-refresh",
  ));
  assert.equal(queries.at(-1).sql, "COMMIT");
});

test("access token request without a connection is NOT_CONNECTED even when OAuth is unconfigured", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const service = createConnectionService({
    pool: { connect: async () => client },
    env: { ATLASSIAN_CLIENT_ID: "", ATLASSIAN_CLIENT_SECRET: "" },
  });

  await assert.rejects(service.getAccessToken(), {
    status: 401,
    code: "NOT_CONNECTED",
  });
  assert.equal(queries.at(-1), "ROLLBACK");
});

test("access token request with a connection but unconfigured OAuth is ATLASSIAN_NOT_CONFIGURED", async () => {
  const { client, queries } = connectionClient({
    expiresAt: "2026-10-18T19:00:00.000Z",
  });
  const service = createConnectionService({
    pool: { connect: async () => client },
    env: { ...env, ATLASSIAN_CLIENT_ID: "" },
  });

  await assert.rejects(service.getAccessToken(), {
    status: 503,
    code: "ATLASSIAN_NOT_CONFIGURED",
  });
  assert.equal(queries.at(-1).sql, "ROLLBACK");
});

test("failed refresh removes only the connection and requires reauthorization", async () => {
  const { client, queries } = connectionClient({
    expiresAt: "2026-10-18T19:00:00.000Z",
  });
  const service = createConnectionService({
    pool: { connect: async () => client },
    env,
    fetchImpl: async () => new Response("denied", { status: 400 }),
    now: () => new Date("2026-10-18T19:30:00.000Z"),
  });

  await assert.rejects(service.getAccessToken(), {
    status: 401,
    code: "REAUTH_REQUIRED",
  });
  assert.ok(queries.some(({ sql }) =>
    sql.includes("DELETE FROM integration_connections"),
  ));
  assert.equal(queries.at(-1).sql, "COMMIT");
});

test("disconnect removes local connection when provider revocation is unconfirmed", async () => {
  const { client, queries } = connectionClient();
  const service = createConnectionService({
    pool: { connect: async () => client },
    env,
    fetchImpl: async () => new Response("denied", { status: 503 }),
  });

  assert.deepEqual(await service.disconnect(), {
    connected: false,
    providerRevoked: false,
  });
  assert.ok(queries.some(({ sql }) =>
    sql.includes("DELETE FROM integration_connections"),
  ));
  assert.equal(queries.at(-1).sql, "COMMIT");
});
