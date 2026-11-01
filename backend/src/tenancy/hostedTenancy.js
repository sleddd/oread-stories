// Hosted mode: many accounts. /api/auth/* goes to Better Auth; every other request needs a
// signed-in session and gets services built for that user alone (their stories, chats, memory
// and settings). Building them is cheap: the lorebook, templates and local models are shared,
// which is why each user's request rate is limited.
//
// With a vault, a user's data is encrypted with their own key, and a session must also be
// unlocked (its browser holds the unlock cookie) before any of it can be read: otherwise the
// request is refused as locked. The /api/v1/vault routes are how a session gets unlocked.
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { unauthenticated, tooManyRequests, locked } from "../http/errors.js";
import { createRateLimiter } from "../http/rateLimiter.js";
import { readJson } from "../http/request.js";
import { readUnlockCookie, serializeUnlockCookie } from "../http/unlockCookie.js";
import { AUTH_BASE_PATH } from "../auth/createAuth.js";
import { isVaultPath } from "../routes/vault.js";

// Far above what a person clicking and chatting sends; low enough to stop a script.
const REQUESTS_PER_USER_PER_MINUTE = 300;
const ONE_MINUTE_MILLISECONDS = 60_000;

function defaultRateLimiter() {
  return createRateLimiter({
    limit: REQUESTS_PER_USER_PER_MINUTE,
    windowMilliseconds: ONE_MINUTE_MILLISECONDS,
  });
}

// `auth` is a Better Auth instance (or a test stand-in with handler and api.getSession).
// `servicesForUser(userId, dataKey)` builds that user's services. `vault` (services/
// vaultService.js) and `vaultRoutes` (routes/vault.js) turn on encryption; without them every
// signed-in session reads its data directly. `isSecure` marks the unlock cookie Secure.
export function createHostedTenancy({
  auth,
  servicesForUser,
  rateLimiter = defaultRateLimiter(),
  vault = null,
  vaultRoutes = null,
  isSecure = false,
}) {
  const authHandler = toNodeHandler(auth);

  function isAuthRequest(pathname) {
    return pathname === AUTH_BASE_PATH || pathname.startsWith(AUTH_BASE_PATH + "/");
  }

  // { userId, sessionId } for the signed-in session, after the per-user rate limit.
  async function signedInSession(request) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user?.id) {
      throw unauthenticated();
    }
    const { isAllowed, retryAfterSeconds } = rateLimiter.hit(session.user.id);
    if (!isAllowed) {
      throw tooManyRequests(retryAfterSeconds);
    }
    return { userId: session.user.id, sessionId: session.session?.id };
  }

  async function servicesFor(request) {
    const who = await signedInSession(request);
    if (!vault) {
      return servicesForUser(who.userId, null);
    }
    const cookieValue = readUnlockCookie(request.headers.cookie);
    const dataKey = await vault.dataKeyFor({ ...who, cookieValue });
    if (!dataKey) {
      throw locked();
    }
    return servicesForUser(who.userId, dataKey);
  }

  function isVaultRequest(apiPath) {
    return Boolean(vaultRoutes) && isVaultPath(apiPath);
  }

  // Runs a vault route; sets the unlock cookie when it unlocked the session.
  async function handleVault(request, response, apiPath) {
    const who = await signedInSession(request);
    let body = {};
    if (request.method !== "GET") {
      body = await readJson(request);
    }
    const outcome = await vaultRoutes.handle({
      method: request.method,
      apiPath,
      request,
      body,
      who,
      cookieValue: readUnlockCookie(request.headers.cookie),
    });
    if (outcome.cookieValue) {
      response.setHeader("set-cookie", serializeUnlockCookie(outcome.cookieValue, { isSecure }));
    }
    return outcome.result;
  }

  return {
    requiresSignIn: true,
    isAuthRequest,
    handleAuth: authHandler,
    servicesFor,
    isVaultRequest,
    handleVault,
  };
}
