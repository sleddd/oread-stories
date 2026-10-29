// CORS headers for browser callers. Only listed origins (or "*") get access.
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const PREFLIGHT_CACHE_SECONDS = "600";

function isOriginAllowed(origin, allowedOrigins) {
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

export function applyCorsHeaders(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin || !isOriginAllowed(origin, allowedOrigins)) {
    return;
  }
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", ALLOWED_METHODS);
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-max-age", PREFLIGHT_CACHE_SECONDS);
}
