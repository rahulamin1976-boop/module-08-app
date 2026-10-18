const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

export class AtlassianRequestError extends Error {
  constructor(message, { status, code, retryAfter } = {}) {
    super(message);
    this.name = "AtlassianRequestError";
    this.status = status ?? 503;
    this.code = code ?? "UPSTREAM_UNAVAILABLE";
    this.exposeApiMessage = true;
    if (retryAfter !== undefined) {
      this.retryAfter = retryAfter;
    }
  }
}

export async function requestAtlassianJson(url, {
  accessToken,
  method = "GET",
  body,
  fetchImpl = fetch,
  now = Date.now,
  sleepImpl = sleep,
} = {}) {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("An Atlassian access token is required.");
  }

  const deadline = now() + UPSTREAM_TIMEOUT_MS;
  let lastError;
  let finalRetryAfter;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const remaining = deadline - now();
    if (remaining <= 0) {
      throw timeoutError();
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(remaining),
      });
    } catch (error) {
      if (now() >= deadline || error?.name === "TimeoutError") {
        throw timeoutError();
      }
      if (error?.name !== "TypeError" && error?.name !== "AbortError") {
        throw new AtlassianRequestError("Atlassian request failed.");
      }
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await waitBeforeRetry(attempt, deadline, now, sleepImpl);
        continue;
      }
      throw new AtlassianRequestError("Atlassian service is unavailable.", {
        code: "UPSTREAM_UNAVAILABLE",
      });
    }

    if (response.status === 429) {
      finalRetryAfter = parseRetryAfter(response.headers.get("Retry-After"), now());
      if (attempt < MAX_RETRIES) {
        await waitBeforeRetry(attempt, deadline, now, sleepImpl, finalRetryAfter);
        continue;
      }
      throw new AtlassianRequestError("Atlassian rate limit was reached.", {
        status: 429,
        code: "UPSTREAM_RATE_LIMITED",
        retryAfter: finalRetryAfter,
      });
    }

    if (response.status >= 500 && response.status <= 599) {
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt < MAX_RETRIES) {
        await waitBeforeRetry(attempt, deadline, now, sleepImpl);
        continue;
      }
      throw new AtlassianRequestError("Atlassian service is unavailable.", {
        code: "UPSTREAM_UNAVAILABLE",
      });
    }

    if (!response.ok) {
      throw new AtlassianRequestError("Atlassian rejected the request.", {
        status: response.status,
        code:
          response.status === 401 || response.status === 403
            ? "UPSTREAM_AUTHORIZATION_FAILED"
            : "UPSTREAM_REQUEST_REJECTED",
      });
    }

    if (response.status === 204) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      throw new AtlassianRequestError("Atlassian returned an invalid response.", {
        status: 502,
        code: "UPSTREAM_INVALID_RESPONSE",
      });
    }
  }

  throw new AtlassianRequestError("Atlassian service is unavailable.", {
    code: "UPSTREAM_UNAVAILABLE",
    cause: lastError,
  });
}

function parseRetryAfter(value, now) {
  if (!value) {
    return 1;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? 1 : Math.max(0, Math.ceil((date - now) / 1000));
}

async function waitBeforeRetry(attempt, deadline, now, sleepImpl, retryAfter) {
  const remaining = deadline - now();
  const delay = retryAfter === undefined
    ? 250 * (2 ** attempt)
    : retryAfter * 1000;
  if (delay >= remaining) {
    throw timeoutError();
  }
  await sleepImpl(delay);
}

function timeoutError() {
  return new AtlassianRequestError("Atlassian request exceeded its 15-second deadline.", {
    code: "UPSTREAM_TIMEOUT",
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
