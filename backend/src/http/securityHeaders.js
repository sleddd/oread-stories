// Security headers on every response. The content policy lets the interface load only its own
// scripts and the Google Fonts stylesheet and fonts; styled-components injects its styles at
// runtime, so inline styles stay allowed. No other site may frame Oread (clickjacking).
const ONE_YEAR_SECONDS = 31_536_000;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const BASE_HEADERS = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

// Strict-Transport-Security only when Oread is served over https: sent over plain http it
// would be ignored, and on a local http address it means nothing.
export function applySecurityHeaders(response, { isServedOverHttps = false } = {}) {
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    response.setHeader(name, value);
  }
  if (isServedOverHttps) {
    response.setHeader("strict-transport-security", `max-age=${ONE_YEAR_SECONDS}`);
  }
}
