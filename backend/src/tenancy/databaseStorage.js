// Everything one signed-in user's services need to keep their data, in the hosted database.
// Same shape as documentStorage.js; every part is scoped to `userId`, so nothing built here can
// read or change another user's rows.
import { createUserSetup } from "../storage/prisma/userSetup.js";
import { createPrismaStoryRepository } from "../storage/prisma/prismaStoryRepository.js";
import { createPrismaChatRepository } from "../storage/prisma/prismaChatRepository.js";
import { createPrismaVectorStore } from "../storage/prisma/prismaVectorStore.js";
import { createPrismaSettingsStore } from "../storage/prisma/prismaSettingsStore.js";
import { createDatabaseStreamingGuard } from "../storage/prisma/databaseStreamingGuard.js";

export function createDatabaseStorage({
  prisma,
  userId,
  lore,
  cipher,
  claimsInProcess,
  now,
  newId,
}) {
  const migration = createUserSetup({ prisma, userId, lore, now, newId });
  return {
    migration,
    storyRepository: createPrismaStoryRepository({ prisma, userId, migration, now }),
    chatRepository: createPrismaChatRepository({ prisma, userId, migration, now }),
    vectorStore: createPrismaVectorStore({ prisma, userId }),
    settingsStore: createPrismaSettingsStore({ prisma, userId, cipher }),
    streamingGuard: createDatabaseStreamingGuard({ prisma, userId, claimsInProcess }),
  };
}
