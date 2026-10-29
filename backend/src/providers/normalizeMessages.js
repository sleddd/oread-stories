// Providers disagree on edge cases, so every adapter gets the same clean transcript:
// no empty turns, strictly alternating roles, and a user turn first.
const SCENE_OPENER = "(The scene begins.)";
const TURN_SEPARATOR = "\n\n";

function isConversationRole(role) {
  return role === "user" || role === "assistant";
}

export function normalizeMessages(messages) {
  const normalized = [];
  for (const message of messages || []) {
    const content = String(message.content ?? "").trim();
    if (!content || !isConversationRole(message.role)) {
      continue;
    }
    const previous = normalized[normalized.length - 1];
    if (previous && previous.role === message.role) {
      previous.content += TURN_SEPARATOR + content;
    } else {
      normalized.push({ role: message.role, content });
    }
  }
  if (!normalized.length || normalized[0].role !== "user") {
    normalized.unshift({ role: "user", content: SCENE_OPENER });
  }
  return normalized;
}
