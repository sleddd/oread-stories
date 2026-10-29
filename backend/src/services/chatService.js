// Chats: creating, listing, changing and deleting them, editing their transcript, and
// writing replies (see replyGenerator.js). Every chat belongs to a story; its AI characters
// speak in it.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../http/errors.js";
import { profileOf } from "../lore/shift.js";
import { estimateTokens } from "./context.js";
import { createChatDescriber, summarizeChat } from "./chatView.js";
import { createReplyGenerator } from "./replyGenerator.js";
import { createStoryEngineService } from "./storyEngineService.js";
import { createTurnPrompt } from "./turnPrompt.js";
import { createStreamingGuard } from "./streamingGuard.js";
import { createTurnNotes } from "./turnNotes.js";
import { joinStory, aiCharacterIds } from "../stories/storyMigration.js";
import { emptyScene, openingNarration } from "../stories/factories.js";
import { DEFAULT_STORY_ID } from "../stories/limits.js";
import { personalityOfCharacter } from "../stories/characterPersonality.js";
import { speakingCharacterId } from "../stories/chatEngines.js";
import { profileFor } from "../stories/chatProfiles.js";
import { predictSpeaker } from "../stories/predictSpeaker.js";

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

// Where each AI character's dials stand as a chat starts, so the first scene that moves them
// shows as a shift.
function startingProfiles(lore, story) {
  const profiles = {};
  for (const character of story.characters) {
    if (character.role === "ai") {
      profiles[character.id] = profileOf(personalityOfCharacter(lore, character));
    }
  }
  return profiles;
}

// Present characters must be AI characters of the chat's story; the player is always there.
function checkPresentCharacters(story, presentCharacterIds) {
  const storyAiCharacterIds = aiCharacterIds(story);
  for (const characterId of presentCharacterIds) {
    if (!storyAiCharacterIds.includes(characterId)) {
      throw badRequest(`"${characterId}" isn't an AI character in this story.`, {
        field: "presentCharacterIds",
      });
    }
  }
}

function applyChatChanges(chat, changes) {
  if (changes.title !== undefined) {
    chat.title = cleanTitle(changes.title, RENAMED_FALLBACK_TITLE);
  }
  if (changes.presentCharacterIds !== undefined) {
    chat.presentCharacterIds = changes.presentCharacterIds;
  }
  if (changes.scene !== undefined) {
    chat.scene = changes.scene;
  }
}

