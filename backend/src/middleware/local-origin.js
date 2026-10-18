import { isIP } from "node:net";
import { createApiError } from "./error-handler.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isLoopbackAddress(address) {
  if (!address) {
    return false;
  }

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isLoopbackAddress(normalized.slice("::ffff:".length));
  }

  if (isIP(normalized) === 4) {
    return normalized.startsWith("127.");
  }

  return isIP(normalized) === 6 && normalized === "::1";
}

function isLoopbackHost(hostHeader) {
  if (!hostHeader) {
    return false;
  }

  try {
    const url = new URL(`http://${hostHeader}`);
    return (
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function localOrigin(request, _response, next) {
  const host = request.get("host");
  const origin = request.get("origin");
  const isSafeMethod = SAFE_METHODS.has(request.method);

  if (!isLoopbackAddress(request.socket.remoteAddress) || !isLoopbackHost(host)) {
    return next(
      createApiError(
        403,
        "LOCAL_ACCESS_ONLY",
        "This application accepts local requests only.",
      ),
    );
  }

  if (origin === undefined) {
    if (!isSafeMethod) {
      return next(
        createApiError(
          403,
          "ORIGIN_REQUIRED",
          "State-changing requests require a same-origin header.",
        ),
      );
    }
    return next();
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return next(createApiError(403, "INVALID_ORIGIN", "Request origin is invalid."));
  }

  if (
    parsedOrigin.protocol !== `${request.protocol}:` ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search !== "" ||
    parsedOrigin.hash !== "" ||
    parsedOrigin.host.toLowerCase() !== host.toLowerCase() ||
    !isLoopbackHost(parsedOrigin.host)
  ) {
    return next(
      createApiError(
        403,
        "CROSS_ORIGIN_REQUEST",
        "Cross-origin requests are not allowed.",
      ),
    );
  }

  return next();
}
