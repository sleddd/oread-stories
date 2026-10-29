// Stops a signed-in user from pointing the server at internal addresses. In hosted mode a user
// can set a provider's base URL; without this check they could make the server call its own
// network (an SSRF). Base URLs must be https and resolve only to public addresses, and the
// Bedrock region must look like an AWS region (it becomes part of the hostname).
//
// Known limit: the address is checked when the call is prepared, so a hostname that changes
// its DNS answer between the check and the request could still slip through.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { badRequest } from "../http/errors.js";

const AWS_REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d{1,2}$/;

const PRIVATE_IPV4_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function ipv4ToNumber(address) {
  const parts = address.split(".").map(Number);
  let value = 0;
  for (const part of parts) {
    value = value * 256 + part;
  }
  return value;
}

function isInIpv4Range(address, [rangeStart, prefixLength]) {
  const blockSize = 2 ** (32 - prefixLength);
  const start = ipv4ToNumber(rangeStart);
  const value = ipv4ToNumber(address);
  return value >= start && value < start + blockSize;
}

function isPrivateIpv4(address) {
  return PRIVATE_IPV4_RANGES.some((range) => isInIpv4Range(address, range));
}

// Loopback, unspecified, link-local, unique-local, multicast, and IPv4-mapped private addresses.
function isPrivateIpv6(address) {
  const lowered = address.toLowerCase();
  if (lowered === "::1" || lowered === "::") {
    return true;
  }
  const mappedIpv4 = lowered.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4[1]);
  }
  const privatePrefixes = ["fe8", "fe9", "fea", "feb", "fc", "fd", "ff"];
  return privatePrefixes.some((prefix) => lowered.startsWith(prefix));
}

export function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    return isPrivateIpv4(address);
  }
  return isPrivateIpv6(address);
}

function unsafeUrl(field, reason) {
  return badRequest(`${field} ${reason}`, { field });
}

function parseHttpsUrl(field, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw unsafeUrl(field, "must be a full URL.");
  }
  if (url.protocol !== "https:") {
    throw unsafeUrl(field, "must start with https://.");
  }
  return url;
}

// `resolveHost` is dns.lookup by default; tests pass their own.
export function createOutboundUrlGuard({ resolveHost = lookup } = {}) {
  async function addressesOf(hostname) {
    const bareHostname = hostname.replace(/^\[|\]$/g, "");
    if (isIP(bareHostname)) {
      return [bareHostname];
    }
    const results = await resolveHost(bareHostname, { all: true });
    return results.map((result) => result.address);
  }

  async function checkBaseUrl(field, value) {
    const url = parseHttpsUrl(field, value);
    let addresses;
    try {
      addresses = await addressesOf(url.hostname);
    } catch {
      throw unsafeUrl(field, "points at a host that can't be found.");
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw unsafeUrl(field, "must point at a public internet address.");
    }
  }

  function checkRegion(field, value) {
    if (!AWS_REGION_PATTERN.test(value)) {
      throw unsafeUrl(field, "must be an AWS region such as us-east-1.");
    }
  }

  // Checks a provider config before it is used for a call. Returns the config unchanged.
  async function checkProviderConfig(providerName, config) {
    if (config.baseUrl) {
      await checkBaseUrl(`${providerName}.baseUrl`, config.baseUrl);
    }
    if (providerName === "bedrock" && config.region) {
      checkRegion("bedrock.region", config.region);
    }
    return config;
  }

  return { checkProviderConfig };
}
