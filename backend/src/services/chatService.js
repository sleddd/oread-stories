// Chats: creating, listing, renaming and deleting them, editing their transcript, and
// writing replies (see replyGenerator.js).
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../http/errors.js";
import { profileOf } from "../lore/shift.js";
import { buildContext, estimateTokens } from "./context.js";
import { createChatRepository } from "./chatRepository.js";
import { createChatDescriber, summarizeChat } from "./chatView.js";
import { createReplyGenerator } from "./replyGenerator.js";

const MAX_TITLE_LENGTH = 120;
const DEFAULT_CHAT_TITLE = "New chat";
const RENAMED_FALLBACK_TITLE = "Untitled";

function findMessageIndex(chat, messageId) {
  const index = chat.messages.findIndex((message) => message.id === messageId);
  if (index < 0) {
    throw notFound(`There is no message "${messageId}" in this chat.`);
  }
  return index;
}

function cleanTitle(title, fallbackTitle) {
  return title.trim().slice(0, MAX_TITLE_LENGTH) || fallbackTitle;
}

function switchVersion(message, alt) {
  const versionCount = message.alts?.length || 1;
  if (!message.alts || alt < 0 || alt >= message.alts.length) {
    throw badRequest(`alt must be between 0 and ${versionCount - 1}.`, { field: "alt" });
  }
  message.alt = alt;
  message.content = message.alts[alt];
}

function replaceContent(message, content) {
  message.content = content;
  if (message.alts) {
    message.alts[message.alt] = content;
  }
  delete message.error;
}

function newestFirst(first, second) {
  return second.updated - first.updated;
}

export function createChatService({
  lore,
  store,
  personality,
  settings,
  models,
  now = Date.now,
  newId = randomUUID,
}) {
  const streamingChatIds = new Set();
  const repository = createChatRepository({ store, now });
  const describeChat = createChatDescriber({ lore, personality, settings, streamingChatIds });
  const generateReply = createReplyGenerator({
    lore,
    repository,
    personality,
    settings,
    models,
    describeChat,
    streamingChatIds,
    now,
    newId,
  });

  function refuseWhileStreaming(chatId, message) {
    if (streamingChatIds.has(chatId)) {
      throw conflict(message);
    }
  }

  async function list() {
    const chats = await repository.listChats();
    return chats.sort(newestFirst).map(summarizeChat);
  }

  async function get(chatId) {
    return describeChat(await repository.findChat(chatId));
  }

  async function create({ title } = {}) {
    const currentPersonality = await personality.get();
    const createdAt = now();
    const chat = {
      id: newId(),
      title: cleanTitle(title || "", DEFAULT_CHAT_TITLE),
      messages: [],
      profile: profileOf(currentPersonality),
      created: createdAt,
      updated: createdAt,
    };
    await repository.addChat(chat);
    return describeChat(chat);
  }

  async function rename(chatId, title) {
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      chatToChange.title = cleanTitle(title, RENAMED_FALLBACK_TITLE);
    });
    return describeChat(chat);
  }

  async function remove(chatId) {
    refuseWhileStreaming(chatId, "Stop the reply before deleting this chat.");
    await repository.removeChat(chatId);
  }

  async function editMessage(chatId, messageId, { content, alt }) {
    refuseWhileStreaming(chatId, "Wait for the reply to finish first.");
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      const message = chatToChange.messages[findMessageIndex(chatToChange, messageId)];
      if (alt !== undefined) {
        switchVersion(message, alt);
      }
      if (content !== undefined) {
        replaceContent(message, content);
      }
    });
    return describeChat(chat);
  }

  async function deleteMessage(chatId, messageId) {
    refuseWhileStreaming(chatId, "Wait for the reply to finish first.");
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      chatToChange.messages.splice(findMessageIndex(chatToChange, messageId), 1);
    });
    return describeChat(chat);
  }

  // Exactly what the model would receive if the user sent `draft` now.
  async function context(chatId, draft = "") {
    const chat = await repository.findChat(chatId);
    const currentPersonality = await personality.get();
    const savedSettings = await settings.load();
    const modelContext = buildContext(lore, currentPersonality, chat.messages, {
      historyWindow: savedSettings.memory.historyWindow,
      draft,
    });
    const systemTokens = estimateTokens(modelContext.system);
    let messageTokens = 0;
    for (const message of modelContext.messages) {
      messageTokens += estimateTokens(message.content);
    }
    return {
      provider: savedSettings.provider,
      model: savedSettings[savedSettings.provider]?.model || "",
      system: modelContext.system,
      messages: modelContext.messages,
      estimate: {
        system: systemTokens,
        messages: messageTokens,
        total: systemTokens + messageTokens,
      },
    };
  }

  // Puts the dials back where they were at this chat's last reply.
  async function undoShift(chatId) {
    const chat = await repository.findChat(chatId);
    if (!chat.profile) {
      throw badRequest("This chat has no earlier personality to go back to.");
    }
    return personality.restoreProfile(chat.profile);
  }

  function send(chatId, content, { signal } = {}) {
    return generateReply(chatId, { content, signal });
  }

  function reply(chatId, { signal } = {}) {
    return generateReply(chatId, { signal });
  }

  return {
    list,
    get,
    create,
    rename,
    remove,
    editMessage,
    deleteMessage,
    context,
    undoShift,
    send,
    reply,
  };
}
