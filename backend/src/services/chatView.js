// How chats look to API clients: a short summary for lists, and the full detail with the
// transcript, the history window and any pending personality shift.
import { profileOf, describeShift } from "../lore/shift.js";
import { conversationTurns, windowStart } from "./context.js";

export function summarizeChat(chat) {
  return {
    id: chat.id,
    title: chat.title,
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

// `streamingChatIds` holds the ids of chats with a reply being written right now.
export function createChatDescriber({ lore, personality, settings, streamingChatIds }) {
  return async function describeChat(chat) {
    const currentPersonality = await personality.get();
    const savedSettings = await settings.load();
    const isStreaming = streamingChatIds.has(chat.id);
    let pendingShift = null;
    if (!isStreaming) {
      pendingShift = describeShift(lore, chat.profile, profileOf(currentPersonality));
    }
    return {
      ...summarizeChat(chat),
      messages: chat.messages.map(publicMessage),
      windowStart: windowStart(chat.messages.length, savedSettings.memory.historyWindow),
      pendingShift,
      streaming: isStreaming,
    };
  };
}
