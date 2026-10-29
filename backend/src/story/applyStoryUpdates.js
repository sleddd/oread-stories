// Applies the parsed <<updates>> note: each skill or ability moves at most one step, clamped to
// its range. A skill the character doesn't have yet is learned at level 1 when it goes up.
// Updates can land on any character in the scene, the player's included (a dice check judges
// what they tried, not who they are). Returns log entries with the value before and after, so a
// regenerated reply can undo them.
import {
  MIN_SKILL_LEVEL,
  MAX_SKILL_LEVEL,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MAX_SKILLS,
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
  return [...skillLog, ...abilityLog];
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
    } else {
      revertAbility(character, change);
    }
  }
}
