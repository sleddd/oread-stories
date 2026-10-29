// Turns one of the pre-built story templates (backend/lore/storyTemplates/*.json) into a story
// blueprint: everything a story needs except ids and times, which storyFromBlueprint.js adds
// when the user creates a story from it. Pure: the same template always gives the same blueprint.
//
// How template fields map onto a story:
// - name → title; description → plot (it reads as the premise); theme and conflict stay empty.
// - narratorVoice → pointOfView, in plain words.
// - hardRules → rules. Banned words and phrases (linguisticFilters) become rules too, because
//   rules are always in the prompt and seed memories are not.
// - settingLore → a pinned world note in the "setting" category.
// - openingScene → openingScene, which starts each new chat as narration. The companion
//   templates' openingScene is an instruction ("lead with your energy…"), not a scene, so it
//   becomes a rule instead.
// - each character (or the single `character`) → an AI character:
//   - name; role, age, gender and species → summary; backstory → backstory
//   - knowledgeSkills lines → skills at a starting level
//   - traits → lorebook dials and style tags (templateTraits.js)
//   - role → the identity memory; hobbiesInterests and thingsToAvoid lines → first-person seed
//     memories (self and opinion)
//   - inventory → a world state fact about what they carry
//   - abilities → D&D-style scores from storyTemplateAbilities.json, keyed by character name;
//     a missing or out-of-range score falls back to the default
// - userPersona is empty in every template, so no player character is added.
// - general and meta (temperature, model, version) are ignored.
import { normalizePersonality } from "../lore/personality.js";
import { withoutName } from "./characterPersonality.js";
import { defaultAbilities } from "./factories.js";
import { traitWordsOf, dialValuesForTraits, tagsForTraits } from "./templateTraits.js";
import {
  MAX_CHARACTER_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_BACKSTORY_LENGTH,
  MAX_SKILLS,
  MAX_SKILL_NAME_LENGTH,
  MAX_SKILL_NOTE_LENGTH,
  MAX_MEMORY_TEXT_LENGTH,
  MAX_WORLD_NOTE_TEXT_LENGTH,
  MAX_WORLD_STATE_SUBJECT_LENGTH,
  MAX_WORLD_STATE_FACT_LENGTH,
  MAX_STORY_RULES,
  MAX_STORY_RULE_LENGTH,
  MAX_STORY_TITLE_LENGTH,
  MAX_STORY_FIELD_LENGTH,
  MAX_OPENING_SCENE_LENGTH,
  ABILITY_NAMES,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
} from "./limits.js";

export const TEMPLATE_SKILL_LEVEL = 6;
const IDENTITY_IMPORTANCE = 5;
const SEED_MEMORY_IMPORTANCE = 3;
const COMPANION_VOICE = "companion";
const ELLIPSIS = "…";
const SETTING_NOTE_TITLE = "Setting";

const POINTS_OF_VIEW = {
  third_person_limited: "Third person limited: stay close to one character at a time.",
  first_person: "First person: the speaking character tells it as “I”.",
  cinematic: "Cinematic third person: vivid and visual, moving between characters.",
  companion: "A direct, one-to-one conversation between the companion and you.",
};

// Cuts text to a length at a word boundary, marking the cut.
export function shortenText(text, maximumLength) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length <= maximumLength) {
    return trimmed;
  }
  const cut = trimmed.slice(0, maximumLength - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(" ");
  let wordBoundaryCut = cut;
  if (lastSpace > 0) {
    wordBoundaryCut = cut.slice(0, lastSpace);
  }
  return wordBoundaryCut.trimEnd() + ELLIPSIS;
}

