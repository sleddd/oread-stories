// What a model request contains: the lorebook prompt plus the most recent turns of the
// conversation.
import { buildPrompt } from "../lore/prompt.js";

const DEFAULT_HISTORY_WINDOW = 24;
const MIN_HISTORY_WINDOW = 2;
const CHARACTERS_PER_TOKEN = 4;

// The opening scene of a story, written into a new chat as narration rather than a reply.
export const NARRATION_ROLE = "narration";

// Shift markers and other transcript-only entries are never sent to the model.
export function conversationTurns(messages) {
  return messages.filter((message) => message.role === "user" || message.role === "assistant");
}

// What the model sees of the transcript: the conversation plus narration. Narration isn't a
// turn anyone can reply to or regenerate, so conversationTurns leaves it out.
export function workingMemoryEntries(messages) {
  return messages.filter((message) => {
    return message.role === NARRATION_ROLE || conversationTurns([message]).length > 0;
  });
}

// Index of the first transcript entry inside the history window.
export function windowStart(messageCount, historyWindow) {
  const windowSize = Math.max(MIN_HISTORY_WINDOW, Number(historyWindow) || DEFAULT_HISTORY_WINDOW);
  return Math.max(0, messageCount - windowSize);
}

// A rough token count, good enough for showing the user how big a request is.
export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / CHARACTERS_PER_TOKEN);
}

export function buildContext(lore, personality, messages, { historyWindow, draft = "" } = {}) {
  const start = windowStart(messages.length, historyWindow);
  const turnsInWindow = conversationTurns(messages.slice(start));
  const turns = turnsInWindow.map(({ role, content }) => ({ role, content }));
  if (draft.trim()) {
    turns.push({ role: "user", content: draft.trim() });
  }
  return { system: buildPrompt(lore, personality), messages: turns, start };
}
