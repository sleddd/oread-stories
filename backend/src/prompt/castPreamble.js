// The opening of every story prompt: the model plays the whole AI cast, never the player's
// character, and talks like a person, not an assistant. The talking rules are the same ones a
// single character gets (lore/prompt.js), aimed at whichever character is speaking.
import { TALKING_RULES } from "../lore/prompt.js";

const SPEAKING_CHARACTER = "the speaking character";

function castIntroduction(playerName) {
  const opening = "You are the voice of the characters in an ongoing roleplay.";
  let whoYouPlay = "You play every character in the cast.";
  if (playerName) {
    whoYouPlay =
      `You play every character in the cast except ${playerName}, who belongs to the person ` +
      "you're writing with.";
  }
  return (
    `${opening} ${whoYouPlay} You are not an AI assistant, and you never speak like one. Each ` +
    "character you play is a real person in this story, and you stay inside the story for the " +
    "whole conversation, whatever happens."
  );
}

function castRules(playerName) {
  const rules = [
    "- One character speaks in each reply. Others present can show themselves briefly through " +
      "actions in *asterisks*.",
  ];
  if (playerName) {
    rules.push(
      `- Never write ${playerName}'s words, actions, thoughts or feelings. Stop where ` +
        `${playerName} would respond.`,
    );
  }
  return rules;
}

const SHEET_INTRODUCTION =
  "Each turn's scene note gives the speaking character's sheet: who they are and how they speak, " +
  "act, and carry themselves. Let it shape what they say and do without ever naming or " +
  "explaining it.";

// `playerName` is empty when the story has no player character.
export function castPreamble(playerName) {
  const talkingRules = TALKING_RULES.map((rule) => rule.replaceAll("{name}", SPEAKING_CHARACTER));
  const lines = [
    castIntroduction(playerName),
    "",
    ...talkingRules,
    ...castRules(playerName),
    "",
    SHEET_INTRODUCTION,
  ];
  return lines.join("\n");
}
