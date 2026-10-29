// Reads and checks request bodies for a character's own fields: name, role, summary, backstory,
// abilities and skills. Personality dials go through services/personalityPatch.js instead.
import {
  isObject,
  requireObject,
  optionalString,
  optionalInteger,
  rejectUnknownFields,
  requireSomeField,
  withoutMissingFields,
} from "../http/validate.js";
import { badRequest } from "../http/errors.js";
import {
  CHARACTER_ROLES,
  MAX_CHARACTER_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_BACKSTORY_LENGTH,
  ABILITY_NAMES,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MAX_SKILLS,
  MAX_SKILL_NAME_LENGTH,
  MAX_SKILL_NOTE_LENGTH,
  MIN_SKILL_LEVEL,
  MAX_SKILL_LEVEL,
} from "./limits.js";

const CHARACTER_FIELDS = ["name", "role", "summary", "backstory", "abilities", "skills"];

function readName(name) {
  const cleaned = optionalString(name, "name", { max: MAX_CHARACTER_NAME_LENGTH });
  if (cleaned === undefined) {
    return undefined;
  }
  if (!cleaned.trim()) {
    throw badRequest("name can't be empty.", { field: "name" });
  }
  return cleaned.trim();
}

function readRole(role) {
  if (role === undefined) {
    return undefined;
  }
  if (!CHARACTER_ROLES.includes(role)) {
    throw badRequest(`role must be one of ${CHARACTER_ROLES.join(", ")}.`, { field: "role" });
  }
  return role;
}

// A partial set of scores; abilities left out keep their current value.
function readAbilities(abilities) {
  if (abilities === undefined) {
    return undefined;
  }
  if (!isObject(abilities)) {
    throw badRequest("abilities must be an object of scores.", { field: "abilities" });
  }
  const scores = {};
  for (const [abilityName, score] of Object.entries(abilities)) {
    const field = `abilities.${abilityName}`;
    if (!ABILITY_NAMES.includes(abilityName)) {
      throw badRequest(`Unknown ability "${abilityName}".`, { field });
    }
    scores[abilityName] = optionalInteger(score, field, {
      min: MIN_ABILITY_SCORE,
      max: MAX_ABILITY_SCORE,
    });
  }
  return scores;
}

function readSkillName(skill, field) {
  const name = optionalString(skill.name, `${field}.name`, { max: MAX_SKILL_NAME_LENGTH });
  if (!name?.trim()) {
    throw badRequest(`${field}.name is required.`, { field: `${field}.name` });
  }
  return name.trim();
}

function readSkill(skill, index) {
  const field = `skills[${index}]`;
  if (!isObject(skill)) {
    throw badRequest(`${field} must be an object.`, { field });
  }
  const level = optionalInteger(skill.level, `${field}.level`, {
    min: MIN_SKILL_LEVEL,
    max: MAX_SKILL_LEVEL,
  });
  const note = optionalString(skill.note, `${field}.note`, { max: MAX_SKILL_NOTE_LENGTH });
  return {
    id: optionalString(skill.id, `${field}.id`, { max: MAX_SKILL_NAME_LENGTH }),
    name: readSkillName(skill, field),
    level: level ?? MIN_SKILL_LEVEL,
    note: note ?? "",
  };
}

// The whole skills table; it replaces the current one.
function readSkills(skills) {
  if (skills === undefined) {
    return undefined;
  }
  if (!Array.isArray(skills)) {
    throw badRequest("skills must be a list.", { field: "skills" });
  }
  if (skills.length > MAX_SKILLS) {
    throw badRequest(`skills can hold at most ${MAX_SKILLS} items.`, { field: "skills" });
  }
  return skills.map(readSkill);
}

function readCharacterFields(input) {
  const fields = {
    name: readName(input.name),
    role: readRole(input.role),
    summary: optionalString(input.summary, "summary", { max: MAX_SUMMARY_LENGTH }),
    backstory: optionalString(input.backstory, "backstory", { max: MAX_BACKSTORY_LENGTH }),
    abilities: readAbilities(input.abilities),
    skills: readSkills(input.skills),
  };
  return withoutMissingFields(fields);
}

// For POST: a name is required; the role defaults to "ai".
export function readNewCharacter(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, CHARACTER_FIELDS);
  if (input.name === undefined) {
    throw badRequest("name is required.", { field: "name" });
  }
  return { role: "ai", ...readCharacterFields(input) };
}

// For PATCH: only the fields sent.
export function readCharacterChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, CHARACTER_FIELDS);
  requireSomeField(input, CHARACTER_FIELDS);
  return readCharacterFields(input);
}
