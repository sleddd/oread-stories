// Moves a local Oread's data (the JSON documents in backend/data) into one account's storage.
// The documents are only read. Stories and chats are added or replaced by id, so running it
// again gives the same result. Memory-search vectors come along for the entries that still
// exist; saved settings, including provider keys, are written through the account's settings
// store (which encrypts the keys when hosted).
import { migrateToStories } from "../stories/storyMigration.js";

function memoryEntryIdsOf(stories) {
  const entryIds = new Set();
  for (const story of stories) {
    for (const character of story.characters ?? []) {
      for (const entry of character.memory ?? []) {
        entryIds.add(entry.id);
      }
    }
  }
  return entryIds;
}

function isUsableVector(record) {
  return typeof record?.textHash === "string" && Array.isArray(record.vector);
}

function vectorsForEntries(memoryIndex, entryIds) {
  const vectorsById = {};
  for (const [entryId, record] of Object.entries(memoryIndex ?? {})) {
    if (entryIds.has(entryId) && isUsableVector(record)) {
      vectorsById[entryId] = record;
    }
  }
  return vectorsById;
}

// `documents` holds what was read from disk: { stories, chats, personality, memoryIndex,
// settings }, each possibly missing. Returns what to write.
export function prepareLocalImport({ lore, documents, now, newId }) {
  const { stories, chats } = migrateToStories({
    lore,
    stories: documents.stories ?? [],
    chats: documents.chats ?? [],
    oldPersonality: documents.personality ?? null,
    timestamp: now(),
    newId,
  });
  return {
    stories,
    chats,
    vectorsById: vectorsForEntries(documents.memoryIndex, memoryEntryIdsOf(stories)),
    settings: documents.settings ?? null,
  };
}

// Writes prepared data into `storage` (tenancy/databaseStorage.js or documentStorage.js).
export async function importLocalData({ storage, prepared }) {
  await storage.storyRepository.saveStories(prepared.stories);
  await storage.chatRepository.saveChats(prepared.chats);
  const vectorCount = Object.keys(prepared.vectorsById).length;
  if (vectorCount) {
    await storage.vectorStore.save(prepared.vectorsById);
  }
  if (prepared.settings) {
    await storage.settingsStore.write(prepared.settings);
  }
  await storage.migration.runAgain();
  return {
    stories: prepared.stories.length,
    chats: prepared.chats.length,
    memoryVectors: vectorCount,
    settings: Boolean(prepared.settings),
  };
}