export function createChatService({
  lore,
  repository,
  storyRepository,
  characterPersonalities,
  memoryIndex,
  settings,
  models,
  storyConfig,
  appraiser,
  streamingGuard = createStreamingGuard(),
  now = Date.now,
  newId = randomUUID,
}) {
  let storyEngine = null;
  if (storyConfig) {
    storyEngine = createStoryEngineService({
      lore,
      storyConfig,
      appraiser,
      settings,
      repository,
      storyRepository,
      characterPersonalities,
      now,
    });
  }
  const describeChat = createChatDescriber({
    lore,
    storyRepository,
    settings,
    storyEngine,
    streamingGuard,
  });
  const turnPrompt = createTurnPrompt({ lore, storyEngine, memoryIndex });
  const turnNotes = createTurnNotes({ storyRepository, repository, memoryIndex, now, newId });
  const generateReply = createReplyGenerator({
    lore,
    repository,
    storyRepository,
    settings,
    models,
    storyEngine,
    turnPrompt,
    turnNotes,
    describeChat,
    streamingGuard,
    now,
    newId,
  });

  // A chat in a story with an opening scene starts with it, so the first reply has a scene to
  // answer.
  function openingMessages(story) {
    const openingScene = story.openingScene?.trim();
    if (!openingScene) {
      return [];
    }
    return [openingNarration({ id: newId(), text: openingScene, timestamp: now() })];
  }

  function refuseWhileStreaming(chatId, message) {
    if (streamingGuard.isStreaming(chatId)) {
      throw conflict(message);
    }
  }

  async function list() {
    const chats = await repository.listChats();
    return chats.sort(newestFirst).map(summarizeChat);
  }

  async function listForStory(storyId) {
    await storyRepository.findStory(storyId);
    const chats = await repository.listChats();
    const storyChats = chats.filter((chat) => chat.storyId === storyId);
    return storyChats.sort(newestFirst).map(summarizeChat);
  }

  async function get(chatId) {
    return describeChat(await repository.findChat(chatId));
  }

  // New chats join the default story unless another is named.
  async function create({ title, storyId = DEFAULT_STORY_ID } = {}) {
    const story = await storyRepository.findStory(storyId);
    const createdAt = now();
    const chat = joinStory(
      {
        id: newId(),
        title: cleanTitle(title || "", DEFAULT_CHAT_TITLE),
        messages: openingMessages(story),
        profiles: startingProfiles(lore, story),
        created: createdAt,
        updated: createdAt,
      },
      story,
    );
    await repository.addChat(chat);
    return describeChat(chat);
  }

  // `changes` holds any of title, presentCharacterIds and scene, already validated in shape.
  async function update(chatId, changes) {
    if (changes.presentCharacterIds !== undefined) {
      const existingChat = await repository.findChat(chatId);
      const story = await storyRepository.findStory(existingChat.storyId);
      checkPresentCharacters(story, changes.presentCharacterIds);
    }
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      applyChatChanges(chatToChange, changes);
    });
    return describeChat(chat);
  }

  async function rename(chatId, title) {
    return update(chatId, { title });
  }

  // Empties a chat so its story starts over: only the opening scene (if the story has one), its
  // original title, an empty scene and fresh story-engine state. The personality's dials and the characters' memories are left as
  // they are.
  async function clear(chatId) {
    refuseWhileStreaming(chatId, "Stop the reply before clearing this chat.");
    const existingChat = await repository.findChat(chatId);
    const story = await storyRepository.findStory(existingChat.storyId);
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      chatToChange.messages = openingMessages(story);
      chatToChange.title = DEFAULT_CHAT_TITLE;
      chatToChange.profiles = startingProfiles(lore, story);
      delete chatToChange.profile;
      chatToChange.engines = {};
      chatToChange.scene = emptyScene();
      chatToChange.lastSpeakerId = chatToChange.presentCharacterIds[0] ?? null;
      chatToChange.turnLog = [];
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

  // Exactly what the model would receive if the user sent `draft` now: the request for the
  // character expected to answer it.
  async function context(chatId, draft = "") {
    const chat = await repository.findChat(chatId);
    const story = await storyRepository.findStory(chat.storyId);
    const savedSettings = await settings.load();
    const speaker = predictSpeaker({ story, chat, newestMessage: draft });
    const request = await turnPrompt.build({
      story,
      chat,
      speaker,
      messages: chat.messages,
      historyWindow: savedSettings.memory.historyWindow,
      draft,
    });
    const systemTokens = estimateTokens(request.system);
    let messageTokens = 0;
    for (const message of request.messages) {
      messageTokens += estimateTokens(message.content);
    }
    return {
      provider: savedSettings.provider,
      model: savedSettings[savedSettings.provider]?.model || "",
      speakerId: speaker?.id ?? null,
      system: request.system,
      messages: request.messages,
      estimate: {
        system: systemTokens,
        messages: messageTokens,
        total: systemTokens + messageTokens,
      },
    };
  }

  // Puts the speaking character's dials back where they were at their last reply in this chat.
  async function undoShift(chatId) {
    const chat = await repository.findChat(chatId);
    const speakingId = speakingCharacterId(chat);
    const profile = profileFor(chat, speakingId);
    if (!profile) {
      throw badRequest("This chat has no earlier personality to go back to.");
    }
    return characterPersonalities.forCharacter(chat.storyId, speakingId).restoreProfile(profile);
  }

  // Clears the chat's stress and scene ledger.
  async function resetEngine(chatId) {
    refuseWhileStreaming(chatId, "Wait for the reply to finish first.");
    if (!storyEngine) {
      throw badRequest("The story engine isn't available.");
    }
    return describeChat(await storyEngine.reset(chatId));
  }

  function send(chatId, content, { signal } = {}) {
    return generateReply(chatId, { content, signal });
  }

  function reply(chatId, { signal } = {}) {
    return generateReply(chatId, { signal });
  }

  // Deletes every chat in a story (the story itself is being deleted).
  async function removeAllInStory(storyId) {
    await repository.updateAllChats((chats) => {
      for (const chat of chats) {
        if (chat.storyId === storyId) {
          refuseWhileStreaming(chat.id, "Stop the reply before deleting this story.");
        }
      }
      return chats.filter((chat) => chat.storyId !== storyId);
    });
  }

  // A character left the story: it is no longer present in, or speaking in, any of its chats.
  async function forgetCharacter(storyId, characterId) {
    await repository.updateAllChats((chats) => {
      for (const chat of chats) {
        if (chat.storyId !== storyId) {
          continue;
        }
        chat.presentCharacterIds = chat.presentCharacterIds.filter(
          (presentCharacterId) => presentCharacterId !== characterId,
        );
        delete chat.engines?.[characterId];
        if (chat.lastSpeakerId === characterId) {
          chat.lastSpeakerId = chat.presentCharacterIds[0] ?? null;
        }
      }
      return chats;
    });
  }

  return {
    list,
    listForStory,
    get,
    create,
    update,
    rename,
    removeAllInStory,
    forgetCharacter,
    clear,
    remove,
    editMessage,
    deleteMessage,
    context,
    undoShift,
    resetEngine,
    send,
    reply,
  };
}
