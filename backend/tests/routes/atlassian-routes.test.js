import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Router } from "express";
import { createApp } from "../../src/server.js";
import { createAtlassianRouter } from "../../src/routes/atlassian-routes.js";

const encryptionKey = Buffer.alloc(32, 17).toString("base64url");
const env = {
  ATLASSIAN_CLIENT_ID: "client-id",
  ATLASSIAN_CLIENT_SECRET: "client-secret",
  ATLASSIAN_REDIRECT_URI:
    "http://127.0.0.1:3001/api/v1/integrations/atlassian/oauth/callback",
  ATLASSIAN_SCOPES: "read:jira-work read:jira-user offline_access",
  TOKEN_ENCRYPTION_KEY: encryptionKey,
  TOKEN_ENCRYPTION_KEY_ID: "test-key",
  ATLASSIAN_UI_ORIGIN: "http://127.0.0.1:5173",
};

async function startTestServer(t, router) {
  const apiRouter = Router();
  apiRouter.use("/integrations/atlassian", router);
  const server = createApp({ apiRouter }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
  };
}

test("OAuth routes bind a one-time state to the browser cookie and store protected tokens", async (t) => {
  let storedConnection;
  let providerCall = 0;
  const service = {
    async getState() {
      return { connected: false };
    },
    async storeTokens(connection) {
      storedConnection = connection;
    },
    async disconnect() {
      return { connected: false, providerRevoked: true };
    },
  };
  const router = createAtlassianRouter({
    service,
    env,
    fetchImpl: async (url) => {
      providerCall += 1;
      if (String(url).includes("accessible-resources")) {
        return new Response(JSON.stringify([{
          id: "cloud-id",
          url: "https://example.atlassian.net",
          name: "Example site",
        }]), { status: 200 });
      }
      if (String(url).includes("/oauth/token")) {
        return new Response(JSON.stringify({
          access_token: "provider-access-token",
          refresh_token: "provider-refresh-token",
          expires_in: 3600,
          scope: "read:jira-work read:jira-user offline_access",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        accountId: "account-id",
        displayName: "Weekly Reporter",
      }), { status: 200 });
    },
  });
  const { origin } = await startTestServer(t, router);

  const start = await fetch(`${origin}/api/v1/integrations/atlassian/oauth/start`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(start.status, 200);
  const { authorizationUrl } = await start.json();
  const state = new URL(authorizationUrl).searchParams.get("state");
  const cookie = start.headers.get("set-cookie").split(";")[0];
  assert.ok(state);
  assert.match(start.headers.get("set-cookie"), /HttpOnly/);
  assert.match(start.headers.get("set-cookie"), /SameSite=Lax/);

  const callback = await fetch(
    `${origin}/api/v1/integrations/atlassian/oauth/callback?code=private-code&state=${state}`,
    { headers: { Cookie: cookie }, redirect: "manual" },
  );
  assert.equal(callback.status, 303);
  const location = new URL(callback.headers.get("location"));
  assert.equal(location.origin, "http://127.0.0.1:5173");
  assert.equal(location.pathname, "/connection");
  assert.equal(location.searchParams.get("oauth"), "connected");
  assert.equal(location.searchParams.has("code"), false);
  assert.equal(providerCall, 3);
  assert.deepEqual(storedConnection.identity, {
    accountId: "account-id",
    displayName: "Weekly Reporter",
  });
  assert.equal(storedConnection.site.cloudId, "cloud-id");
  assert.equal(storedConnection.tokens.accessToken, "provider-access-token");
});

test("OAuth state mismatch is rejected and account replacement requires confirmation", async (t) => {
  const service = {
    async getState() {
      return { connected: true, account: { id: "existing", displayName: "Reporter" } };
    },
    async disconnect() {
      return { connected: false, providerRevoked: false };
    },
  };
  const { origin } = await startTestServer(
    t,
    createAtlassianRouter({ service, env }),
  );

  const unconfirmed = await fetch(`${origin}/api/v1/integrations/atlassian/oauth/start`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(unconfirmed.status, 409);
  assert.equal(
    (await unconfirmed.json()).error.code,
    "ACCOUNT_SWITCH_CONFIRMATION_REQUIRED",
  );

  const started = await fetch(`${origin}/api/v1/integrations/atlassian/oauth/start`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ confirmAccountSwitch: true }),
  });
  assert.equal(started.status, 200);
  const { authorizationUrl } = await started.json();
  const state = new URL(authorizationUrl).searchParams.get("state");
  const cookie = started.headers.get("set-cookie").split(";")[0];
  const callback = await fetch(
    `${origin}/api/v1/integrations/atlassian/oauth/callback?code=private-code&state=wrong`,
    { headers: { Cookie: cookie }, redirect: "manual" },
  );
  assert.equal(callback.status, 303);
  assert.equal(
    new URL(callback.headers.get("location")).searchParams.get("oauth"),
    "invalid_state",
  );
  assert.ok(state);
});

test("OAuth configuration errors are explicit and non-sensitive", async (t) => {
  const service = {
    async getState() {
      return { connected: false };
    },
  };
  const { origin } = await startTestServer(
    t,
    createAtlassianRouter({ service, env: {} }),
  );
  const response = await fetch(`${origin}/api/v1/integrations/atlassian/oauth/start`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "ATLASSIAN_NOT_CONFIGURED",
      message: "Atlassian OAuth is not configured on this local installation.",
    },
  });
});
