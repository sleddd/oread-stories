// Applies the parsed <<updates>> note: each skill or ability moves at most one step, clamped to
// its range. A skill the character doesn't have yet is learned at level 1 when it goes up.
// Items are gained, re-described or let go of.
// Updates can land on any character in the scene, the player's included (a dice check judges
// what they tried, not who they are). Returns log entries with the value before and after, so a
// regenerated reply can undo them.
import {
  MIN_SKILL_LEVEL,
  MAX_SKILL_LEVEL,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MAX_SKILLS,
  MAX_INVENTORY_ITEMS,
} from "../stories/limits.js";
import { findCharacterByName, sameName } from "../stories/noteValues.js";

const NEW_SKILL_LEVEL = 1;

function clampTo(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findSkill(character, skillName) {
  return character.skills.find((skill) => sameName(skill.name, skillName)) ?? null;
}

function learnSkill(character, change, newId) {
  if (change.direction < 0 || character.skills.length >= MAX_SKILLS) {
    return null;
  }
  const skill = { id: newId(), name: change.name, level: NEW_SKILL_LEVEL, note: "" };
  character.skills.push(skill);
  return { from: null, to: NEW_SKILL_LEVEL, name: skill.name, skillId: skill.id };
}

function moveSkill(character, change, newId) {
  const skill = findSkill(character, change.name);
  if (!skill) {
    return learnSkill(character, change, newId);
  }
  const from = skill.level;
  skill.level = clampTo(from + change.direction, MIN_SKILL_LEVEL, MAX_SKILL_LEVEL);
  return { from, to: skill.level, name: skill.name, skillId: skill.id };
}

function moveAbility(character, change) {
  const from = character.abilities[change.name];
  const to = clampTo(from + change.direction, MIN_ABILITY_SCORE, MAX_ABILITY_SCORE);
  character.abilities[change.name] = to;
  return { from, to, name: change.name };
}

function findItem(character, itemName) {
  return (character.inventory ?? []).find((item) => sameName(item.name, itemName)) ?? null;
}

function snapshot(item) {
  if (!item) {
    return null;
  }
  return { ...item };
}

// Logs { name, itemId, before, after } with the item as it was and is; nothing when unchanged.
function changeInventory(character, change, newId) {
  character.inventory ??= [];
  const item = findItem(character, change.name);
  if (change.op === "remove") {
    if (!item) {
      return null;
    }
    character.inventory = character.inventory.filter((candidate) => candidate.id !== item.id);
    return { name: item.name, itemId: item.id, before: snapshot(item), after: null };
  }
  if (item) {
    if (!change.note || change.note === item.note) {
      return null;
    }
    const before = snapshot(item);
    item.note = change.note;
    return { name: item.name, itemId: item.id, before, after: snapshot(item) };
  }
  if (character.inventory.length >= MAX_INVENTORY_ITEMS) {
    return null;
  }
  const newItem = { id: newId(), name: change.name, note: change.note };
  character.inventory.push(newItem);
  return { name: newItem.name, itemId: newItem.id, before: null, after: snapshot(newItem) };
}

function applyInventoryChanges({ story, allowedCharacterIds, changes, newId }) {
  const log = [];
  for (const change of changes) {
    const character = findCharacterByName(story, change.characterName);
    if (!character || !allowedCharacterIds.includes(character.id)) {
      continue;
    }
    const changed = changeInventory(character, change, newId);
    if (changed) {
      log.push({ characterId: character.id, type: "inventory", op: change.op, ...changed });
    }
  }
  return log;
}

function applyChanges({ story, allowedCharacterIds, changes, type, move }) {
  const log = [];
  for (const change of changes) {
    const character = findCharacterByName(story, change.characterName);
    if (!character || !allowedCharacterIds.includes(character.id)) {
      continue;
    }
    const moved = move(character, change);
    if (moved && moved.from !== moved.to) {
      log.push({ characterId: character.id, type, reason: change.reason, ...moved });
    }
  }
  return log;
}

// parsedUpdates: from parseUpdatesNote. allowedCharacterIds: everyone in the scene.
export function applyStoryUpdates({ story, allowedCharacterIds, parsedUpdates, newId }) {
  const skillLog = applyChanges({
    story,
    allowedCharacterIds,
    changes: parsedUpdates.skills,
    type: "skill",
    move: (character, change) => moveSkill(character, change, newId),
  });
  const abilityLog = applyChanges({
    story,
    allowedCharacterIds,
    changes: parsedUpdates.abilities,
    type: "ability",
    move: moveAbility,
  });
  const inventoryLog = applyInventoryChanges({
    story,
    allowedCharacterIds,
    changes: parsedUpdates.inventory ?? [],
    newId,
  });
  return [...skillLog, ...abilityLog, ...inventoryLog];
}

// Puts an item back as it was, unless someone has changed it since.
function revertInventory(character, change) {
  character.inventory ??= [];
  const index = character.inventory.findIndex((item) => item.id === change.itemId);
  const current = character.inventory[index];
  if (change.after && (!current || current.note !== change.after.note)) {
    return;
  }
  if (!change.before) {
    character.inventory.splice(index, 1);
    return;
  }
  if (current) {
    character.inventory[index] = { ...change.before };
    return;
  }
  character.inventory.push({ ...change.before });
}

function revertSkill(character, change) {
  const skill = character.skills.find((candidate) => candidate.id === change.skillId);
  if (!skill || skill.level !== change.to) {
    return;
  }
  if (change.from === null) {
    character.skills = character.skills.filter((candidate) => candidate.id !== skill.id);
    return;
  }
  skill.level = change.from;
}

function revertAbility(character, change) {
  if (character.abilities[change.name] === change.to) {
    character.abilities[change.name] = change.from;
  }
}

// Undoes logged updates, newest first. A value someone changed since is left alone.
export function revertStoryUpdates(story, log) {
  for (const change of [...log].reverse()) {
    const character = story.characters.find((candidate) => candidate.id === change.characterId);
    if (!character) {
      continue;
    }
    if (change.type === "skill") {
      revertSkill(character, change);
    } else if (change.type === "inventory") {
      revertInventory(character, change);
    } else {
      revertAbility(character, change);
    }
  }
}
