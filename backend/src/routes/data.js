// Backup and restore of stories, the personality and chats. Settings and API keys are never
// included. Imported stories and chats replace existing ones with the same id; the rest are kept.
// Imported chats whose story isn't known join the default story.
import { badRequest } from "../http/errors.js";
import { requireObject, isObject } from "../http/validate.js";
import { normalizePersonality } from "../lore/personality.js";

const EXPORT_APP_NAME = "oread";
const EXPORT_FORMAT_VERSION = 4;
// Ids, story ids and titles become database columns, so they must be plain, short strings.
const MAX_IMPORTED_ID_LENGTH = 200;
const MAX_IMPORTED_TITLE_LENGTH = 500;

function isShortString(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength;
}

function isValidId(value) {
  return isShortString(value, MAX_IMPORTED_ID_LENGTH) && value.trim() !== "";
}

function isOptionalShortString(value, maxLength) {
  return value === undefined || value === null || isShortString(value, maxLength);
}

function isValidChat(chat) {
  if (!isObject(chat) || !isValidId(chat.id) || !Array.isArray(chat.messages)) {
    return false;
  }
  const hasValidStoryId = isOptionalShortString(chat.storyId, MAX_IMPORTED_ID_LENGTH);
  return hasValidStoryId && isOptionalShortString(chat.title, MAX_IMPORTED_TITLE_LENGTH);
}

function isValidChatList(chats) {
  return Array.isArray(chats) && chats.every(isValidChat);
}

function isValidStory(story) {
  if (!isObject(story) || !isValidId(story.id)) {
    return false;
  }
  if (!isShortString(story.title, MAX_IMPORTED_TITLE_LENGTH)) {
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
