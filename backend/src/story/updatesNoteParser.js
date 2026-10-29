// Reads the <<updates>> note: skill and ability changes judged like a dice check.
//   { "skills": [{ character, name, change, reason }], "abilities": [{ … }] }
// Every change becomes a single step up or down; a change of zero is dropped. Each item can move
// once per turn, so a repeated entry is ignored.
import {
  ABILITY_NAMES,
  MAX_CHARACTER_NAME_LENGTH,
  MAX_SKILL_NAME_LENGTH,
} from "../stories/limits.js";
import { noteText, noteObjectList, sameName } from "../stories/noteValues.js";

export const MAX_UPDATES_PER_TURN = 12;
const MAX_REASON_LENGTH = 200;

const ABILITY_ABBREVIATIONS = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

function abilityNameOf(name) {
  const lowered = String(name ?? "")
    .trim()
    .toLowerCase();
  if (ABILITY_NAMES.includes(lowered)) {
    return lowered;
  }
  return ABILITY_ABBREVIATIONS[lowered] ?? null;
}

function directionOf(change) {
  const number = Number(change);
  if (!Number.isFinite(number) || number === 0) {
    return 0;
  }
  return Math.sign(number);
}

function readChange(rawChange, readName) {
  const characterName = noteText(rawChange.character, MAX_CHARACTER_NAME_LENGTH);
  const name = readName(rawChange.name);
  const direction = directionOf(rawChange.change);
  if (!characterName || !name || direction === 0) {
    return null;
  }
  const reason = noteText(rawChange.reason, MAX_REASON_LENGTH);
  return { characterName, name, direction, reason };
}

function isSameItem(first, second) {
  return sameName(first.characterName, second.characterName) && sameName(first.name, second.name);
}

function readChanges(rawChanges, readName) {
  const changes = [];
  for (const rawChange of noteObjectList(rawChanges)) {
    const change = readChange(rawChange, readName);
    if (change && !changes.some((existing) => isSameItem(existing, change))) {
      changes.push(change);
    }
  }
  return changes;
}

function readSkillName(name) {
  return noteText(name, MAX_SKILL_NAME_LENGTH);
}

// Returns { skills, abilities }, each [{ characterName, name, direction, reason }].
export function parseUpdatesNote(note) {
  if (!note) {
    return { skills: [], abilities: [] };
  }
  const skills = readChanges(note.skills, readSkillName).slice(0, MAX_UPDATES_PER_TURN);
  const roomLeft = MAX_UPDATES_PER_TURN - skills.length;
  const abilities = readChanges(note.abilities, abilityNameOf).slice(0, roomLeft);
  return { skills, abilities };
}
