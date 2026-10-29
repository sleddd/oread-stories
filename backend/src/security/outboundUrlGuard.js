// Stops a signed-in user from pointing the server at internal addresses. In hosted mode a user
// can set a provider's base URL; without this check they could make the server call its own
// network (an SSRF). Base URLs must be https and resolve only to public addresses, and the
// Bedrock region must look like an AWS region (it becomes part of the hostname).
//
// The address is checked twice: once when the config is prepared, for a clear error, and again
// by the dispatcher each time a connection opens, so a hostname whose DNS answer changes after
// the first check (DNS rebinding) is still refused. Providers never follow redirects
// (providers/providerHttp.js), so a public server can't bounce a call inward either.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent } from "undici";
import { badRequest } from "../http/errors.js";

const AWS_REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d{1,2}$/;

const PRIVATE_IPV4_SUBNETS = [
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

// Besides loopback, link-local, unique-local and multicast, this blocks every range that can
// carry an IPv4 address inside it (compatible, NAT64, 6to4, Teredo): no model provider is reached
// through one, and each could otherwise smuggle in a private IPv4 address.
const PRIVATE_IPV6_SUBNETS = [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

function createPrivateAddressList() {
  const blockList = new BlockList();
  for (const [network, prefixLength] of PRIVATE_IPV4_SUBNETS) {
    blockList.addSubnet(network, prefixLength, "ipv4");
  }
  for (const [network, prefixLength] of PRIVATE_IPV6_SUBNETS) {
    blockList.addSubnet(network, prefixLength, "ipv6");
  }
  return blockList;
}

// BlockList also matches IPv4-mapped IPv6 addresses (::ffff:7f00:1) against the IPv4 subnets.
const PRIVATE_ADDRESSES = createPrivateAddressList();

export function isPrivateAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    return PRIVATE_ADDRESSES.check(address, "ipv4");
  }
  if (version === 6) {
    return PRIVATE_ADDRESSES.check(address, "ipv6");
  }
  // Not an address at all: never treat it as safe.
  return true;
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

function bracketless(hostname) {
  return hostname.replace(/^\[|\]$/g, "");
}

// A connection-time lookup for the dispatcher: resolves as usual, then refuses any connection
// whose addresses include a private one. Node skips lookup for IP literals, which is why
// checkBaseUrl also checks the base URL's own host.
function createCheckedLookup(resolveHost) {
  return function checkedLookup(hostname, options, callback) {
    resolveHost(hostname, { all: true })
      .then((results) => {
        const blockedResult = results.find((result) => isPrivateAddress(result.address));
        if (results.length === 0 || blockedResult) {
          callback(new Error(`Refused to connect to ${hostname}: not a public address.`));
          return;
        }
        if (options.all) {
          callback(null, results);
          return;
        }
        callback(null, results[0].address, results[0].family);
      })
      .catch((error) => callback(error));
  };
}

// `resolveHost` is dns.lookup by default; tests pass their own.
export function createOutboundUrlGuard({ resolveHost = lookup } = {}) {
  // One shared dispatcher: every hosted provider call connects through the checked lookup.
  const dispatcher = new Agent({ connect: { lookup: createCheckedLookup(resolveHost) } });

  async function addressesOf(hostname) {
    const bareHostname = bracketless(hostname);
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

  // Checks a provider config before it is used for a call. Returns the config with the checked
  // dispatcher attached, which the provider passes to fetch.
  async function checkProviderConfig(providerName, config) {
    if (config.baseUrl) {
      await checkBaseUrl(`${providerName}.baseUrl`, config.baseUrl);
    }
    if (providerName === "bedrock" && config.region) {
      checkRegion("bedrock.region", config.region);
    }
    return { ...config, dispatcher };
  }

  return { checkProviderConfig, checkedLookup: createCheckedLookup(resolveHost) };
}
