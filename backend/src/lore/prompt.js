// Turns the lorebook and the current dials into the system prompt: one framing sentence,
// then each piece of lorebook text as its own line, with no section headers.
import { promptRules } from "./promptRules.js";

const FALLBACK_PERSONA_NAME = "this character";

function framingSentence(personality) {
  const personaName = personality.name || FALLBACK_PERSONA_NAME;
  return (
    "Use the following rules to guide every response as you take on the persona of " +
    `${personaName}, a character with the following ways of speaking, acting, ` +
    "and being in the world."
  );
}

export function buildPrompt(lore, personality) {
  return framingSentence(personality) + "\n\n" + promptRules(lore, personality).join("\n");
}
