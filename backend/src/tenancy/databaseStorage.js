// Everything one signed-in user's services need to keep their data, in the hosted database.
// Same shape as documentStorage.js; every part is scoped to `userId`, so nothing built here can
// read or change another user's rows, and everything it writes is sealed with that user's key.
import { createUserSetup } from "../storage/prisma/userSetup.js";
import { createPrismaStoryRepository } from "../storage/prisma/prismaStoryRepository.js";
import { createPrismaChatRepository } from "../storage/prisma/prismaChatRepository.js";
import { createPrismaVectorStore } from "../storage/prisma/prismaVectorStore.js";
import { createPrismaSettingsStore } from "../storage/prisma/prismaSettingsStore.js";
import { createDatabaseStreamingGuard } from "../storage/prisma/databaseStreamingGuard.js";
import { createSealer } from "../security/sealedJson.js";

// `dataKey` is the user's data key, unlocked for this request (security/userVault.js); every row
// is sealed with it. `cipher` is the server's key, kept only to read provider keys saved before
// data keys existed.
export function createDatabaseStorage({
  prisma,
  userId,
  dataKey,
  lore,
  cipher,
  claimsInProcess,
  now,
  newId,
}) {
  const sealer = createSealer({ userId, dataKey });
  const migration = createUserSetup({ prisma, userId, lore, now, newId, sealer });
  return {
    migration,
    storyRepository: createPrismaStoryRepository({ prisma, userId, migration, now, sealer }),
    chatRepository: createPrismaChatRepository({ prisma, userId, migration, now, sealer }),
    vectorStore: createPrismaVectorStore({ prisma, userId, sealer }),
    settingsStore: createPrismaSettingsStore({ prisma, userId, sealer, legacyCipher: cipher }),
    streamingGuard: createDatabaseStreamingGuard({ prisma, userId, claimsInProcess }),
  };
}
