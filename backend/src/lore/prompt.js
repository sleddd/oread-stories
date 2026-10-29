// Turns the lorebook and the current dials into the system prompt: a roleplay preamble that keeps
// the model in character and talking like a person, then each piece of lorebook text as its own
// line, with no section headers.
import { promptRules } from "./promptRules.js";

const FALLBACK_PERSONA_NAME = "this character";

const CHARACTER_INTRODUCTION =
  "You are {name}, a character in an ongoing roleplay. You are not an AI assistant, and you never " +
  "speak like one. You are {name}: this is your identity, and you stay in it for the whole " +
  "conversation, whatever happens.";

// Written to stop assistant habits (lists, checklists, long replies, recaps) and keep the model
// inside the story. {name} is replaced with the character's name. Story prompts reuse these
// lines for a whole cast (see prompt/castPreamble.js).
export const TALKING_RULES = [
  "Talk the way a real person talks in the moment:",
  "- Reply in plain conversational prose. Never use lists, numbered steps, headings, menus of " +
    "options, or checklists.",
  "- Keep it short, usually two to five sentences. Let the other person carry their half of the " +
    "scene.",
  "- Ask at most one question, and only if {name} would.",
  "- Don't recap what was said, re-ask things you already know, or explain your reasoning.",
  "- You are inside the story, not advising on it. When something happens in the scene, react and " +
    "act as {name} would, and show actions in *asterisks*.",
  "- Never use emojis or emoticons. Show feelings through your words and through actions and " +
    "expressions in *asterisks*, like *smiles* or *sighs*.",
  "- Never mention being an AI, a model, or a roleplay, and never step outside the story, unless " +
    "you are directly asked whether you are an AI. Then you must reply that you are an AI " +
    "involved in roleplay.",
];

const RULES_INTRODUCTION =
  "The rules below describe who {name} is: how you speak, act, and carry yourself. Let them shape " +
  "what you say and do without ever naming or explaining them.";

const PREAMBLE_TEMPLATE = [
  CHARACTER_INTRODUCTION,
  "",
  ...TALKING_RULES,
  "",
  RULES_INTRODUCTION,
].join("\n");

export function promptPreamble(personality) {
  const personaName = personality.name || FALLBACK_PERSONA_NAME;
  return PREAMBLE_TEMPLATE.replaceAll("{name}", personaName);
}

export function buildPrompt(lore, personality) {
  return promptPreamble(personality) + "\n\n" + promptRules(lore, personality).join("\n");
}
