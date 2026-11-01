// Where the vault keeps its keys in the database: each user's wrapped data key (user_vault) and
// each unlocked session's copy (session_key). Creating a vault seals the user's existing rows
// in the same transaction, and the vault row is written first, so two first sign-ins at once
// can't each seal with a different key: the second fails on the vault row and changes nothing.
import { sealExistingData, eraseUserData } from "./sealExistingData.js";

// Sealing a long-used account rewrites every row it has; give it room.
const SEALING_TIMEOUT_MILLISECONDS = 120_000;

export function createPrismaVaultStore({ prisma, legacyCipher }) {
  async function findVault(userId) {
    return prisma.userVault.findUnique({ where: { userId } });
  }

  // Writes a brand-new vault and seals everything the user already had with `sealer`.
  async function createVaultAndSealData({ userId, passwordWrap, recoveryWrap, sealer }) {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.userVault.create({ data: { userId, passwordWrap, recoveryWrap } });
        await sealExistingData({ transaction, userId, sealer, legacyCipher });
      },
      { timeout: SEALING_TIMEOUT_MILLISECONDS },
    );
  }

  async function updateVault(userId, wraps) {
    await prisma.userVault.update({ where: { userId }, data: wraps });
  }

  // Starting over: every story, chat, setting, provider key and vector goes, then the new vault
  // takes the old one's place. The account itself stays.
  async function replaceVaultErasingData({ userId, passwordWrap, recoveryWrap }) {
    await prisma.$transaction(async (transaction) => {
      await eraseUserData({ transaction, userId });
      await transaction.userVault.deleteMany({ where: { userId } });
      await transaction.sessionKey.deleteMany({ where: { userId } });
      await transaction.userVault.create({ data: { userId, passwordWrap, recoveryWrap } });
    });
  }

  async function findSessionKey(sessionId) {
    return prisma.sessionKey.findUnique({ where: { sessionId } });
  }

  async function saveSessionKey({ sessionId, userId, sealedDataKey, pendingRecoveryCode = null }) {
    const columns = { userId, sealedDataKey, pendingRecoveryCode };
    await prisma.sessionKey.upsert({
      where: { sessionId },
      create: { sessionId, ...columns },
      update: columns,
    });
  }

  async function clearPendingRecoveryCode(sessionId) {
    await prisma.sessionKey.updateMany({
      where: { sessionId },
      data: { pendingRecoveryCode: null },
    });
  }

  return {
    findVault,
    createVaultAndSealData,
    updateVault,
    replaceVaultErasingData,
    findSessionKey,
    saveSessionKey,
    clearPendingRecoveryCode,
  };
}
