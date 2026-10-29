// Validates a partial personality update against the lorebook and merges it into the current
// personality. Every failure is a 400 naming the field.
import { badRequest } from "../http/errors.js";
import { isObject } from "../http/validate.js";
import { clamp, DIAL_MIN, DIAL_MAX } from "../lore/dials.js";
import { moveMeta } from "../lore/metatraits.js";
import { MOOD_AXES } from "../lore/mood.js";
import { allTagIds, DEFAULT_PERSONALITY_NAME, MAX_NAME_LENGTH } from "../lore/personality.js";

const KNOWN_FIELDS = ["name", "values", "mood", "tags", "rules", "metatraits"];

function checkDial(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw badRequest(`${field} must be a number.`, { field });
  }
  if (value < DIAL_MIN || value > DIAL_MAX) {
    throw badRequest(`${field} must be between ${DIAL_MIN} and ${DIAL_MAX}.`, { field });
  }
  return clamp(value);
}

function checkKnownFields(body) {
  for (const field of Object.keys(body)) {
    if (!KNOWN_FIELDS.includes(field)) {
      throw badRequest(`Unknown field "${field}".`, { field });
    }
  }
}

function mergeName(next, name) {
  if (typeof name !== "string" || name.length > MAX_NAME_LENGTH) {
    throw badRequest(`name must be a string of at most ${MAX_NAME_LENGTH} characters.`, {
      field: "name",
    });
  }
  next.name = name.trim() || DEFAULT_PERSONALITY_NAME;
}

function mergeValues(lore, next, values) {
  if (!isObject(values)) {
    throw badRequest("values must be an object of trait dials.", { field: "values" });
  }
  const axisIds = new Set(lore.axes.map((axis) => axis.id));
  for (const [axisId, value] of Object.entries(values)) {
    if (!axisIds.has(axisId)) {
      throw badRequest(`Unknown trait "${axisId}".`, { field: `values.${axisId}` });
    }
    next.values[axisId] = checkDial(value, `values.${axisId}`);
  }
}

function mergeMetatraits(lore, next, metatraitTargets) {
  if (!isObject(metatraitTargets)) {
    throw badRequest("metatraits must be an object of master dials.", { field: "metatraits" });
  }
  for (const [metatraitId, target] of Object.entries(metatraitTargets)) {
    const metatrait = (lore.metatraits || []).find((candidate) => candidate.id === metatraitId);
    if (!metatrait) {
      throw badRequest(`Unknown master dial "${metatraitId}".`, {
        field: `metatraits.${metatraitId}`,
      });
    }
    next.values = moveMeta(metatrait, next.values, checkDial(target, `metatraits.${metatraitId}`));
  }
}

function mergeMood(next, mood) {
  if (!isObject(mood)) {
    throw badRequest("mood must be an object with p, a and d.", { field: "mood" });
  }
  for (const [moodAxis, value] of Object.entries(mood)) {
    if (!MOOD_AXES.includes(moodAxis)) {
      throw badRequest(`Unknown mood axis "${moodAxis}".`, { field: `mood.${moodAxis}` });
    }
    next.mood[moodAxis] = checkDial(value, `mood.${moodAxis}`);
  }
}

function mergeTags(lore, next, tags) {
  if (!Array.isArray(tags)) {
    throw badRequest("tags must be a list of tag ids.", { field: "tags" });
  }
  const tagIds = allTagIds(lore);
  for (const tagId of tags) {
    if (!tagIds.has(tagId)) {
      throw badRequest(`Unknown tag "${tagId}".`, { field: "tags" });
    }
  }
  next.tags = [...new Set(tags)];
}

function checkRule(lore, rule, index) {
  const field = `rules[${index}]`;
  if (!isObject(rule)) {
    throw badRequest(`${field} must be an object.`, { field });
  }
  if (!lore.situations.some((situation) => situation.id === rule.situation)) {
    throw badRequest(`${field}.situation is not a known situation.`, { field });
  }
  if (!lore.axes.some((axis) => axis.id === rule.axis)) {
    throw badRequest(`${field}.axis is not a known trait.`, { field });
  }
  if (rule.dir !== "high" && rule.dir !== "low") {
    throw badRequest(`${field}.dir must be "high" or "low".`, { field });
  }
  if (!lore.shifts[rule.amount]) {
    const amounts = Object.keys(lore.shifts).join(", ");
    throw badRequest(`${field}.amount must be one of ${amounts}.`, { field });
  }
  return { situation: rule.situation, axis: rule.axis, dir: rule.dir, amount: rule.amount };
}

function mergeRules(lore, next, rules) {
  if (!Array.isArray(rules)) {
    throw badRequest("rules must be a list.", { field: "rules" });
  }
  next.rules = rules.map((rule, index) => checkRule(lore, rule, index));
}

// Returns a new personality; `current` is left untouched.
export function mergePersonalityPatch(lore, current, body) {
  if (!isObject(body)) {
    throw badRequest("The request body must be an object.");
  }
  checkKnownFields(body);
  const next = structuredClone(current);
  if (body.name !== undefined) {
    mergeName(next, body.name);
  }
  if (body.values !== undefined) {
    mergeValues(lore, next, body.values);
  }
  if (body.metatraits !== undefined) {
    mergeMetatraits(lore, next, body.metatraits);
  }
  if (body.mood !== undefined) {
    mergeMood(next, body.mood);
  }
  if (body.tags !== undefined) {
    mergeTags(lore, next, body.tags);
  }
  if (body.rules !== undefined) {
    mergeRules(lore, next, body.rules);
  }
  return next;
}
