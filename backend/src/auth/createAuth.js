// Accounts for hosted Oread, with Better Auth: email and password, a confirmed email before the
// first sign-in, password reset, and deleting an account (which deletes every row the user owns,
// through the database's cascades). Sessions are HTTP-only cookies; the routes live under
// /api/auth/*.
//
// Signing in is also when the session is unlocked: the password is the one moment the server
// can open the user's encrypted data (services/vaultService.js), so the after-hook does it then
// and hands the browser the unlock cookie. A password change carries the vault along.
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { isAllowedToSignUp, parseSignUpAllowlist } from "./signUpAllowlist.js";
import { verificationEmail, passwordResetEmail } from "../mail/authEmails.js";
import {
  UNLOCK_COOKIE_NAME,
  readUnlockCookie,
  unlockCookieAttributes,
} from "../http/unlockCookie.js";

export const AUTH_BASE_PATH = "/api/auth";
const MIN_PASSWORD_LENGTH = 10;
const SIGN_UP_PATH = "/sign-up/email";
const SIGN_IN_PATH = "/sign-in/email";
const CHANGE_PASSWORD_PATH = "/change-password";
export const NOT_INVITED_MESSAGE =
  "Oread is invite-only for now, and this email isn't on the list. Ask the person who runs it.";

function refuseUninvited() {
  throw new APIError("FORBIDDEN", { message: NOT_INVITED_MESSAGE, code: "NOT_INVITED" });
}

// Turns away sign-ups from addresses that aren't on the allowlist. Checked twice: at the sign-up
// route, so the person gets a clear answer, and again just before any account is written, so no
// other way in can create one.
function signUpGuards(allowlist) {
  const checkSignUpRequest = createAuthMiddleware(async (context) => {
    if (context.path === SIGN_UP_PATH && !isAllowedToSignUp(allowlist, context.body?.email)) {
      refuseUninvited();
    }
  });
  const checkNewUser = async (user) => {
    if (!isAllowedToSignUp(allowlist, user.email)) {
      refuseUninvited();
    }
  };
  return { checkSignUpRequest, checkNewUser };
}

// Behind a hosting proxy every request comes from the proxy, so sign-in limits need the header
// that carries the visitor's own address. Without one, Better Auth uses the connection's address.
function clientAddressSettings(clientIpHeader) {
  if (!clientIpHeader) {
    return {};
  }
  return { ipAddress: { ipAddressHeaders: [clientIpHeader] } };
}

function didSucceed(context) {
  return !(context.context.returned instanceof APIError);
}

function setUnlockCookie(context, cookieValue, isSecure) {
  if (cookieValue) {
    context.setCookie(UNLOCK_COOKIE_NAME, cookieValue, unlockCookieAttributes({ isSecure }));
  }
}

// A failure to unlock never fails the sign-in: the session is simply locked, and the
// interface asks for the password again through /api/v1/vault/unlock.
async function unlockAtSignIn({ context, vault, isSecure, logger }) {
  const newSession = context.context.newSession;
  const password = context.body?.password;
  if (!newSession || typeof password !== "string") {
    return;
  }
  try {
    const opened = await vault.openWithPassword({
      userId: newSession.user.id,
      sessionId: newSession.session.id,
      password,
    });
    setUnlockCookie(context, opened.cookieValue, isSecure);
  } catch (error) {
    logger.error?.(error);
  }
}

async function followPasswordChange({ context, vault, isSecure }) {
  const { currentPassword, newPassword } = context.body ?? {};
  const userId = context.context.session?.user?.id;
  if (!userId || typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return;
  }
  await vault.changePassword({ userId, currentPassword, newPassword });
  const newSession = context.context.newSession;
  if (!newSession) {
    return;
  }
  const cookieValue = await vault.carryOverUnlock({
    userId,
    fromSessionId: context.context.session.session.id,
    toSessionId: newSession.session.id,
    cookieValue: readUnlockCookie(context.headers?.get("cookie")),
  });
  setUnlockCookie(context, cookieValue, isSecure);
}

function vaultHooks({ vault, isSecure, logger }) {
  return createAuthMiddleware(async (context) => {
    if (!didSucceed(context)) {
      return;
    }
    if (context.path === SIGN_IN_PATH) {
      await unlockAtSignIn({ context, vault, isSecure, logger });
    } else if (context.path === CHANGE_PASSWORD_PATH) {
      await followPasswordChange({ context, vault, isSecure });
    }
  });
}

function afterHooksFor({ vault, isSecure, logger }) {
  if (!vault) {
    return {};
  }
  return { after: vaultHooks({ vault, isSecure, logger }) };
}

// `onUserCreated(userId)` runs after sign-up, when given. `vault` (services/vaultService.js)
// unlocks sessions at sign-in.
export function createAuth({ prisma, config, mailer, onUserCreated, vault, logger = console }) {
  // No list at all means nobody can sign up, the same as an empty one.
  const allowlist = config.signUpAllowlist ?? parseSignUpAllowlist("");
  const { checkSignUpRequest, checkNewUser } = signUpGuards(allowlist);
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: config.authSecret,
    baseURL: config.publicUrl,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(passwordResetEmail({ user, url }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in before confirming sends a fresh link, in case the first one never arrived.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(verificationEmail({ user, url }));
      },
    },
    user: {
      deleteUser: { enabled: true },
    },
    rateLimit: {
      enabled: config.isAuthRateLimited,
      storage: "database",
    },
    advanced: {
      useSecureCookies: config.useSecureCookies,
      ...clientAddressSettings(config.clientIpHeader),
    },
    hooks: {
      before: checkSignUpRequest,
      ...afterHooksFor({ vault, isSecure: Boolean(config.useSecureCookies), logger }),
    },
    databaseHooks: {
      user: {
        create: {
          before: checkNewUser,
          after: async (user) => {
            await onUserCreated?.(user.id);
          },
        },
      },
    },
    telemetry: { enabled: false },
  });
}
