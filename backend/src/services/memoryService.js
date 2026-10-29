// A character's memory as the user sees it in the memory editor: list, write, edit, delete and
// search by meaning. Identity and thread entries are one per character; writing another
// rewrites the existing one in place.
import { randomUUID } from "node:crypto";
import { notFound, HttpError } from "../http/errors.js";
import { newMemoryEntry } from "../stories/factories.js";
import { SINGLE_MEMORY_KINDS } from "../stories/limits.js";
import { findCharacterIn } from "./characterRecords.js";

const USER_SOURCE = "user";

function findEntryIn(character, entryId) {
  const entry = character.memory.find((candidate) => candidate.id === entryId);
  if (!entry) {
    throw notFound(`There is no memory "${entryId}" for this character.`);
  }
  return entry;
}

function existingSingleEntry(character, kind) {
  if (!SINGLE_MEMORY_KINDS.includes(kind)) {
    return null;
  }
  return character.memory.find((entry) => entry.kind === kind) ?? null;
}

// An edit keeps the entry's source, so it still shows which chat and turn it came from.
function rewriteEntry(entry, changes, timestamp) {
  Object.assign(entry, changes, { updated: timestamp });
}

function searchUnavailable() {
  return new HttpError(503, "search_unavailable", "Memory search isn't available right now.");
}

export function createMemoryService({
  storyRepository,
  memoryIndex,
  now = Date.now,
  newId = randomUUID,
}) {
  async function findCharacter(storyId, characterId) {
    const story = await storyRepository.findStory(storyId);
    return findCharacterIn(story, characterId);
  }

  async function list(storyId, characterId) {
    return (await findCharacter(storyId, characterId)).memory;
  }

  // Returns { entry, isNew }: isNew is false when an identity or thread entry was rewritten.
  async function create(storyId, characterId, input) {
    const timestamp = now();
    return storyRepository.updateStory(storyId, (story) => {
      const character = findCharacterIn(story, characterId);
      const existing = existingSingleEntry(character, input.kind);
      if (existing) {
        rewriteEntry(existing, { ...input, source: USER_SOURCE }, timestamp);
        return { entry: existing, isNew: false };
      }
      const entry = newMemoryEntry({ id: newId(), input, source: USER_SOURCE, timestamp });
      character.memory.push(entry);
      return { entry, isNew: true };
    });
  }

  async function update(storyId, characterId, entryId, changes) {
    const timestamp = now();
    return storyRepository.updateStory(storyId, (story) => {
      const entry = findEntryIn(findCharacterIn(story, characterId), entryId);
      rewriteEntry(entry, changes, timestamp);
      return entry;
    });
  }

  async function remove(storyId, characterId, entryId) {
    await storyRepository.updateStory(storyId, (story) => {
      const character = findCharacterIn(story, characterId);
      findEntryIn(character, entryId);
      character.memory = character.memory.filter((entry) => entry.id !== entryId);
    });
    await memoryIndex.forget([entryId]);
  }

  // Returns [{ entry, score }], most similar first.
  async function search(storyId, characterId, { query, limit }) {
    if (!memoryIndex.isAvailable()) {
      throw searchUnavailable();
    }
    const character = await findCharacter(storyId, characterId);
    try {
      return await memoryIndex.search({ entries: character.memory, query, limit });
    } catch {
      throw searchUnavailable();
    }
  }

  return { list, create, update, remove, search };
}
