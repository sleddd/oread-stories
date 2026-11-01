// Opening and looking after each user's encrypted data (security/userVault.js). A session is
// "unlocked" once its browser holds a cookie that opens the session's copy of the data key.
// The first unlock of an account that has no vault yet creates one, seals everything the user
// already had, and leaves a recovery code for the interface to show once.
//
// Callers have already checked the password with the sign-in system; the vault only uses it to
// derive keys. A password that opens the account but not the vault means it was reset, and
// only the recovery code (or starting over) gets the data back.
import { badRequest } from "../http/errors.js";
import { createSealer } from "../security/sealedJson.js";
import {
  newDataKey,
  newRecoveryCode,
  wrapForPassword,
  unwrapWithPassword,
  wrapForRecoveryCode,
  unwrapWithRecoveryCode,
  sealForSession,
  openForSession,
  sealWithSessionCookie,
  openWithSessionCookie,
} from "../security/userVault.js";

export const UNLOCKED = "unlocked";
export const LOCKED = "locked";
export const NEEDS_RECOVERY = "needs_recovery";

const WRONG_RECOVERY_CODE_MESSAGE =
  "That recovery code doesn't open your stories. Check it and try again.";

// `vaultStore` is storage/prisma/prismaVaultStore.js (or a stand-in in tests).
export function createVaultService({ vaultStore }) {
  async function newWraps({ userId, dataKey, password }) {
    const recoveryCode = newRecoveryCode();
    const passwordWrap = await wrapForPassword({ userId, dataKey, password });
    const recoveryWrap = await wrapForRecoveryCode({ userId, dataKey, recoveryCode });
    return { passwordWrap, recoveryWrap, recoveryCode };
  }

  // Gives the session its copy of the data key. Returns the cookie value to hand the browser.
  async function unlockSession({ userId, sessionId, dataKey, recoveryCodeToShow = null }) {
    const { cookieValue, sealedDataKey } = sealForSession({ userId, sessionId, dataKey });
    let pendingRecoveryCode = null;
    if (recoveryCodeToShow) {
      pendingRecoveryCode = sealWithSessionCookie({
        userId,
        sessionId,
        cookieValue,
        text: recoveryCodeToShow,
      });
    }
    await vaultStore.saveSessionKey({ sessionId, userId, sealedDataKey, pendingRecoveryCode });
    return cookieValue;
  }

  async function createVault({ userId, sessionId, password }) {
    const dataKey = newDataKey();
    const { passwordWrap, recoveryWrap, recoveryCode } = await newWraps({
      userId,
      dataKey,
      password,
    });
    const sealer = createSealer({ userId, dataKey });
    await vaultStore.createVaultAndSealData({ userId, passwordWrap, recoveryWrap, sealer });
    return unlockSession({ userId, sessionId, dataKey, recoveryCodeToShow: recoveryCode });
  }

  // After the password is checked: returns { state, cookieValue }. `state` is NEEDS_RECOVERY
  // (and there's no cookie) when the password no longer opens the vault.
  async function openWithPassword({ userId, sessionId, password }) {
    const vault = await vaultStore.findVault(userId);
    if (!vault) {
      const cookieValue = await createVault({ userId, sessionId, password });
      return { state: UNLOCKED, cookieValue };
    }
    const dataKey = await unwrapWithPassword({ userId, wrap: vault.passwordWrap, password });
    if (!dataKey) {
      return { state: NEEDS_RECOVERY, cookieValue: null };
    }
    const cookieValue = await unlockSession({ userId, sessionId, dataKey });
    return { state: UNLOCKED, cookieValue };
  }

  // The data key for one request, or null when this session isn't unlocked.
  async function dataKeyFor({ userId, sessionId, cookieValue }) {
    if (!cookieValue) {
      return null;
    }
    const sessionKey = await vaultStore.findSessionKey(sessionId);
    if (!sessionKey || sessionKey.userId !== userId) {
      return null;
    }
    return openForSession({
      userId,
      sessionId,
      sealedDataKey: sessionKey.sealedDataKey,
      cookieValue,
    });
  }

  // { state, recoveryCode }: the recovery code only while it is waiting to be shown.
  async function status({ userId, sessionId, cookieValue }) {
    const dataKey = await dataKeyFor({ userId, sessionId, cookieValue });
    if (!dataKey) {
      return { state: LOCKED, recoveryCode: null };
    }
    const sessionKey = await vaultStore.findSessionKey(sessionId);
    const recoveryCode = openWithSessionCookie({
      userId,
      sessionId,
      cookieValue,
      sealed: sessionKey.pendingRecoveryCode,
    });
    return { state: UNLOCKED, recoveryCode };
  }

  async function markRecoveryCodeSaved({ sessionId }) {
    await vaultStore.clearPendingRecoveryCode(sessionId);
  }

  // After a password reset: the recovery code opens the vault, the current password is wrapped
  // in, and a fresh recovery code replaces the used one.
  async function recover({ userId, sessionId, password, recoveryCode }) {
    const vault = await vaultStore.findVault(userId);
    const dataKey = vault
      ? await unwrapWithRecoveryCode({ userId, wrap: vault.recoveryWrap, recoveryCode })
      : null;
    if (!dataKey) {
      throw badRequest(WRONG_RECOVERY_CODE_MESSAGE, { field: "recoveryCode" });
    }
    const wraps = await newWraps({ userId, dataKey, password });
    await vaultStore.updateVault(userId, {
      passwordWrap: wraps.passwordWrap,
      recoveryWrap: wraps.recoveryWrap,
    });
    return unlockSession({ userId, sessionId, dataKey, recoveryCodeToShow: wraps.recoveryCode });
  }

  // Without the recovery code: everything the account held is erased and a new vault begins.
  async function startOver({ userId, sessionId, password }) {
    const dataKey = newDataKey();
    const wraps = await newWraps({ userId, dataKey, password });
    await vaultStore.replaceVaultErasingData({
      userId,
      passwordWrap: wraps.passwordWrap,
      recoveryWrap: wraps.recoveryWrap,
    });
    return unlockSession({ userId, sessionId, dataKey, recoveryCodeToShow: wraps.recoveryCode });
  }

  // From an unlocked session: replaces the recovery code. The password must still open the
  // vault, which is what proves it is the account's own.
  async function replaceRecoveryCode({ userId, sessionId, cookieValue, password }) {
    const vault = await vaultStore.findVault(userId);
    const dataKey = await dataKeyFor({ userId, sessionId, cookieValue });
    const passwordKey = await unwrapWithPassword({ userId, wrap: vault.passwordWrap, password });
    if (!dataKey || !passwordKey) {
      throw badRequest("That password isn't right.", { field: "password" });
    }
    const recoveryCode = newRecoveryCode();
    const recoveryWrap = await wrapForRecoveryCode({ userId, dataKey, recoveryCode });
    await vaultStore.updateVault(userId, { recoveryWrap });
    return recoveryCode;
  }

  // A password change through the sign-in system: the vault follows it. Returns false when the
  // old password didn't open the vault (it was reset earlier), so nothing changed.
  async function changePassword({ userId, currentPassword, newPassword }) {
    const vault = await vaultStore.findVault(userId);
    if (!vault) {
      return false;
    }
    const dataKey = await unwrapWithPassword({
      userId,
      wrap: vault.passwordWrap,
      password: currentPassword,
    });
    if (!dataKey) {
      return false;
    }
    const passwordWrap = await wrapForPassword({ userId, dataKey, password: newPassword });
    await vaultStore.updateVault(userId, { passwordWrap });
    return true;
  }

  // For a new session issued by a password change, from a session that was already unlocked.
  async function carryOverUnlock({ userId, fromSessionId, toSessionId, cookieValue }) {
    const dataKey = await dataKeyFor({ userId, sessionId: fromSessionId, cookieValue });
    if (!dataKey) {
      return null;
    }
    return unlockSession({ userId, sessionId: toSessionId, dataKey });
  }

  return {
    openWithPassword,
    dataKeyFor,
    status,
    markRecoveryCodeSaved,
    recover,
    startOver,
    replaceRecoveryCode,
    changePassword,
    carryOverUnlock,
  };
}
