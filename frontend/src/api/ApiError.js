// An error returned by the Oread API, carrying the server's error code and message.
export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const NETWORK_ERROR_STATUS = 0;

export function networkError() {
  return new ApiError({
    status: NETWORK_ERROR_STATUS,
    code: "network_error",
    message: "Can't reach the Oread API. Is the backend running?",
  });
}

// Builds an ApiError from a failed response, using the server's { error: { code, message } } body when present.
export async function errorFromResponse(response) {
  const body = await response.json().catch(() => null);
  const serverError = body?.error ?? {};
  return new ApiError({
    status: response.status,
    code: serverError.code ?? "http_error",
    message: serverError.message ?? `Request failed (${response.status}).`,
    details: serverError.details,
  });
}
