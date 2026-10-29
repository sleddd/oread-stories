// Wires the services together. Each service gets only the collaborators it needs.
import { createSettingsService } from "./settingsService.js";
import { createPersonalityService } from "./personalityService.js";
import { createModelService } from "./modelService.js";
import { createChatService } from "./chatService.js";

export function createServices({ lore, store, providers, env, random, now, newId }) {
  const settings = createSettingsService({ store, env });
  const personality = createPersonalityService({ lore, store, random });
  const models = createModelService({ settings, providers });
  const chats = createChatService({ lore, store, personality, settings, models, now, newId });
  return { lore, store, settings, personality, models, chats };
}
