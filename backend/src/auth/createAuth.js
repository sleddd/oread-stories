// Accounts for hosted Oread, with Better Auth: email and password, a confirmed email before the
// first sign-in, password reset, and deleting an account (which deletes every row the user owns,
// through the database's cascades). Sessions are HTTP-only cookies; the routes live under
// /api/auth/*.
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { isAllowedToSignUp, parseSignUpAllowlist } from "./signUpAllowlist.js";
import { verificationEmail, passwordResetEmail } from "../mail/authEmails.js";

export const AUTH_BASE_PATH = "/api/auth";
const MIN_PASSWORD_LENGTH = 10;
const SIGN_UP_PATH = "/sign-up/email";
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

// `onUserCreated(userId)` runs after sign-up (it creates the user's My story).
export function createAuth({ prisma, config, mailer, onUserCreated }) {
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
    },
    databaseHooks: {
      user: {
        create: {
          before: checkNewUser,
          after: async (user) => {
            await onUserCreated(user.id);
          },
        },
      },
    },
    telemetry: { enabled: false },
  });
}