function startLowercase(text) {
  const trimmed = String(text).trim();
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function nonEmptyLines(text) {
  const lines = String(text ?? "").split("\n");
  const trimmedLines = lines.map((line) => line.trim());
  return trimmedLines.filter(Boolean);
}

function pointOfViewFor(narratorVoice) {
  return POINTS_OF_VIEW[narratorVoice] ?? "";
}

function isCompanion(world) {
  return world.narratorVoice === COMPANION_VOICE;
}

function bannedLanguageRules(userPersona = {}) {
  const filters = userPersona.linguisticFilters ?? {};
  const rules = [];
  if (filters.bannedPhrases?.length) {
    rules.push(`Never use these phrases: ${filters.bannedPhrases.join("; ")}.`);
  }
  if (filters.bannedWords?.length) {
    rules.push(`Never use these words: ${filters.bannedWords.join(", ")}.`);
  }
  return rules;
}

function storyRules(template) {
  const { world } = template.settings.roleplay;
  const rules = [...(world.hardRules ?? [])];
  if (isCompanion(world) && world.openingScene) {
    rules.push(`How to open a conversation: ${world.openingScene}`);
  }
  rules.push(...bannedLanguageRules(template.settings.userPersona));
  const shortenedRules = rules.map((rule) => shortenText(rule, MAX_STORY_RULE_LENGTH));
  return shortenedRules.slice(0, MAX_STORY_RULES);
}

function openingSceneFor(world) {
  if (isCompanion(world)) {
    return "";
  }
  return shortenText(world.openingScene, MAX_OPENING_SCENE_LENGTH);
}

function settingNotes(world) {
  if (!world.settingLore) {
    return [];
  }
  const note = {
    category: "setting",
    title: SETTING_NOTE_TITLE,
    text: shortenText(world.settingLore, MAX_WORLD_NOTE_TEXT_LENGTH),
    keywords: [],
    pinned: true,
  };
  return [note];
}

function templateCharacters(roleplay) {
  if (roleplay.characterMode === "single" && roleplay.character) {
    return [roleplay.character];
  }
  return roleplay.characters ?? [];
}

// "Mechanical knowledge — locks, mechanisms" → "Mechanical knowledge".
function skillNameFrom(line) {
  const separators = [":", " — ", " - ", ",", " ("];
  let name = line;
  for (const separator of separators) {
    const position = name.indexOf(separator);
    if (position > 0) {
      name = name.slice(0, position);
    }
  }
  return shortenText(name, MAX_SKILL_NAME_LENGTH);
}

function skillsFrom(knowledgeSkills) {
  const lines = nonEmptyLines(knowledgeSkills).slice(0, MAX_SKILLS);
  return lines.map((line) => ({
    name: skillNameFrom(line),
    level: TEMPLATE_SKILL_LEVEL,
    note: shortenText(line, MAX_SKILL_NOTE_LENGTH),
  }));
}

function summaryFrom(character) {
  const details = [character.age, character.gender, character.species].filter(Boolean);
  const parts = [character.role];
  if (details.length) {
    parts.push(details.join(", "));
  }
  return shortenText(parts.filter(Boolean).join(". ") + ".", MAX_SUMMARY_LENGTH);
}

function personalityFrom(lore, character) {
  const traitWords = traitWordsOf(character.traits);
  const personality = normalizePersonality(lore, {
    name: character.name,
    values: dialValuesForTraits(lore, traitWords),
    tags: tagsForTraits(lore, traitWords),
  });
  return withoutName(personality);
}

function memoryInput(kind, text, importance) {
  return { kind, text: shortenText(text, MAX_MEMORY_TEXT_LENGTH), about: [], importance };
}

function identityMemory(character) {
  const text = `I am ${character.name}: ${startLowercase(character.role)}.`;
  return memoryInput("identity", text, IDENTITY_IMPORTANCE);
}

function linesAsMemories(text, kind, lead) {
  const lines = nonEmptyLines(text);
  return lines.map((line) => {
    return memoryInput(kind, `${lead} ${startLowercase(line)}`, SEED_MEMORY_IMPORTANCE);
  });
}

function seedMemories(character) {
  const memories = [identityMemory(character)];
  memories.push(...linesAsMemories(character.hobbiesInterests, "self", "Something I love:"));
  memories.push(...linesAsMemories(character.thingsToAvoid, "opinion", "Something I avoid:"));
  return memories;
}

function isAbilityScore(score) {
  return Number.isInteger(score) && score >= MIN_ABILITY_SCORE && score <= MAX_ABILITY_SCORE;
}

function abilitiesFrom(scores = {}) {
  const abilities = defaultAbilities();
  for (const abilityName of ABILITY_NAMES) {
    if (isAbilityScore(scores[abilityName])) {
      abilities[abilityName] = scores[abilityName];
    }
  }
  return abilities;
}

function characterFrom(lore, character, abilityScoresByName) {
  return {
    name: shortenText(character.name, MAX_CHARACTER_NAME_LENGTH),
    summary: summaryFrom(character),
    backstory: shortenText(character.backstory, MAX_BACKSTORY_LENGTH),
    abilities: abilitiesFrom(abilityScoresByName[character.name]),
    skills: skillsFrom(character.knowledgeSkills),
    personality: personalityFrom(lore, character),
    memory: seedMemories(character),
  };
}

const NAME_TITLES = [
  "Dr.",
  "Mr.",
  "Mrs.",
  "Miss",
  "Lord",
  "Lady",
  "Captain",
  "Commander",
  "Director",
  "Inspector",
  "Colonel",
  "Chief",
  "Engineer",
  "Dowager",
  "Countess",
  "Maestro",
];

// The names people would use for a character: their first name and their surname.
function callingNamesOf(name) {
  const words = name.split(" ").filter(Boolean);
  const meaningfulWords = words.filter((word) => !NAME_TITLES.includes(word));
  const firstName = meaningfulWords[0] ?? name;
  const surname = meaningfulWords[meaningfulWords.length - 1] ?? name;
  return [...new Set([firstName, surname])];
}

function belongingsFact(character) {
  const fact = `${character.name} carries ${startLowercase(character.inventory)}`;
  return {
    subject: shortenText(`${character.name}'s belongings`, MAX_WORLD_STATE_SUBJECT_LENGTH),
    fact: shortenText(fact, MAX_WORLD_STATE_FACT_LENGTH),
    keywords: callingNamesOf(character.name),
  };
}

function worldStateFrom(characters) {
  const carrying = characters.filter((character) => String(character.inventory ?? "").trim());
  return carrying.map(belongingsFact);
}

// `abilityScoresByName` maps each character's name to their ability scores.
export function templateToStory(lore, template, abilityScoresByName = {}) {
  const { roleplay } = template.settings;
  const characters = templateCharacters(roleplay);
  return {
    title: shortenText(template.name, MAX_STORY_TITLE_LENGTH),
    theme: "",
    plot: shortenText(template.description, MAX_STORY_FIELD_LENGTH),
    conflict: "",
    pointOfView: pointOfViewFor(roleplay.world.narratorVoice),
    rules: storyRules(template),
    openingScene: openingSceneFor(roleplay.world),
    worldNotes: settingNotes(roleplay.world),
    worldState: worldStateFrom(characters),
    characters: characters.map((character) => {
      return characterFrom(lore, character, abilityScoresByName);
    }),
  };
}
