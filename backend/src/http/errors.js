// Errors that map to HTTP responses. Anything else thrown in a handler becomes a 500.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new HttpError(400, "bad_request", message, details);
}

export function unauthenticated(message = "Sign in to use Oread.") {
  return new HttpError(401, "unauthenticated", message);
}

export function notFound(message = "Not found.") {
  return new HttpError(404, "not_found", message);
}

export function conflict(message) {
  return new HttpError(409, "conflict", message);
}

export function payloadTooLarge(message) {
  return new HttpError(413, "payload_too_large", message);
}

export function unsupportedMediaType(message) {
  return new HttpError(415, "unsupported_media_type", message);
}

export function tooManyRequests(retryAfterSeconds) {
  return new HttpError(
    429,
    "too_many_requests",
    `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    { retryAfterSeconds },
  );
}

export function upstream(message, status = 502) {
  return new HttpError(status, "upstream_error", message);
}

// The JSON body every error response carries. Unexpected errors never leak their details.
export function errorBody(error) {
  if (!(error instanceof HttpError)) {
    return { error: { code: "internal_error", message: "Something went wrong on the server." } };
  }
  const body = { code: error.code, message: error.message };
  if (error.details) {
    body.details = error.details;
  }
  return { error: body };
}
