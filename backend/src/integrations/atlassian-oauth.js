import { randomBytes } from "node:crypto";
import { requestAtlassianJson } from "./atlassian-http.js";

const AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const STATE_TTL_MS = 10 * 60 * 1000;

export function loadAtlassianOAuthConfig(env = process.env) {
  const values = {
    clientId: env.ATLASSIAN_CLIENT_ID,
    clientSecret: env.ATLASSIAN_CLIENT_SECRET,
    redirectUri: env.ATLASSIAN_REDIRECT_URI,
    scopes: env.ATLASSIAN_SCOPES?.split(/\s+/).filter(Boolean),
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    encryptionKeyId: env.TOKEN_ENCRYPTION_KEY_ID,
    uiOrigin: env.ATLASSIAN_UI_ORIGIN ?? "http://127.0.0.1:5173",
  };
  const required = [
    values.clientId,
    values.clientSecret,
    values.redirectUri,
    values.encryptionKey,
    values.encryptionKeyId,
  ];
  if (
    required.some((value) => typeof value !== "string" || value.trim() === "") ||
    values.clientId.startsWith("replace_") ||
    values.clientSecret.startsWith("replace_") ||
    values.encryptionKey.startsWith("replace_") ||
    !values.scopes ||
    values.scopes.length === 0 ||
    !values.scopes.includes("offline_access") ||
    values.scopes?.some((scope) => scope.startsWith("replace_")) ||
    !isLoopbackRedirect(values.uiOrigin)
  ) {
    throw new Error("Atlassian OAuth is not configured.");
  }
  return Object.freeze(values);
}

export class OAuthStateStore {
  #states = new Map();

  issue(sessionId, now = Date.now(), metadata = {}) {
    if (typeof sessionId !== "string" || sessionId.length < 32) {
      throw new Error("A valid browser session is required.");
    }

    this.#removeExpired(now);
    const state = randomBytes(32).toString("base64url");
    const expiresAt = now + STATE_TTL_MS;
    this.#states.set(state, { sessionId, expiresAt, metadata });
    return Object.freeze({ state, expiresAt });
  }

  consume(state, sessionId, now = Date.now()) {
    return this.consumeRecord(state, sessionId, now) !== null;
  }

  consumeRecord(state, sessionId, now = Date.now()) {
    const record = this.#states.get(state);
    this.#states.delete(state);
    if (
      !record ||
      now >= record.expiresAt ||
      typeof sessionId !== "string" ||
      record.sessionId !== sessionId
    ) {
      return null;
    }
    return Object.freeze({ ...record });
  }

  #removeExpired(now) {
    for (const [state, record] of this.#states) {
      if (now >= record.expiresAt) {
        this.#states.delete(state);
      }
    }
  }
}

export function createAuthorizationUrl({
  clientId,
  redirectUri,
  scopes,
  state,
}) {
  if (
    !clientId ||
    !isLoopbackRedirect(redirectUri) ||
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    scopes.some((scope) => typeof scope !== "string" || scope.trim() === "") ||
    typeof state !== "string" ||
    state.length < 32
  ) {
    throw new Error("Atlassian OAuth configuration is invalid.");
  }

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: scopes.join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  }).toString();
  return url.toString();
}

export async function exchangeAuthorizationCode({
  clientId,
  clientSecret,
  redirectUri,
  code,
  fetchImpl = fetch,
}) {
  if (
    !clientId ||
    !clientSecret ||
    !isLoopbackRedirect(redirectUri) ||
    typeof code !== "string" ||
    code.length === 0
  ) {
    throw new Error("Atlassian OAuth configuration or callback is invalid.");
  }

  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return parseTokenResponse(response);
}

export async function refreshAtlassianTokens({
  clientId,
  clientSecret,
  refreshToken,
  fetchImpl = fetch,
}) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Atlassian refresh configuration is invalid.");
  }

  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return parseTokenResponse(response);
}

export async function getAccessibleResources(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error("Atlassian site access could not be verified.");
  }
  let resources;
  try {
    resources = await response.json();
  } catch {
    throw new Error("Atlassian returned an invalid site response.");
  }
  if (!Array.isArray(resources) || resources.length !== 1) {
    const error = new Error("Exactly one accessible Atlassian Cloud site is required.");
    error.code = "SITE_SELECTION_REQUIRED";
    throw error;
  }
  const [resource] = resources;
  if (
    typeof resource.id !== "string" ||
    typeof resource.url !== "string" ||
    typeof resource.name !== "string"
  ) {
    throw new Error("Atlassian returned an invalid site response.");
  }
  const siteUrl = new URL(resource.url);
  if (siteUrl.protocol !== "https:") {
    throw new Error("Atlassian returned an invalid site response.");
  }
  return Object.freeze({
    cloudId: resource.id,
    url: resource.url,
    name: resource.name,
  });
}

export async function getAtlassianIdentity({
  cloudId,
  accessToken,
  fetchImpl = fetch,
}) {
  const baseUrl = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
  const identity = await requestAtlassianJson(`${baseUrl}/myself`, {
    accessToken,
    fetchImpl,
  });
  if (
    typeof identity.accountId !== "string" ||
    typeof identity.displayName !== "string"
  ) {
    throw new Error("Atlassian account identity could not be verified.");
  }
  return Object.freeze({
    accountId: identity.accountId,
    displayName: identity.displayName,
  });
}

export async function revokeAtlassianToken({
  clientId,
  clientSecret,
  token,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl("https://auth.atlassian.com/oauth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, token }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok;
}

async function parseTokenResponse(response) {
  if (!response.ok) {
    throw new Error("Atlassian authorization could not be completed.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Atlassian returned an invalid authorization response.");
  }

  if (
    typeof payload.access_token !== "string" ||
    payload.access_token.length === 0 ||
    typeof payload.refresh_token !== "string" ||
    payload.refresh_token.length === 0 ||
    !Number.isSafeInteger(payload.expires_in) ||
    payload.expires_in <= 0
  ) {
    throw new Error("Atlassian returned an incomplete authorization response.");
  }

  return Object.freeze({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    scopes:
      typeof payload.scope === "string"
        ? payload.scope.split(/\s+/).filter(Boolean)
        : [],
  });
}

function isLoopbackRedirect(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
