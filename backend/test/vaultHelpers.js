// Test stand-ins for the vault (services/vaultService.js).

// The vault store's shape, kept in memory. `sealedWith` records the sealer the account's
// existing rows were sealed with when the vault was made.
export function memoryVaultStore() {
  const vaults = new Map();
  const sessionKeys = new Map();
  const record = { sealedWith: null, erasedFor: [] };
  return {
    record,
    vaults,
    async findVault(userId) {
      return vaults.get(userId) ?? null;
    },
    async createVaultAndSealData({ userId, passwordWrap, recoveryWrap, sealer }) {
      if (vaults.has(userId)) {
        throw new Error("vault exists");
      }
      vaults.set(userId, { userId, passwordWrap, recoveryWrap });
      record.sealedWith = sealer;
    },
    async updateVault(userId, wraps) {
      vaults.set(userId, { ...vaults.get(userId), ...wraps });
    },
    async replaceVaultErasingData({ userId, passwordWrap, recoveryWrap }) {
      record.erasedFor.push(userId);
      vaults.set(userId, { userId, passwordWrap, recoveryWrap });
    },
    async findSessionKey(sessionId) {
      return sessionKeys.get(sessionId) ?? null;
    },
    async saveSessionKey(sessionKey) {
      sessionKeys.set(sessionKey.sessionId, sessionKey);
    },
    async clearPendingRecoveryCode(sessionId) {
      sessionKeys.set(sessionId, { ...sessionKeys.get(sessionId), pendingRecoveryCode: null });
    },
  };
}
