// The pure personality logic: loading the book, bands, mood, patterns, master dials,
// normalising, randomising, presets, the prompt, shifts and the public controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lore } from "./helpers.js";
import { validateLore } from "../src/lore/loadLore.js";
import { bandOf, poleText } from "../src/lore/dials.js";
import { moodLabel } from "../src/lore/mood.js";
import { activePatterns } from "../src/lore/patterns.js";
import { metaValue, moveMeta } from "../src/lore/metatraits.js";
import { normalizePersonality, randomize, applyPreset } from "../src/lore/personality.js";
import { promptRules } from "../src/lore/promptRules.js";
import { buildPrompt } from "../src/lore/prompt.js";
import { describePersonality } from "../src/lore/describePersonality.js";
import { profileOf, describeShift } from "../src/lore/shift.js";
import { loreControls } from "../src/lore/controls.js";

const PARK_MILLER_MULTIPLIER = 16807;
const PARK_MILLER_MODULUS = 2147483647;

function basePersonality(overrides = {}) {
  return normalizePersonality(lore, { name: "Rowan", ...overrides });
}

// A deterministic random source (Park–Miller), so randomize can be compared across runs.
function seededRandom(seed = 1) {
  let state = seed;
  return () => {
    state = (state * PARK_MILLER_MULTIPLIER) % PARK_MILLER_MODULUS;
    return state / PARK_MILLER_MODULUS;
  };
}

function findAxis(axisId) {
  return lore.axes.find((axis) => axis.id === axisId);
}

test("the lorebook loads frozen and can't be changed", () => {
  assert.ok(Object.isFrozen(lore) && Object.isFrozen(lore.axes[0].text));
  assert.throws(() => {
    lore.axes[0].text.mid = "changed";
  }, TypeError);
});

test("validateLore rejects a book without axes or mood", () => {
  assert.throws(() => validateLore({ bands: [] }), /axes must be a non-empty list/);
});

test("bands follow the lorebook thresholds", () => {
  assert.equal(bandOf(lore, -2), "very_low");
  assert.equal(bandOf(lore, -0.5), "low");
  assert.equal(bandOf(lore, 0), "mid");
  assert.equal(bandOf(lore, 1.5), "high");
  assert.equal(bandOf(lore, 1.6), "very_high");

  const valence = findAxis("valence");
  assert.equal(poleText(lore, valence, 0), "Centered");
  assert.equal(poleText(lore, valence, 1.8), "Strongly sunny");
  assert.equal(poleText(lore, valence, -1), "Leaning gloomy");
});

test("mood label is the nearest prototype with an intensity word", () => {
  assert.equal(moodLabel(lore, basePersonality()).label, "neutral");
  const angry = moodLabel(lore, basePersonality({ mood: { p: -1.6, a: 1.8, d: 1 } }));
  assert.equal(angry.label, "angry");
  assert.equal(angry.intensity, ", strongly");
});

test("patterns activate only inside their ranges", () => {
  function activePatternTexts(values) {
    const patterns = activePatterns(lore, basePersonality({ values }).values);
    return patterns.map((pattern) => pattern.text);
  }
  const mentionsLeader = (text) => text.includes("natural leader");
  assert.ok(activePatternTexts({ agency: 1.5, communion: 1.5 }).some(mentionsLeader));
  assert.ok(!activePatternTexts({ agency: 0.5, communion: 1.5 }).some(mentionsLeader));
});

test("moving a master dial moves its traits together and reaches the target", () => {
  const stability = lore.metatraits.find((metatrait) => metatrait.id === "stability");
  const values = moveMeta(stability, basePersonality().values, 1);
  assert.equal(values.valence, 1);
  assert.equal(values.reactivity, -1);
  assert.equal(Math.round(metaValue(stability, values) * 10) / 10, 1);
  assert.equal(values.agency, 0);
});

test("normalizePersonality clamps values and drops what the lorebook doesn't know", () => {
  const personality = normalizePersonality(lore, {
    name: "  ",
    values: { valence: 9, nope: 1 },
    tags: ["dry", "dry", "fake"],
    rules: [{ situation: "upset", axis: "valence", dir: "up", amount: "slight" }],
    id: "x",
  });
  assert.equal(personality.name, "Rowan");
  assert.equal(personality.values.valence, 2);
  assert.ok(!("nope" in personality.values) && !("id" in personality));
  assert.deepEqual(personality.tags, ["dry"]);
  assert.deepEqual(personality.rules, []);
});

test("randomize is reproducible with a seeded random source", () => {
  const first = randomize(lore, basePersonality(), seededRandom(7));
  const second = randomize(lore, basePersonality(), seededRandom(7));
  assert.deepEqual(first, second);
});

