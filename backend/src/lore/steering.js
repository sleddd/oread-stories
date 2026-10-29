// The steering export from the plan: coefficients, metatraits, mood and contrast pairs,
// for driving a model with persona vectors instead of (or as well as) the prompt.
import { activePatterns } from "./patterns.js";
import { metatraits } from "./metatraits.js";
import { moodLabel } from "./mood.js";
import { buildPrompt } from "./prompt.js";

const COEFFICIENT_DECIMALS = 1;
// Dials closer to zero than this don't get a steering vector.
const MIN_VECTOR_COEFFICIENT = 0.1;

const STEERING_METHOD =
  "Add coefficient × persona vector for each axis to the residual stream. " +
  "Vectors are extracted from the contrast pairs below. Coefficients range from −2 to +2. " +
  "Situational rules add their delta to the base coefficient when the situation is detected.";

function coefficient(value) {
  return Number(Number(value).toFixed(COEFFICIENT_DECIMALS));
}

function coefficients(lore, values) {
  const result = {};
  for (const axis of lore.axes) {
    result[axis.id] = coefficient(values[axis.id]);
  }
  return result;
}

function directionSign(direction) {
  if (direction === "high") {
    return 1;
  }
  return -1;
}

function situationalRules(lore, rules) {
  return rules.map((rule) => ({
    situation: rule.situation,
    axis: rule.axis,
    delta: directionSign(rule.dir) * lore.shifts[rule.amount].amount,
  }));
}

function steeringVectors(lore, values) {
  const strongAxes = lore.axes.filter((axis) => {
    return Math.abs(values[axis.id]) >= MIN_VECTOR_COEFFICIENT;
  });
  return strongAxes.map((axis) => ({
    trait: axis.id,
    name: axis.name,
    coefficient: coefficient(values[axis.id]),
    contrast: axis.contrast,
  }));
}

export function buildSteering(lore, personality) {
  const values = personality.values;
  const mood = personality.mood;
  const patterns = activePatterns(lore, values);
  return {
    name: personality.name,
    lorebook_version: lore.version,
    coefficients: coefficients(lore, values),
    metatraits: metatraits(lore, values),
    mood: {
      pleasure: mood.p,
      arousal: mood.a,
      dominance: mood.d,
      label: moodLabel(lore, personality).label,
    },
    tags: personality.tags,
    situational_rules: situationalRules(lore, personality.rules),
    active_patterns: patterns.map((pattern) => ({ kind: pattern.kind, text: pattern.text })),
    steering: {
      method: STEERING_METHOD,
      vectors: steeringVectors(lore, values),
    },
    prompt: buildPrompt(lore, personality),
  };
}
