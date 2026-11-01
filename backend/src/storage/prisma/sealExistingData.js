// The one-time move of an account's plain rows into sealed ones, run inside the transaction that
// creates the user's vault. Rows that are already sealed are left alone, so running it again is
// harmless. Title columns are blanked: the titles live inside the sealed rows.
import { isSealed } from "../../security/sealedJson.js";
import { storyPlace } from "./prismaStoryRepository.js";
import { chatPlace } from "./prismaChatRepository.js";
import { vectorPlace } from "./prismaVectorStore.js";
import { SETTINGS_PLACE } from "./prismaSettingsStore.js";

function secretContext(userId, provider, field) {
  return `${userId}:${provider}:${field}`;
}

async function sealStories({ transaction, userId, sealer }) {
  const rows = await transaction.story.findMany({
    where: { userId },
    select: { id: true, data: true },
  });
  const plainRows = rows.filter((row) => !isSealed(row.data));
  for (const row of plainRows) {
    await transaction.story.update({
      where: { userId_id: { userId, id: row.id } },
      data: { title: "", data: sealer.seal(row.data, storyPlace(row.id)) },
    });
  }
}

async function sealChats({ transaction, userId, sealer }) {
  const rows = await transaction.chat.findMany({
    where: { userId },
    select: { id: true, data: true },
  });
  const plainRows = rows.filter((row) => !isSealed(row.data));
  for (const row of plainRows) {
    await transaction.chat.update({
      where: { userId_id: { userId, id: row.id } },
      data: { title: "", data: sealer.seal(row.data, chatPlace(row.id)) },
    });
  }
}

async function sealSettings({ transaction, userId, sealer }) {
  const row = await transaction.userSettings.findUnique({ where: { userId } });
  if (!row || isSealed(row.data)) {
    return;
  }
  await transaction.userSettings.update({
    where: { userId },
    data: { data: sealer.seal(row.data, SETTINGS_PLACE) },
  });
}

// Provider keys move from the server's key to the user's data key.
async function reencryptProviderKeys({ transaction, userId, sealer, legacyCipher }) {
  const rows = await transaction.providerSecret.findMany({ where: { userId } });
  for (const row of rows) {
    const context = secretContext(userId, row.provider, row.field);
    const plainKey = legacyCipher.decrypt(row, context);
    await transaction.providerSecret.update({
      where: { userId_provider_field: { userId, provider: row.provider, field: row.field } },
      data: sealer.cipher.encrypt(plainKey, context),
    });
  }
}

async function sealVectors({ transaction, userId, sealer }) {
  const rows = await transaction.memoryEmbedding.findMany({ where: { userId } });
  const plainRows = rows.filter((row) => !row.sealedVector);
  for (const row of plainRows) {
    await transaction.memoryEmbedding.update({
      where: { userId_entryId: { userId, entryId: row.entryId } },
      data: { vector: [], sealedVector: sealer.seal(row.vector, vectorPlace(row.entryId)) },
    });
  }
}

export async function sealExistingData({ transaction, userId, sealer, legacyCipher }) {
  await sealStories({ transaction, userId, sealer });
  await sealChats({ transaction, userId, sealer });
  await sealSettings({ transaction, userId, sealer });
  await reencryptProviderKeys({ transaction, userId, sealer, legacyCipher });
  await sealVectors({ transaction, userId, sealer });
}

// Everything the account holds, for starting over without the recovery code.
export async function eraseUserData({ transaction, userId }) {
  await transaction.chat.deleteMany({ where: { userId } });
  await transaction.story.deleteMany({ where: { userId } });
  await transaction.userSettings.deleteMany({ where: { userId } });
  await transaction.providerSecret.deleteMany({ where: { userId } });
  await transaction.memoryEmbedding.deleteMany({ where: { userId } });
}
