// Hosted mode: many accounts. /api/auth/* goes to Better Auth; every other request needs a
// signed-in session and gets services built for that user alone (their stories, chats, memory
// and settings). Building them is cheap: the lorebook, templates and local models are shared.
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { unauthenticated } from "../http/errors.js";
import { AUTH_BASE_PATH } from "../auth/createAuth.js";

// `auth` is a Better Auth instance (or a test stand-in with handler and api.getSession).
// `servicesForUser(userId)` builds that user's services.
export function createHostedTenancy({ auth, servicesForUser }) {
  const authHandler = toNodeHandler(auth);

  function isAuthRequest(pathname) {
    return pathname === AUTH_BASE_PATH || pathname.startsWith(AUTH_BASE_PATH + "/");
  }

  async function servicesFor(request) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user?.id) {
      throw unauthenticated();
    }
    return servicesForUser(session.user.id);
  }

  return { requiresSignIn: true, isAuthRequest, handleAuth: authHandler, servicesFor };
}
