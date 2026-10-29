// The main speaker's full sheet for this turn: who they are, their abilities and skills, how they
// speak and act (the lorebook rules for their current, effective dials), their identity and the
// memories chosen for this moment. Only the speaking character gets a sheet, which keeps each
// request small.
import { promptRules } from "../lore/promptRules.js";
import { ABILITY_NAMES, MAX_ABILITY_SCORE, MAX_SKILL_LEVEL } from "../stories/limits.js";

function capitalized(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function describeAbilities(abilities) {
  const scores = ABILITY_NAMES.map((abilityName) => {
    return `${capitalized(abilityName)} ${abilities[abilityName]}`;
  });
  return `Abilities (1 to ${MAX_ABILITY_SCORE}): ${scores.join(", ")}`;
}

function describeSkill(skill) {
  const note = skill.note.trim();
  if (note) {
    return `${skill.name} ${skill.level} (${note})`;
  }
  return `${skill.name} ${skill.level}`;
}

function describeSkills(skills) {
  if (skills.length === 0) {
    return "Skills: none worth naming yet";
  }
  return `Skills (0 to ${MAX_SKILL_LEVEL}): ${skills.map(describeSkill).join(", ")}`;
}

function identityOf(character) {
  return character.memory.find((entry) => entry.kind === "identity") ?? null;
}

function pushSection(lines, heading, text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed) {
    lines.push(`${heading}: ${trimmed}`);
  }
}

// `personality` is the character's effective personality (with the story engine's mood and
// stress applied). `memoryLines` are the chosen memories, already described with short ids.
export function buildCharacterSheet({ lore, character, personality, memoryLines }) {
  const name = character.name;
  const lines = [`Main speaker: ${name}`];
  pushSection(lines, `Who ${name} is`, character.summary);
  pushSection(lines, "Backstory", character.backstory);
  lines.push(describeAbilities(character.abilities));
  lines.push(describeSkills(character.skills));
  lines.push(`How ${name} speaks, acts and carries themselves:`);
  lines.push(...promptRules(lore, personality));
  const identity = identityOf(character);
  if (identity) {
    lines.push(`${name}'s sense of self: ${identity.text}`);
  }
  if (memoryLines.length > 0) {
    lines.push(`What ${name} remembers right now:`);
    lines.push(...memoryLines);
  }
  return lines.join("\n");
}