test("applying a preset copies its dials, mood and tags", () => {
  const personality = applyPreset(lore, basePersonality(), lore.presets[0]);
  assert.equal(personality.values.honesty_humility, 1.6);
  assert.deepEqual(personality.tags, ["dry", "plain", "candor", "tester"]);
  assert.deepEqual(personality.rules, []);
});

test("the prompt opens with the framing sentence and lists one rule per line, no headers", () => {
  const prompt = buildPrompt(lore, basePersonality({ name: "Mara" }));
  const [framing, blankLine, ...rules] = prompt.split("\n");
  assert.match(
    framing,
    /^Use the following rules to guide every response as you take on the persona of Mara, /,
  );
  assert.equal(blankLine, "");
  assert.deepEqual(rules, promptRules(lore, basePersonality({ name: "Mara" })));
  const oldHeaders = [
    "Temperament",
    "Voice",
    "Patterns",
    "Current mood",
    "How you relate to people",
  ];
  for (const header of oldHeaders) {
    assert.ok(!rules.includes(header));
  }
  assert.match(rules.at(-1), /^Stay in this character consistently/);
});

test("each trait's text is followed by its language lines from the book", () => {
  const rules = promptRules(lore, basePersonality({ values: { agency: 1 } }));
  const traitIndex = rules.indexOf(findAxis("agency").text.high);
  assert.equal(rules[traitIndex + 1], lore.language.agency.high.d);
  assert.equal(rules[traitIndex + 2], lore.language.agency.high.r);
});

test("action voice adds its intro and at most `limit` lines, strongest dials first", () => {
  const rules = promptRules(lore, basePersonality({
    values: {
      valence: 2,
      reactivity: 1.9,
      agency: 1.8,
      communion: 1.7,
      openness: 1.6,
      conscientiousness: 1,
    },
  }));
  const introIndex = rules.indexOf(lore.actionVoice.intro);
  assert.ok(introIndex > 0);
  assert.deepEqual(rules.slice(introIndex + 1, introIndex + 5), [
    lore.actionVoice.valence.very_high,
    lore.actionVoice.reactivity.very_high,
    lore.actionVoice.agency.very_high,
    lore.actionVoice.communion.very_high,
  ]);
  assert.ok(!rules.includes(lore.actionVoice.openness.very_high));
});

test("mood dials past ±0.6 pull their lines; the mood rule comes before the closing line", () => {
  const rules = promptRules(lore, basePersonality({ mood: { p: 1.4, a: -1.2, d: 0 } }));
  assert.ok(rules.includes(lore.mood.axes.p.high) && rules.includes(lore.mood.axes.a.low));
  assert.ok(!rules.includes(lore.mood.axes.d.high) && !rules.includes(lore.mood.axes.d.low));
  assert.equal(rules.at(-2), lore.mood.rule);
});

test("any dial change changes the prompt", () => {
  const promptFor = (overrides) => buildPrompt(lore, basePersonality(overrides));
  const original = promptFor({ values: { valence: 1 } });
  assert.notEqual(original, promptFor({ values: { valence: -1 } }));
  assert.notEqual(original, promptFor({ values: { valence: 1 }, tags: ["dry"] }));
  assert.notEqual(original, promptFor({ values: { valence: 1 }, mood: { p: -1.5, a: 1, d: 0 } }));
});

test("describePersonality reports bands, warnings, mood and the prompt", () => {
  const description = describePersonality(lore, basePersonality({
    values: { attach_anxiety: 1.6, honesty_humility: -1 },
  }));
  assert.equal(description.bands.attach_anxiety.band, "very_high");
  assert.ok(description.warnings.some((warning) => warning.startsWith("Sycophancy risk")));
  assert.equal(description.mood.label, "neutral");
  assert.equal(description.prompt, description.steering.prompt);
});

test("describeShift summarizes trait, mood, tag and rule changes, or returns null", () => {
  const before = basePersonality();
  const after = basePersonality({
    values: { communion: 1 },
    mood: { p: -1.2, a: -0.6, d: -0.6 },
    tags: ["dry"],
  });
  assert.equal(describeShift(lore, profileOf(before), profileOf(before)), null);

  const { summary } = describeShift(lore, profileOf(before), profileOf(after));
  assert.match(summary, /much more warm/);
  assert.match(summary, /mood neutral → sad/);
  assert.match(summary, /voice \+Dry wit/);
});

test("lore controls expose labels but not the prompt text", () => {
  const controls = loreControls(lore);
  assert.equal(controls.axes.length, 9);
  assert.deepEqual(Object.keys(controls.axes[0]).sort(), ["group", "high", "id", "low", "name"]);
  assert.ok(!JSON.stringify(controls).includes(lore.axes[0].text.mid));
  assert.deepEqual(controls.presets[0], { id: "0", name: "The Steady Mentor" });
});
