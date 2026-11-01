// The vault endpoints, under /api/v1/vault. They need a signed-in session but, unlike every
// other endpoint, not an unlocked one: they are how a session gets unlocked.
//   GET  /vault                      { state, recoveryCode }
//   POST /vault/unlock               { password }
//   POST /vault/recover              { password, recoveryCode }
//   POST /vault/start-over           { password, confirmation: "erase" }
//   POST /vault/recovery-code        { password }            → { recoveryCode }
//   POST /vault/recovery-code/saved  the recovery code has been shown and kept
// Each returns { result } and, when it unlocked the session, { cookieValue } for the cookie.
import { badRequest, needsRecovery, notFound, tooManyRequests } from "../http/errors.js";
import { requireObject, requireString } from "../http/validate.js";
import { createRateLimiter } from "../http/rateLimiter.js";
import { NEEDS_RECOVERY } from "../services/vaultService.js";

const MAX_PASSWORD_LENGTH = 1_000;
const MAX_RECOVERY_CODE_LENGTH = 100;
const START_OVER_CONFIRMATION = "erase";
// Each attempt runs a deliberately slow key derivation; a person needs only a few tries.
const PASSWORD_ATTEMPTS_PER_WINDOW = 10;
const ATTEMPT_WINDOW_MILLISECONDS = 15 * 60_000;

function readPassword(body) {
  return requireString(body.password, "password", { max: MAX_PASSWORD_LENGTH, allowEmpty: false });
}

function readRecoveryCode(body) {
  return requireString(body.recoveryCode, "recoveryCode", {
    max: MAX_RECOVERY_CODE_LENGTH,
    allowEmpty: false,
  });
}

function readStartOverConfirmation(body) {
  if (body.confirmation !== START_OVER_CONFIRMATION) {
    throw badRequest(`Type "${START_OVER_CONFIRMATION}" to confirm erasing everything.`, {
      field: "confirmation",
    });
  }
}

// `verifyPassword(request, password)` rejects when the password isn't the account's.
export function createVaultRoutes({
  vault,
  verifyPassword,
  attemptLimiter = createRateLimiter({
    limit: PASSWORD_ATTEMPTS_PER_WINDOW,
    windowMilliseconds: ATTEMPT_WINDOW_MILLISECONDS,
  }),
}) {
  function countAttempt(userId) {
    const { isAllowed, retryAfterSeconds } = attemptLimiter.hit(userId);
    if (!isAllowed) {
      throw tooManyRequests(retryAfterSeconds);
    }
  }

  async function checkedPassword({ request, body, userId }) {
    countAttempt(userId);
    const password = readPassword(body);
    await verifyPassword(request, password);
    return password;
  }

  async function unlock({ request, body, who }) {
    const password = await checkedPassword({ request, body, userId: who.userId });
    const opened = await vault.openWithPassword({ ...who, password });
    if (opened.state === NEEDS_RECOVERY) {
      throw needsRecovery();
    }
    return { result: { state: opened.state }, cookieValue: opened.cookieValue };
  }

  async function recover({ request, body, who }) {
    const recoveryCode = readRecoveryCode(requireObject(body));
    const password = await checkedPassword({ request, body, userId: who.userId });
    const cookieValue = await vault.recover({ ...who, password, recoveryCode });
    return { result: { state: "unlocked" }, cookieValue };
  }

  async function startOver({ request, body, who }) {
    readStartOverConfirmation(requireObject(body));
    const password = await checkedPassword({ request, body, userId: who.userId });
    const cookieValue = await vault.startOver({ ...who, password });
    return { result: { state: "unlocked" }, cookieValue };
  }

  async function replaceRecoveryCode({ request, body, who, cookieValue }) {
    const password = await checkedPassword({ request, body, userId: who.userId });
    const recoveryCode = await vault.replaceRecoveryCode({ ...who, cookieValue, password });
    return { result: { recoveryCode } };
  }

  async function status({ who, cookieValue }) {
    return { result: await vault.status({ ...who, cookieValue }) };
  }

  async function markSaved({ who }) {
    await vault.markRecoveryCodeSaved(who);
    return { result: { saved: true } };
  }

  const handlers = {
    "GET /vault": status,
    "POST /vault/unlock": unlock,
    "POST /vault/recover": recover,
    "POST /vault/start-over": startOver,
    "POST /vault/recovery-code": replaceRecoveryCode,
    "POST /vault/recovery-code/saved": markSaved,
  };

  // who = { userId, sessionId }; body is the parsed JSON body ({} for GET).
  function handle({ method, apiPath, request, body, who, cookieValue }) {
    const handler = handlers[`${method} ${apiPath}`];
    if (!handler) {
      throw notFound(`No endpoint at ${method} /api/v1${apiPath}.`);
    }
    return handler({ request, body: requireObject(body), who, cookieValue });
  }

  return { handle };
}

export function isVaultPath(apiPath) {
  return apiPath === "/vault" || apiPath.startsWith("/vault/");
}
