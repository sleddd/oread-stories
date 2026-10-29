// Minimal AWS Signature Version 4 signer for Bedrock requests.
// Returns the request headers (lower-cased, without host) plus the authorization header.
import crypto from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
const SCOPE_TERMINATOR = "aws4_request";
const DATE_STAMP_LENGTH = 8;

function hmac(key, text) {
  return crypto.createHmac("sha256", key).update(text).digest();
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// encodeURIComponent leaves !'()* alone, but SigV4 requires them encoded too.
function encodeRfc3986(text) {
  return encodeURIComponent(text).replace(/[!'()*]/g, (character) => {
    return "%" + character.charCodeAt(0).toString(16).toUpperCase();
  });
}

// "2015-08-30T12:36:00.000Z" -> "20150830T123600Z"
function amzTimestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

// Non-S3 services sign the already-encoded path encoded a second time.
function canonicalPath(url) {
  const segments = url.pathname.split("/");
  return segments.map(encodeRfc3986).join("/");
}

function compareQueryPairs([firstKey, firstValue], [secondKey, secondValue]) {
  if (firstKey < secondKey) {
    return -1;
  }
  if (firstKey > secondKey) {
    return 1;
  }
  if (firstValue < secondValue) {
    return -1;
  }
  return 1;
}

function canonicalQuery(url) {
  const encodedPairs = [...url.searchParams].map(([key, value]) => [
    encodeRfc3986(key),
    encodeRfc3986(value),
  ]);
  const sortedPairs = encodedPairs.sort(compareQueryPairs);
  return sortedPairs.map(([key, value]) => `${key}=${value}`).join("&");
}

function lowerCaseHeaders(headers) {
  const lowered = {};
  for (const [name, value] of Object.entries(headers)) {
    lowered[name.toLowerCase()] = String(value).trim();
  }
  return lowered;
}

function signingKey(secretAccessKey, dateStamp, region, service) {
  const dateKey = hmac("AWS4" + secretAccessKey, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, SCOPE_TERMINATOR);
}

export function signAws({
  method,
  url,
  headers = {},
  body = "",
  service,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  now = new Date(),
  payloadHeader = true,
}) {
  const parsedUrl = new URL(url);
  const timestamp = amzTimestamp(now);
  const dateStamp = timestamp.slice(0, DATE_STAMP_LENGTH);
  const payloadHash = sha256Hex(body);

  const headersToSign = { ...headers, host: parsedUrl.host, "x-amz-date": timestamp };
  if (payloadHeader) {
    headersToSign["x-amz-content-sha256"] = payloadHash;
  }
  if (sessionToken) {
    headersToSign["x-amz-security-token"] = sessionToken;
  }
  const signedHeaderValues = lowerCaseHeaders(headersToSign);
  const headerNames = Object.keys(signedHeaderValues).sort();
  const headerLines = headerNames.map((name) => `${name}:${signedHeaderValues[name]}\n`);
  const canonicalHeaders = headerLines.join("");
  const signedHeaders = headerNames.join(";");

  const canonicalRequest = [
    method,
    canonicalPath(parsedUrl),
    canonicalQuery(parsedUrl),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${region}/${service}/${SCOPE_TERMINATOR}`;
  const stringToSign = [ALGORITHM, timestamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const key = signingKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", key).update(stringToSign).digest("hex");

  // fetch sets host itself; sending it again would be rejected.
  delete signedHeaderValues.host;
  signedHeaderValues.authorization =
    `${ALGORITHM} Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return signedHeaderValues;
}
