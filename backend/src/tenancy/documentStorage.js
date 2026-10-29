// Everything one user's services need to keep their data, built on a JSON document store: the
// local file store (one person, no login) or the in-memory store tests use. The hosted version,
// with the same shape, is databaseStorage.js.
import { createStoryMigrationRunner } from "../services/storyMigrationRunner.js";
import { createStoryRepository } from "../services/storyRepository.js";
import { createChatRepository } from "../services/chatRepository.js";
import { createDocumentSettingsStore } from "../services/settingsService.js";
import { createStreamingGuard } from "../services/streamingGuard.js";
import { createDocumentVectorStore } from "../memory/memoryIndex.js";

export function createDocumentStorage({ lore, store, now, newId }) {
  const migration = createStoryMigrationRunner({ lore, store, now, newId });
  return {
    migration,
    storyRepository: createStoryRepository({ store, migration, now }),
    chatRepository: createChatRepository({ store, migration, now }),
    vectorStore: createDocumentVectorStore(store),
    settingsStore: createDocumentSettingsStore(store),
    streamingGuard: createStreamingGuard(),
  };
}
