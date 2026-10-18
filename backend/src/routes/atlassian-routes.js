import { randomBytes } from "node:crypto";
import { Router } from "express";
import { createTokenEncryption } from "../db/token-encryption.js";
import {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  getAccessibleResources,
  getAtlassianIdentity,
  loadAtlassianOAuthConfig,
  OAuthStateStore,
} from "../integrations/atlassian-oauth.js";
import { createApiError } from "../middleware/error-handler.js";

const SESSION_COOKIE = "weekly_status_oauth_session";
const SESSION_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createAtlassianRouter({
  service,
  stateStore = new OAuthStateStore(),
  env = process.env,
  fetchImpl = fetch,
}) {
  if (!service) {
    throw new Error("Atlassian connection service is required.");
  }

  const router = Router();

  router.get("/", async (_request, response) => {
    response.json(await service.getState());
  });

  router.post("/oauth/start", async (request, response) => {
    const body = request.body ?? {};
    assertStartBody(body);

    const current = await service.getState();
    const confirmAccountSwitch = body.confirmAccountSwitch === true;
    if (current.connected && !confirmAccountSwitch) {
      throw createApiError(
        409,
        "ACCOUNT_SWITCH_CONFIRMATION_REQUIRED",
        "Confirm before replacing the connected Atlassian account.",
      );
    }

    let config;
    try {
      config = loadAtlassianOAuthConfig(env);
      createTokenEncryption(config.encryptionKey, config.encryptionKeyId);
    } catch {
      throw createApiError(
        503,
        "ATLASSIAN_NOT_CONFIGURED",
        "Atlassian OAuth is not configured on this local installation.",
      );
    }

    const sessionId = getOrCreateSessionId(request);
    const { state } = stateStore.issue(sessionId, Date.now(), {
      confirmAccountSwitch,
    });
    const authorizationUrl = createAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      state,
    });

    response.setHeader("Set-Cookie", sessionCookie(sessionId));
    response.json({ authorizationUrl });
  });

  router.get("/oauth/callback", async (request, response) => {
    const sessionId = readSessionId(request);
    const state = singleQueryValue(request.query.state);
    const record = stateStore.consumeRecord(state, sessionId);
    response.setHeader("Set-Cookie", expiredSessionCookie());

    if (!record) {
      redirectToConnection(response, "invalid_state", env);
      return;
    }
    if (request.query.error !== undefined) {
      redirectToConnection(response, "authorization_denied", env);
      return;
    }

    const code = singleQueryValue(request.query.code);
    if (!code) {
      redirectToConnection(response, "authorization_failed", env);
      return;
    }

    try {
      const config = loadAtlassianOAuthConfig(env);
      createTokenEncryption(config.encryptionKey, config.encryptionKeyId);
      const tokens = await exchangeAuthorizationCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        code,
        fetchImpl,
      });
      const site = await getAccessibleResources(tokens.accessToken, fetchImpl);
      const identity = await getAtlassianIdentity({
        cloudId: site.cloudId,
        accessToken: tokens.accessToken,
        fetchImpl,
      });
      await service.storeTokens({
        site,
        identity,
        tokens,
        confirmAccountSwitch: record.metadata.confirmAccountSwitch,
      });
      redirectToConnection(response, "connected", env);
    } catch (error) {
      if (error.code === "ACCOUNT_SWITCH_CONFIRMATION_REQUIRED") {
        redirectToConnection(response, "account_switch_confirmation_required", env);
      } else if (error.code === "SITE_SELECTION_REQUIRED") {
        redirectToConnection(response, "site_selection_required", env);
      } else {
        redirectToConnection(response, "authorization_failed", env);
      }
    }
  });

  router.delete("/", async (_request, response) => {
    response.json(await service.disconnect());
  });

  return router;
}

function assertStartBody(body) {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "confirmAccountSwitch") ||
    (body.confirmAccountSwitch !== undefined &&
      typeof body.confirmAccountSwitch !== "boolean")
  ) {
    throw createApiError(400, "INVALID_REQUEST", "OAuth request is invalid.");
  }
}

function singleQueryValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getOrCreateSessionId(request) {
  const existing = readSessionId(request);
  return existing ?? randomBytes(32).toString("base64url");
}

function readSessionId(request) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) =>
    cookie.startsWith(`${SESSION_COOKIE}=`),
  );
  const value = entry?.slice(SESSION_COOKIE.length + 1);
  return value && SESSION_PATTERN.test(value) ? value : undefined;
}

function sessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function redirectToConnection(response, outcome, env) {
  const configuredOrigin = env.ATLASSIAN_UI_ORIGIN ?? "http://127.0.0.1:5173";
  let url;
  try {
    const parsed = new URL(configuredOrigin);
    if (
      parsed.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    ) {
      throw new Error("non-loopback origin");
    }
    url = new URL("/connection", parsed.origin);
  } catch {
    url = new URL("http://127.0.0.1:5173/connection");
  }
  url.searchParams.set("oauth", outcome);
  response.redirect(303, url.toString());
}
