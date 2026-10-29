// Memory endpoints for the memory editor: a character's entries, user-written entries, edits,
// deletes and meaning search. Writing an identity or thread entry rewrites the existing one
// (200) instead of adding another (201).
import { created, noContent } from "../http/response.js";
import {
  readNewMemoryEntry,
  readMemoryEntryChanges,
  readMemorySearch,
} from "../stories/memoryInput.js";

const MEMORY_PATH = "/stories/:storyId/characters/:characterId/memory";

export function memoryRoutes(router, { memory }) {
  router.get(MEMORY_PATH, async ({ params }) => ({
    memory: await memory.list(params.storyId, params.characterId),
  }));

  router.post(MEMORY_PATH, async ({ params, body }) => {
    const input = readNewMemoryEntry(await body());
    const outcome = await memory.create(params.storyId, params.characterId, input);
    if (outcome.isNew) {
      return created(outcome.entry);
    }
    return outcome.entry;
  });

  // Registered before /:entryId so "search" isn't read as an entry id.
  router.get(`${MEMORY_PATH}/search`, async ({ params, query }) => {
    const search = readMemorySearch(query);
    const results = await memory.search(params.storyId, params.characterId, search);
    return { results };
  });

  router.patch(`${MEMORY_PATH}/:entryId`, async ({ params, body }) => {
    const changes = readMemoryEntryChanges(await body());
    return memory.update(params.storyId, params.characterId, params.entryId, changes);
  });

  router.delete(`${MEMORY_PATH}/:entryId`, async ({ params }) => {
    await memory.remove(params.storyId, params.characterId, params.entryId);
    return noContent();
  });
}
