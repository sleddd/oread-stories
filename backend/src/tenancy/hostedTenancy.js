// Hosted mode: many accounts. /api/auth/* goes to Better Auth; every other request needs a
// signed-in session and gets services built for that user alone (their stories, chats, memory
// and settings). Building them is cheap: the lorebook, templates and local models are shared,
// which is why each user's request rate is limited.
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { unauthenticated, tooManyRequests } from "../http/errors.js";
import { createRateLimiter } from "../http/rateLimiter.js";
import { AUTH_BASE_PATH } from "../auth/createAuth.js";

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
// `servicesForUser(userId)` builds that user's services.
export function createHostedTenancy({ auth, servicesForUser, rateLimiter = defaultRateLimiter() }) {
  const authHandler = toNodeHandler(auth);

  function isAuthRequest(pathname) {
    return pathname === AUTH_BASE_PATH || pathname.startsWith(AUTH_BASE_PATH + "/");
  }

  async function servicesFor(request) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user?.id) {
      throw unauthenticated();
    }
    const { isAllowed, retryAfterSeconds } = rateLimiter.hit(session.user.id);
    if (!isAllowed) {
      throw tooManyRequests(retryAfterSeconds);
    }
    return servicesForUser(session.user.id);
  }

  return { requiresSignIn: true, isAuthRequest, handleAuth: authHandler, servicesFor };
}
