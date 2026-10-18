export class ApiError extends Error {
  constructor(message, { status, code, details }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  if (typeof path !== "string" || !path.startsWith("/api/v1/")) {
    throw new TypeError("API requests must use a same-origin /api/v1 path.");
  }

  const headers = new Headers();
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: "same-origin",
  });

  if (response.status === 204) {
    return undefined;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The server returned an invalid response.", {
      status: response.status,
      code: "INVALID_RESPONSE",
    });
  }

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      typeof error?.message === "string"
        ? error.message
        : "The request could not be completed.",
      {
        status: response.status,
        code: typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
        details: error?.details,
      },
    );
  }

  return payload;
}
