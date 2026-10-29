// Whole-personality operations: cleaning stored data against the lorebook, randomising,
// applying presets and resetting.
// personality = {name, values: {axisId: -2..2}, mood: {p, a, d}, tags: [tagId],
//                rules: [{situation, axis, dir, amount}]}
import { clamp, roundToTenth } from "./dials.js";

export const DEFAULT_PERSONALITY_NAME = "Rowan";
export const MAX_NAME_LENGTH = 60;

// randomize(): how likely each tag group gets a tag, how many rules at most (exclusive), and
// how wide the bell curve spreads before clamping.
const TAG_GROUP_CHANCE = 0.7;
const RULE_COUNT_LIMIT = 3;
const RANDOM_SPREAD = 2.6;
const SAMPLES_PER_DIAL = 3;
const EVEN_CHANCE = 0.5;

export function neutralMood() {
  return { p: 0, a: 0, d: 0 };
}

export function allTagIds(lore) {
  const tagIds = new Set();
  for (const group of lore.tags) {
    for (const tag of group.items) {
      tagIds.add(tag.id);
    }
  }
  return tagIds;
}

function valuesForEveryAxis(lore, valueForAxis) {
  const values = {};
  for (const axis of lore.axes) {
    values[axis.id] = valueForAxis(axis);
  }
  return values;
}

function toDial(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(value);
  }
  return 0;
}

function normalizeName(name) {
  if (typeof name === "string" && name.trim()) {
    return name.trim().slice(0, MAX_NAME_LENGTH);
  }
  return DEFAULT_PERSONALITY_NAME;
}

function isKnownRule(lore, axisIds, rule) {
  if (!rule || !axisIds.has(rule.axis)) {
    return false;
  }
  const isKnownSituation = lore.situations.some((situation) => situation.id === rule.situation);
  const isKnownDirection = rule.dir === "high" || rule.dir === "low";
  return isKnownSituation && isKnownDirection && Boolean(lore.shifts[rule.amount]);
}

function normalizeRules(lore, rules) {
  const axisIds = new Set(lore.axes.map((axis) => axis.id));
  const knownRules = rules.filter((rule) => isKnownRule(lore, axisIds, rule));
  return knownRules.map(({ situation, axis, dir, amount }) => ({ situation, axis, dir, amount }));
}

function normalizeTags(lore, tags) {
  const tagIds = allTagIds(lore);
  const knownTags = tags.filter((tagId) => tagIds.has(tagId));
  return [...new Set(knownTags)];
}

// Fills gaps and drops anything the lorebook doesn't know, so stored data from older versions
// stays usable.
export function normalizePersonality(lore, input = {}) {
  return {
    name: normalizeName(input.name),
    values: valuesForEveryAxis(lore, (axis) => toDial(input.values?.[axis.id])),
    mood: { p: toDial(input.mood?.p), a: toDial(input.mood?.a), d: toDial(input.mood?.d) },
    tags: normalizeTags(lore, input.tags || []),
    rules: normalizeRules(lore, input.rules || []),
  };
}

// The plan's gentle bell curve: the average of a few uniform samples lands near the middle.
function bellCurveDial(random) {
  let sampleSum = 0;
  for (let sampleIndex = 0; sampleIndex < SAMPLES_PER_DIAL; sampleIndex++) {
    sampleSum += random();
  }
  const centered = (sampleSum / SAMPLES_PER_DIAL) * 2 - 1;
  return clamp(roundToTenth(centered * RANDOM_SPREAD));
}

function pickOne(items, random) {
  return items[Math.floor(random() * items.length)];
}

function chooseBetween(random, firstOption, secondOption) {
  if (random() < EVEN_CHANCE) {
    return firstOption;
  }
  return secondOption;
}

function randomTags(lore, random) {
  const tags = [];
  for (const group of lore.tags) {
    if (random() < TAG_GROUP_CHANCE) {
      tags.push(pickOne(group.items, random).id);
    }
  }
  return tags;
}

// The order of random() calls is part of the contract: seeded tests rely on it.
function randomRule(lore, random) {
  const situation = pickOne(lore.situations, random).id;
  const axis = pickOne(lore.axes, random).id;
  const dir = chooseBetween(random, "high", "low");
  const amount = chooseBetween(random, "slight", "strong");
  return { situation, axis, dir, amount };
}

function randomRules(lore, random) {
  const rules = [];
  const ruleCount = Math.floor(random() * RULE_COUNT_LIMIT);
  for (let ruleIndex = 0; ruleIndex < ruleCount; ruleIndex++) {
    rules.push(randomRule(lore, random));
  }
  return rules;
}

// `random` is injectable for tests.
export function randomize(lore, personality, random = Math.random) {
  const values = valuesForEveryAxis(lore, () => bellCurveDial(random));
  const mood = { p: bellCurveDial(random), a: bellCurveDial(random), d: bellCurveDial(random) };
  const tags = randomTags(lore, random);
  const rules = randomRules(lore, random);
  return { ...personality, values, mood, tags, rules };
}

export function applyPreset(lore, personality, preset) {
  return {
    ...personality,
    values: valuesForEveryAxis(lore, (axis) => preset.values?.[axis.id] ?? 0),
    mood: { ...neutralMood(), ...preset.mood },
    tags: [...(preset.tags || [])],
    rules: [],
  };
}

export function resetPersonality(lore, personality) {
  return {
    ...personality,
    values: valuesForEveryAxis(lore, () => 0),
    mood: neutralMood(),
    tags: [],
    rules: [],
  };
}
