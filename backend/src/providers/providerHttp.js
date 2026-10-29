// Small helpers every provider adapter shares: base URLs, optional temperature, and turning
// a failed HTTP response into a readable error.
const MAX_ERROR_DETAIL_LENGTH = 400;

export function withoutTrailingSlashes(url, fallbackUrl) {
  return String(url || fallbackUrl).replace(/\/+$/, "");
}

// Temperature is optional: blank, null or non-numeric means "use the model's default".
export function hasTemperature(temperature) {
  if (temperature === "" || temperature === null || temperature === undefined) {
    return false;
  }
  return !Number.isNaN(Number(temperature));
}

// Providers put the message in different places; fall back to the raw body.
function messageFromParsedBody(parsed, bodyText) {
  if (parsed.error?.message) {
    return parsed.error.message;
  }
  if (parsed.message) {
    return parsed.message;
  }
  if (parsed.Message) {
    return parsed.Message;
  }
  if (typeof parsed.error === "string") {
    return parsed.error;
  }
  return bodyText;
}

function errorMessageFromBody(bodyText) {
  try {
    return messageFromParsedBody(JSON.parse(bodyText), bodyText);
  } catch {
    // Not JSON (or JSON without fields to read): show the body as it came.
    return bodyText;
  }
}

// Throws an Error carrying the response status, e.g. "Anthropic 401: invalid x-api-key".
export async function throwResponseError(response, providerLabel) {
  const bodyText = await response.text().catch(() => "");
  const message = errorMessageFromBody(bodyText);
  const detail = String(message).slice(0, MAX_ERROR_DETAIL_LENGTH) || response.statusText;
  const error = new Error(`${providerLabel} ${response.status}: ${detail}`);
  error.status = response.status;
  throw error;
}
