import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  OAuthStateStore,
  refreshAtlassianTokens,
} from "../../src/integrations/atlassian-oauth.js";
import { createTokenEncryption } from "../../src/db/token-encryption.js";

const encryptionKey = Buffer.alloc(32, 7).toString("base64url");

test("token encryption authenticates ciphertext and uses unique nonces", () => {
  const encryption = createTokenEncryption(encryptionKey, "local-env-v1");
  const encrypted = encryption.encrypt("private-access-token");
  const secondEncryption = encryption.encrypt("private-access-token");

  assert.equal(encryption.keyReference, "local-env-v1");
  assert.notEqual(encrypted, secondEncryption);
  assert.equal(encryption.decrypt(encrypted), "private-access-token");

  const parts = encrypted.split(".");
  parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
  assert.throws(() => encryption.decrypt(parts.join(".")));
});

test("token encryption rejects malformed keys and ciphertext", () => {
  assert.throws(() => createTokenEncryption("short", "key-1"));
  const encryption = createTokenEncryption(encryptionKey, "key-1");
  assert.throws(() => encryption.decrypt("invalid"));
});

test("OAuth state is random, browser-bound, single-use, and expires", () => {
  const store = new OAuthStateStore();
  const issued = store.issue("s".repeat(32), 1_000);

  assert.equal(issued.state.length, 43);
  assert.equal(store.consume(issued.state, "x".repeat(32), 1_001), false);
  assert.equal(store.consume(issued.state, "s".repeat(32), 1_002), false);

  const second = store.issue("s".repeat(32), 1_000);
  assert.equal(store.consume(second.state, "s".repeat(32), 1_000 + 600_000), false);
});

test("authorization URL uses configured scopes and loopback callback", () => {
  const authorizationUrl = new URL(createAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://127.0.0.1:3001/api/v1/integrations/atlassian/oauth/callback",
    scopes: ["read:jira-work", "read:confluence-space.summary"],
    state: "s".repeat(43),
  }));

  assert.equal(authorizationUrl.origin, "https://auth.atlassian.com");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("scope"), "read:jira-work read:confluence-space.summary");
  assert.throws(() => createAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "https://example.com/callback",
    scopes: ["scope"],
    state: "s".repeat(43),
  }));
});

test("OAuth token exchange and refresh return credentials without logging them", async () => {
  const payload = {
    access_token: "access-secret",
    refresh_token: "refresh-secret",
    expires_in: 3600,
    scope: "read:jira-work offline_access",
  };
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const tokens = await exchangeAuthorizationCode({
    clientId: "client",
    clientSecret: "secret",
    redirectUri: "http://localhost:3001/callback",
    code: "authorization-code",
    fetchImpl,
  });
  assert.equal(requestBody.code, "authorization-code");
  assert.equal(tokens.accessToken, "access-secret");
  assert.deepEqual(tokens.scopes, ["read:jira-work", "offline_access"]);

  const refreshed = await refreshAtlassianTokens({
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "old-refresh",
    fetchImpl,
  });
  assert.equal(requestBody.refresh_token, "old-refresh");
  assert.equal(refreshed.refreshToken, "refresh-secret");
});

test("OAuth provider failures have non-sensitive errors", async () => {
  await assert.rejects(
    exchangeAuthorizationCode({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:3001/callback",
      code: "secret-code",
      fetchImpl: async () => new Response("provider token=secret", { status: 400 }),
    }),
    { message: "Atlassian authorization could not be completed." },
  );
});
