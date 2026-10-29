// Loads the lorebook from backend/lore/lore.json. The book is read-only: it is frozen after
// loading and nothing in the API can change it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LORE_PATH = path.join(THIS_DIRECTORY, "../../lore/lore.json");

// Optional sections that default to empty so the rest of the code can rely on them.
const OPTIONAL_LIST_SECTIONS = ["tags", "situations", "patterns", "presets"];

function isNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0;
}

function findProblems(lore) {
  const problems = [];
  if (!isNonEmptyList(lore?.axes)) {
    problems.push("axes must be a non-empty list");
  }
  if (!isNonEmptyList(lore?.bands)) {
    problems.push("bands must be a non-empty list");
  }
  for (const axis of lore?.axes || []) {
    if (!axis.id || !axis.text) {
      problems.push(`axis ${axis.name || "(unnamed)"} needs an id and text`);
    }
  }
  if (!lore?.mood?.intro || !Array.isArray(lore.mood.prototypes)) {
    problems.push("mood needs an intro and prototypes");
  }
  return problems;
}

export function validateLore(lore) {
  const problems = findProblems(lore);
  if (problems.length) {
    throw new Error(`The lorebook is invalid: ${problems.join("; ")}.`);
  }
  for (const section of OPTIONAL_LIST_SECTIONS) {
    lore[section] ||= [];
  }
  lore.shifts ||= {};
  return lore;
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

export function loadLore(filePath = DEFAULT_LORE_PATH) {
  const lore = JSON.parse(readFileSync(filePath, "utf8"));
  return deepFreeze(validateLore(lore));
}
