// Reads the <<updates>> note: skill and ability changes judged like a dice check, and what each
// character carries.
//   { "skills": [{ character, name, change, reason }], "abilities": [{ … }],
//     "inventory": [{ character, op: "add" | "remove", item, note }] }
// Every skill or ability change becomes a single step up or down; a change of zero is dropped.
// Each skill, ability or item can change once per turn, so a repeated entry is ignored.
import {
  ABILITY_NAMES,
  MAX_CHARACTER_NAME_LENGTH,
  MAX_SKILL_NAME_LENGTH,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_NOTE_LENGTH,
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

const INVENTORY_OPERATIONS = ["add", "remove"];

// "add" gives the character the item, or changes its note when they already have it.
function readInventoryChange(rawChange) {
  const characterName = noteText(rawChange.character, MAX_CHARACTER_NAME_LENGTH);
  const name = noteText(rawChange.item, MAX_ITEM_NAME_LENGTH);
  const op = String(rawChange.op ?? "add").trim().toLowerCase();
  if (!characterName || !name || !INVENTORY_OPERATIONS.includes(op)) {
    return null;
  }
  return { characterName, name, op, note: noteText(rawChange.note, MAX_ITEM_NOTE_LENGTH) };
}

function readInventoryChanges(rawChanges) {
  const changes = [];
  for (const rawChange of noteObjectList(rawChanges)) {
    const change = readInventoryChange(rawChange);
    if (change && !changes.some((existing) => isSameItem(existing, change))) {
      changes.push(change);
    }
  }
  return changes.slice(0, MAX_UPDATES_PER_TURN);
}

// Returns { skills, abilities, inventory }: skills and abilities are
// [{ characterName, name, direction, reason }], inventory [{ characterName, name, op, note }].
export function parseUpdatesNote(note) {
  if (!note) {
    return { skills: [], abilities: [], inventory: [] };
  }
  const skills = readChanges(note.skills, readSkillName).slice(0, MAX_UPDATES_PER_TURN);
  const roomLeft = MAX_UPDATES_PER_TURN - skills.length;
  const abilities = readChanges(note.abilities, abilityNameOf).slice(0, roomLeft);
  const inventory = readInventoryChanges(note.inventory);
  return { skills, abilities, inventory };
}
