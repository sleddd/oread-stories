// The account's encryption, hosted. Every story, chat and setting is sealed with a key that
// only the password (or the recovery code) opens, so a signed-in session can still be locked:
// right after confirming the email, after a password reset, or when its unlock cookie is gone.
// While locked, the unlock screen asks for the password; after a password reset it asks for
// the recovery code instead, or offers to start over. A newly made recovery code is shown once,
// before the app, until the person says they've kept it.
//
// lockScreen (while authStatus is "locked"): "unlock" | "recover"

const UNLOCK_SCREEN = "unlock";
const RECOVER_SCREEN = "recover";
const NEEDS_RECOVERY_CODE = "needs_recovery";
const UNLOCKED_STATE = "unlocked";
export const START_OVER_CONFIRMATION = "erase";

export function createVaultSlice({ api, platform }) {
  return (set, get) => ({
    lockScreen: UNLOCK_SCREEN,
    isVaultBusy: false,
    vaultError: null,
    // Shown once, then cleared when the person confirms they've saved it.
    pendingRecoveryCode: null,

    // Called once signed in. Resolves to true when the data is open and the app can load.
    async checkVault() {
      const status = await api.getVaultStatus();
      if (status.state !== UNLOCKED_STATE) {
        set({ authStatus: "locked", lockScreen: UNLOCK_SCREEN, vaultError: null });
        return false;
      }
      set({ pendingRecoveryCode: status.recoveryCode ?? null });
      return true;
    },

    // Unlocked: note any new recovery code, then load the app.
    async enterUnlocked() {
      const status = await api.getVaultStatus();
      set({
        authStatus: "signedIn",
        pendingRecoveryCode: status.recoveryCode ?? null,
        bootStatus: "loading",
        vaultError: null,
      });
      await get().boot();
    },

    async runVaultStep(step) {
      set({ isVaultBusy: true, vaultError: null });
      try {
        await step();
        await get().enterUnlocked();
      } catch (error) {
        if (error.code === NEEDS_RECOVERY_CODE) {
          set({ authStatus: "locked", lockScreen: RECOVER_SCREEN, vaultError: null });
          return;
        }
        set({ vaultError: error.message });
      } finally {
        set({ isVaultBusy: false });
      }
    },

    unlock({ password }) {
      return get().runVaultStep(() => api.unlockVault({ password }));
    },

    recover({ password, recoveryCode }) {
      return get().runVaultStep(() => api.recoverVault({ password, recoveryCode }));
    },

    startOver({ password }) {
      return get().runVaultStep(() => {
        return api.startOverVault({ password, confirmation: START_OVER_CONFIRMATION });
      });
    },

    showRecoveryScreen() {
      set({ lockScreen: RECOVER_SCREEN, vaultError: null });
    },

    showUnlockScreen() {
      set({ lockScreen: UNLOCK_SCREEN, vaultError: null });
    },

    // A request found the session locked (the API's 423).
    handleLocked(code) {
      if (get().authStatus !== "signedIn") {
        return;
      }
      let lockScreen = UNLOCK_SCREEN;
      if (code === NEEDS_RECOVERY_CODE) {
        lockScreen = RECOVER_SCREEN;
      }
      set({ authStatus: "locked", lockScreen, vaultError: null, bootStatus: "loading" });
    },

    // Resolves to whether the code reached the clipboard.
    copyRecoveryCode(recoveryCode) {
      return platform.copyText(recoveryCode);
    },

    async confirmRecoveryCodeSaved() {
      set({ pendingRecoveryCode: null });
      try {
        await api.markRecoveryCodeSaved();
      } catch {
        // The code was shown and kept; it would only be offered again on another device.
      }
    },

    // Settings: a fresh recovery code replaces the old one. Resolves to the code, or null.
    async requestNewRecoveryCode({ password }) {
      set({ isVaultBusy: true, vaultError: null });
      try {
        const { recoveryCode } = await api.newRecoveryCode({ password });
        set({ pendingRecoveryCode: recoveryCode });
        return recoveryCode;
      } catch (error) {
        set({ vaultError: error.message });
        return null;
      } finally {
        set({ isVaultBusy: false });
      }
    },

    clearVaultState() {
      set({
        lockScreen: UNLOCK_SCREEN,
        isVaultBusy: false,
        vaultError: null,
        pendingRecoveryCode: null,
      });
    },
  });
}
