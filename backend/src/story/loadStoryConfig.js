// Loads the story engine's tuning from backend/lore/storyEngine.json. Like the lorebook, it is
// read-only once loaded.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STORY_CONFIG_PATH = path.join(THIS_DIRECTORY, "../../lore/storyEngine.json");

const REQUIRED_SECTIONS = [
  "emotionModel",
  "emotionMap",
  "moodImpulse",
  "moodDynamics",
  "stress",
  "plasticityShift",
  "traitDrift",
];

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function validateStoryConfig(config) {
  const missingSections = REQUIRED_SECTIONS.filter((section) => !config?.[section]);
  if (missingSections.length) {
    throw new Error(`The story engine config is missing: ${missingSections.join(", ")}.`);
  }
  return config;
}

export function loadStoryConfig(filePath = DEFAULT_STORY_CONFIG_PATH) {
  const config = JSON.parse(readFileSync(filePath, "utf8"));
  return deepFreeze(validateStoryConfig(config));
}
