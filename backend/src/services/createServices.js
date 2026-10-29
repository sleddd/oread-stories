// Wires one user's services together. Each service gets only the collaborators it needs.
// `storage` holds where that user's data lives (see tenancy/documentStorage.js and
// tenancy/databaseStorage.js); given only a JSON `store`, the document storage is built on it.
// The story engine is optional: without a story config and an emotion classifier, chats work
// exactly as before. Memory search is optional too: without an embedder it reports itself
// unavailable.
import { randomUUID } from "node:crypto";
import { createSettingsService } from "./settingsService.js";
import { createPersonalityService } from "./personalityService.js";
import { createModelService } from "./modelService.js";
import { createChatService } from "./chatService.js";
import { createSceneAppraiser } from "./sceneAppraiser.js";
import { createStoryService } from "./storyService.js";
import { createCastService } from "./castService.js";
import { createMemoryService } from "./memoryService.js";
import { createWorldService } from "./worldService.js";
import { createStoryTemplateService } from "./storyTemplateService.js";
import { createMemoryIndex } from "../memory/memoryIndex.js";
import { createCharacterPersonalities } from "./characterPersonalities.js";
import { createDocumentStorage } from "../tenancy/documentStorage.js";

export function createServices({
  lore,
  store,
  storage: providedStorage,
  providers,
  env,
  storyConfig,
  emotionClassifier,
  embedder,
  storyTemplates: templates = [],
  random,
  now = Date.now,
  newId = randomUUID,
  checkProviderConfig,
}) {
  const storage = providedStorage ?? createDocumentStorage({ lore, store, now, newId });
  const { migration, storyRepository, chatRepository, settingsStore, streamingGuard } = storage;
  const memoryIndex = createMemoryIndex({ vectorStore: storage.vectorStore, embedder });

  const settings = createSettingsService({ settingsStore, env, checkProviderConfig });
  const personality = createPersonalityService({ lore, storyRepository, random });
  const characterPersonalities = createCharacterPersonalities({ lore, storyRepository, random });
  const models = createModelService({ settings, providers });
  let appraiser = null;
  if (storyConfig && emotionClassifier) {
    appraiser = createSceneAppraiser({ classifier: emotionClassifier, storyConfig });
  }
  const chats = createChatService({
    lore,
    repository: chatRepository,
    storyRepository,
    characterPersonalities,
    memoryIndex,
    settings,
    models,
    storyConfig,
    appraiser,
    streamingGuard,
    now,
    newId,
  });
  const stories = createStoryService({ storyRepository, chats, memoryIndex, now, newId });
  const cast = createCastService({
    lore,
    storyRepository,
    characterPersonalities,
    chats,
    memoryIndex,
    newId,
  });
  const memory = createMemoryService({ storyRepository, memoryIndex, now, newId });
  const world = createWorldService({ storyRepository, now, newId });
  const storyTemplates = createStoryTemplateService({
    templates,
    storyRepository,
    memoryIndex,
    now,
    newId,
  });
  return {
    lore,
    storage,
    migration,
    settings,
    personality,
    models,
    chats,
    stories,
    cast,
    memory,
    world,
    storyTemplates,
  };
}
