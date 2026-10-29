// How chats look to API clients: a short summary for lists, and the full detail with the
// transcript, the history window, the scene, the speaking character's pending personality shift
// and story engine, and a compact turn log of what each reply changed.
import { profileOf, describeShift } from "../lore/shift.js";
import { conversationTurns, windowStart } from "./context.js";
import { engineStateOf, speakingCharacterId } from "../stories/chatEngines.js";
import { personalityOfCharacter } from "../stories/characterPersonality.js";
import { profileFor } from "../stories/chatProfiles.js";
import { presentAiCharacters } from "../stories/predictSpeaker.js";

export function summarizeChat(chat) {
  return {
    id: chat.id,
    title: chat.title,
    storyId: chat.storyId,
    created: chat.created,
    updated: chat.updated,
    messageCount: conversationTurns(chat.messages).length,
  };
}

// profileBefore is internal bookkeeping for regenerating replies; clients never see it.
function publicMessage(message) {
  const { profileBefore, ...visibleFields } = message;
  return visibleFields;
}

function describeMemoryChange(change) {
  const entry = change.after ?? change.before;
  return {
    characterId: change.characterId,
    characterName: change.characterName,
    op: change.op,
    entryId: entry.id,
    kind: entry.kind,
    text: entry.text,
  };
}

function describeWorldChange(change) {
  return { op: change.op, subject: change.subject, fact: change.after?.fact ?? "" };
}

// What each reply changed, without the before-and-after snapshots kept for undoing.
function describeTurnLog(turnLog) {
  return (turnLog ?? []).map((entry) => ({
    messageId: entry.messageId,
    turn: entry.turn,
    speakerId: entry.speakerId,
    isSceneReplaced: entry.isSceneReplaced,
    stop: entry.stop ?? null,
    updates: entry.updates,
    memory: entry.memory.map(describeMemoryChange),
    worldState: entry.worldState.map(describeWorldChange),
  }));
}

// `streamingGuard` knows which chats have a reply being written right now.
// `storyEngine` is optional; without it the chat carries no engine view.
export function createChatDescriber({
  lore,
  storyRepository,
  settings,
  storyEngine,
  streamingGuard,
}) {
  function describeEngines(story, chat) {
    const engines = {};
    for (const character of presentAiCharacters(story, chat)) {
      const personality = personalityOfCharacter(lore, character);
      engines[character.id] = storyEngine.describe(personality, engineStateOf(chat, character.id));
    }
    return engines;
  }

  return async function describeChat(chat) {
    const story = await storyRepository.findStory(chat.storyId);
    const savedSettings = await settings.load();
    const isStreaming = streamingGuard.isStreaming(chat.id);
    const speakingId = speakingCharacterId(chat);
    const speaker = story.characters.find((character) => character.id === speakingId);
    let pendingShift = null;
    let engine = null;
    let engines = {};
    if (speaker) {
      const personality = personalityOfCharacter(lore, speaker);
      if (!isStreaming) {
        pendingShift = describeShift(lore, profileFor(chat, speakingId), profileOf(personality));
      }
      if (storyEngine) {
        engine = storyEngine.describe(personality, engineStateOf(chat, speakingId));
        engines = describeEngines(story, chat);
      }
    }
    return {
      ...summarizeChat(chat),
      presentCharacterIds: chat.presentCharacterIds,
      lastSpeakerId: chat.lastSpeakerId,
      scene: chat.scene,
      messages: chat.messages.map(publicMessage),
      windowStart: windowStart(chat.messages.length, savedSettings.memory.historyWindow),
      pendingShift,
      streaming: isStreaming,
      engine,
      engines,
      turnLog: describeTurnLog(chat.turnLog),
    };
  };
}
