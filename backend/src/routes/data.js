// Backup and restore of stories, the personality and chats. Settings and API keys are never
// included. Imported stories and chats replace existing ones with the same id; the rest are kept.
// Imported chats whose story isn't known join the default story.
import { badRequest } from "../http/errors.js";
import { requireObject, isObject } from "../http/validate.js";
import { normalizePersonality } from "../lore/personality.js";

const EXPORT_APP_NAME = "oread";
const EXPORT_FORMAT_VERSION = 4;

function isValidChatList(chats) {
  if (!Array.isArray(chats)) {
    return false;
  }
  return chats.every((chat) => chat?.id && Array.isArray(chat.messages));
}

function isValidStory(story) {
  if (!isObject(story) || !story.id || typeof story.title !== "string") {
    return false;
  }
  const listFields = ["characters", "worldNotes", "worldState"];
  return listFields.every((field) => Array.isArray(story[field]));
}

function isValidStoryList(stories) {
  return Array.isArray(stories) && stories.every(isValidStory);
}

function checkImport(data) {
  if (data.app !== EXPORT_APP_NAME) {
    throw badRequest("That file isn't an Oread export.");
  }
  if (!isValidChatList(data.chats ?? [])) {
    throw badRequest("chats must be a list of chats, each with an id and messages.", {
      field: "chats",
    });
  }
  if (!isValidStoryList(data.stories ?? [])) {
    throw badRequest("stories must be a list of stories, each with an id, title and cast.", {
      field: "stories",
    });
  }
}

export function dataRoutes(router, services) {
  const { lore, storage, migration, personality, now = () => new Date() } = services;
  const { storyRepository, chatRepository } = storage;

  router.get("/export", async () => {
    await migration.ensureMigrated();
    return {
      app: EXPORT_APP_NAME,
      version: EXPORT_FORMAT_VERSION,
      exported: now().toISOString(),
      personality: await personality.get(),
      stories: await storyRepository.listStories(),
      chats: await chatRepository.listChats(),
    };
  });

  router.post("/import", async ({ body }) => {
    const data = requireObject(await body());
    checkImport(data);
    await migration.ensureMigrated();
    const importedStories = data.stories ?? [];
    const importedChats = data.chats ?? [];
    await storyRepository.saveStories(importedStories);
    // Older exports held a list of personas; the first one becomes the personality.
    const importedPersonality = data.personality || data.personas?.[0];
    if (importedPersonality) {
      await personality.set(normalizePersonality(lore, importedPersonality));
    }
    await chatRepository.saveChats(importedChats);
    await migration.runAgain();
    return {
      imported: {
        personality: Boolean(importedPersonality),
        stories: importedStories.length,
        chats: importedChats.length,
      },
    };
  });
}
