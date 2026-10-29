// Loads the pre-built story templates from backend/lore/storyTemplates/. Like the lorebook they
// are static and read-only: each file is checked, turned into a blueprint once at start, and the
// result is frozen. Nothing in the API can change them.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { templateToStory } from "./templateToStory.js";

const THIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STORY_TEMPLATES_DIRECTORY = path.join(
  THIS_DIRECTORY,
  "../../lore/storyTemplates",
);
// Kept beside the templates rather than inside them, so the template files stay as they came.
export const DEFAULT_TEMPLATE_ABILITIES_PATH = path.join(
  THIS_DIRECTORY,
  "../../lore/storyTemplateAbilities.json",
);
const TEMPLATE_EXTENSION = ".json";
const OTHER_CATEGORY = "other";

// A rough shelf for each template, so the picker can group them.
const TEMPLATE_CATEGORIES = {
  "business-mystery": "mystery",
  "whodunnit-manor": "mystery",
  "detective-noir": "mystery",
  "victorian-mystery": "mystery",
  "regency-romance": "romance",
  "vampire-romance": "romance",
  "fae-court-captive": "romance",
  "haunted-romance": "romance",
  "meet-cute-comedy": "romance",
  "romantasy-kingdom": "romance",
  "scifi-explorer": "sci-fi",
  "cyberpunk-hacker": "sci-fi",
  "first-contact": "sci-fi",
  "last-voyage": "sci-fi",
  "time-travel-agency": "sci-fi",
  "fantasy-tavern": "fantasy",
  "renaissance-florence": "historical",
  "companion-echo": "companion",
  "companion-kairos": "companion",
};

function findProblems(template) {
  const problems = [];
  const roleplay = template?.settings?.roleplay;
  if (!template?.id || !template?.name) {
    problems.push("it needs an id and a name");
  }
  if (!roleplay?.world) {
    problems.push("it needs settings.roleplay.world");
  }
  const hasCharacters = Array.isArray(roleplay?.characters) && roleplay.characters.length > 0;
  if (!hasCharacters && !roleplay?.character) {
    problems.push("it needs at least one character");
  }
  return problems;
}

export function validateStoryTemplate(template, fileName) {
  const problems = findProblems(template);
  if (problems.length) {
    throw new Error(`The story template ${fileName} is invalid: ${problems.join("; ")}.`);
  }
  return template;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function describeTemplate(lore, template, abilityScoresByName = {}) {
  const blueprint = templateToStory(lore, template, abilityScoresByName);
  return {
    id: template.id,
    title: blueprint.title,
    description: template.description ?? "",
    category: TEMPLATE_CATEGORIES[template.id] ?? OTHER_CATEGORY,
    characterNames: blueprint.characters.map((character) => character.name),
    blueprint,
  };
}

function readTemplate(directory, fileName) {
  const text = readFileSync(path.join(directory, fileName), "utf8");
  return validateStoryTemplate(JSON.parse(text), fileName);
}

function byTitle(first, second) {
  return first.title.localeCompare(second.title);
}

function readTemplateAbilities(abilitiesPath) {
  if (!existsSync(abilitiesPath)) {
    return {};
  }
  return JSON.parse(readFileSync(abilitiesPath, "utf8"));
}

export function loadStoryTemplates(
  lore,
  directory = DEFAULT_STORY_TEMPLATES_DIRECTORY,
  abilitiesPath = DEFAULT_TEMPLATE_ABILITIES_PATH,
) {
  const fileNames = readdirSync(directory).filter((name) => name.endsWith(TEMPLATE_EXTENSION));
  const abilitiesByTemplate = readTemplateAbilities(abilitiesPath);
  const templates = fileNames.map((fileName) => {
    const template = readTemplate(directory, fileName);
    return describeTemplate(lore, template, abilitiesByTemplate[template.id]);
  });
  return deepFreeze(templates.sort(byTitle));
}
