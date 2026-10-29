// Reads request bodies. Only JSON is accepted, with a size limit to protect the server.
import { badRequest, payloadTooLarge, unsupportedMediaType } from "./errors.js";

const DEFAULT_BODY_LIMIT_BYTES = 1_000_000;

async function readBodyText(request, limit) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > limit) {
      throw payloadTooLarge(`Request body is larger than ${limit} bytes.`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isJsonContentType(request) {
  const contentType = String(request.headers["content-type"] || "");
  return contentType.includes("application/json");
}

// Reads and parses a JSON request body. An empty body reads as {}.
export async function readJson(request, { limit = DEFAULT_BODY_LIMIT_BYTES } = {}) {
  const rawBody = await readBodyText(request, limit);
  if (!rawBody.trim()) {
    return {};
  }
  if (!isJsonContentType(request)) {
    throw unsupportedMediaType("Send the request body as application/json.");
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw badRequest("The request body is not valid JSON.");
  }
}
