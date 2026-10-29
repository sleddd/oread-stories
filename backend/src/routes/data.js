// Backup and restore of the personality and chats. Settings and API keys are never included.
import { badRequest } from "../http/errors.js";
import { requireObject } from "../http/validate.js";
import { normalizePersonality } from "../lore/personality.js";

const EXPORT_APP_NAME = "oread";
const EXPORT_FORMAT_VERSION = 3;

function isValidChatList(chats) {
  if (!Array.isArray(chats)) {
    return false;
  }
  return chats.every((chat) => chat?.id && Array.isArray(chat.messages));
}

// Imported chats replace existing chats with the same id; the rest are kept.
function mergeChats(existingChats, importedChats) {
  const chatsById = new Map(existingChats.map((chat) => [chat.id, chat]));
  for (const chat of importedChats) {
    chatsById.set(chat.id, chat);
  }
  return [...chatsById.values()];
}

export function dataRoutes(router, { lore, store, now = () => new Date() }) {
  router.get("/export", async () => ({
    app: EXPORT_APP_NAME,
    version: EXPORT_FORMAT_VERSION,
    exported: now().toISOString(),
    personality: await store.read("personality"),
    chats: await store.read("chats", []),
  }));

  router.post("/import", async ({ body }) => {
    const data = requireObject(await body());
    if (data.app !== EXPORT_APP_NAME) {
      throw badRequest("That file isn't an Oread export.");
    }
    const importedChats = data.chats ?? [];
    if (!isValidChatList(importedChats)) {
      throw badRequest("chats must be a list of chats, each with an id and messages.", {
        field: "chats",
      });
    }
    // Older exports held a list of personas; the first one becomes the personality.
    const importedPersonality = data.personality || data.personas?.[0];
    if (importedPersonality) {
      await store.write("personality", normalizePersonality(lore, importedPersonality));
    }
    await store.update("chats", [], (existingChats) => mergeChats(existingChats, importedChats));
    return {
      imported: { personality: Boolean(importedPersonality), chats: importedChats.length },
    };
  });
}
