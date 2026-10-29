// The story engine's pure logic: appraisal from emotions, mood, stress, effective master dials,
// trait drift and one full scene step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lore } from "./helpers.js";
import { loadStoryConfig, validateStoryConfig } from "../src/story/loadStoryConfig.js";
import { emotionsToAppraisal, discountNeutral } from "../src/story/emotionsToAppraisal.js";
import {
  baselineMood,
  moodImpulse,
  moodResponsiveness,
  updateMood,
} from "../src/story/moodDynamics.js";
import { updateStress } from "../src/story/stress.js";
import { effectiveMetatraits, effectivePersonality } from "../src/story/effectivePersonality.js";
import { detectPatterns, driftValues } from "../src/story/traitDrift.js";
import { appendToLedger, initialEngineState } from "../src/story/engineState.js";
import { runScene } from "../src/story/runScene.js";
import { describeEngine } from "../src/story/describeEngine.js";
import { normalizePersonality } from "../src/lore/personality.js";

const storyConfig = loadStoryConfig();

const CALM_APPRAISAL = {
  goal_impact: 0,
  novelty: 0,
  control: 0,
  social: "none",
  threat: 0,
  safety: 0,
};

function appraisal(overrides) {
  return { ...CALM_APPRAISAL, ...overrides };
}

function personalityWith(overrides = {}) {
  return normalizePersonality(lore, { name: "Rowan", ...overrides });
}

function ledgerOf(appraisals) {
  return appraisals.map((sceneAppraisal, index) => ({
    scene: index + 1,
    ts: index,
    appraisal: sceneAppraisal,
  }));
}

test("the story config loads frozen and rejects missing sections", () => {
  assert.ok(Object.isFrozen(storyConfig.emotionMap.fields));
  assert.throws(() => validateStoryConfig({ emotionModel: {} }), /missing: emotionMap/);
});

test("neutral-heavy scores are rescaled so the emotional signal counts", () => {
  const rescaled = discountNeutral({ neutral: 0.5, anger: 0.2 }, storyConfig.emotionModel);
  assert.equal(rescaled.anger, 0.4);
  assert.ok(!("neutral" in rescaled));
});

test("fear and anger read as threat that hurts the character's goals and control", () => {
  const result = emotionsToAppraisal(storyConfig, { fear: 0.7, anger: 0.4, neutral: 0.1 });
  assert.equal(result.threat, 1);
  assert.ok(result.goal_impact < -0.5);
  assert.ok(result.control < 0);
  assert.equal(result.safety, 0);
  assert.equal(result.social, "hostility");
  assert.deepEqual(
    result.emotions.map((emotion) => emotion.label),
    ["fear", "anger", "neutral"],
  );
});

test("caring and gratitude read as kindness and safety", () => {
  const result = emotionsToAppraisal(storyConfig, { gratitude: 0.8, caring: 0.3 });
  assert.equal(result.social, "kindness");
  assert.ok(result.safety > 0.5);
  assert.ok(result.goal_impact > 0.5);
  assert.equal(result.threat, 0);
});

test("weak emotions give no social meaning", () => {
  const result = emotionsToAppraisal(storyConfig, { neutral: 0.9, approval: 0.02 });
  assert.equal(result.social, "none");
});

test("the resting mood comes from the lorebook's mood.rest weights", () => {
  const cheerful = baselineMood(lore, personalityWith({ values: { valence: 2 } }).values);
  const neutral = baselineMood(lore, personalityWith().values);
  assert.deepEqual(neutral, { p: 0, a: 0, d: 0 });
  assert.ok(cheerful.p > 1);
});

test("the impulse follows the configured appraisal weights", () => {
  const impulse = moodImpulse(
    storyConfig,
    appraisal({ goal_impact: -0.5, threat: 1, control: 0.5 }),
  );
  assert.deepEqual(impulse, { p: -0.5, a: 0.8, d: 0.5 });
});

test("labile characters feel scenes harder and settle back slower", () => {
  const labile = moodResponsiveness(storyConfig, -2);
  const stable = moodResponsiveness(storyConfig, 2);
  assert.equal(labile.gain, 2);
  assert.equal(stable.gain, 1);
  assert.ok(labile.decay < stable.decay);
});

test("mood decays toward the baseline over quiet scenes and stays on the dial", () => {
  const baseline = { p: 0, a: 0, d: 0 };
  const quiet = { p: 0, a: 0, d: 0 };
  let mood = { p: 1.8, a: -1.5, d: 0 };
  for (let scene = 0; scene < 6; scene += 1) {
    mood = updateMood({ storyConfig, mood, baseline, impulse: quiet, stability: 0 });
  }
  assert.ok(Math.abs(mood.p) < 0.2);

  const jolted = updateMood({
    storyConfig,
    mood: { p: 1.9, a: 0, d: 0 },
    baseline,
    impulse: { p: 2, a: 0, d: 0 },
    stability: 0,
  });
  assert.equal(jolted.p, 2);
});

test("stress builds over threatening scenes and drains on a safe one", () => {
  let stress = 0;
  const readings = [];
  for (let scene = 0; scene < 3; scene += 1) {
    stress = updateStress(storyConfig, stress, appraisal({ threat: 0.9 }));
    readings.push(stress);
  }
  assert.ok(readings[0] < readings[1] && readings[1] < readings[2]);
  const afterSafety = updateStress(storyConfig, stress, appraisal({ safety: 1 }));
  assert.ok(afterSafety < stress);
  assert.equal(updateStress(storyConfig, 0, appraisal({ safety: 1 })), 0);
});

test("stress lowers stability and the scene moves plasticity, leaving the base alone", () => {
  const values = personalityWith().values;
  const engineState = {
    ...initialEngineState(),
    stress: 1,
    lastAppraisal: appraisal({ threat: 0.8, safety: 0.2 }),
  };
  const masterDials = effectiveMetatraits(lore, storyConfig, values, engineState);
  assert.deepEqual(masterDials.stability, { base: 0, effective: -1 });
  assert.deepEqual(masterDials.plasticity, { base: 0, effective: -0.6 });

  const effective = effectivePersonality(lore, storyConfig, personalityWith(), engineState);
  assert.ok(effective.values.reactivity > 0);
  assert.equal(values.reactivity, 0);
});

test("with no shift, effective values are left exactly as they are", () => {
  const drifted = personalityWith({ values: { valence: 0.537 } });
  const unchanged = effectivePersonality(lore, storyConfig, drifted, initialEngineState());
  assert.equal(unchanged.values.valence, 0.537);
});

test("repeated rejection forms a pattern; a single one doesn't", () => {
  const once = detectPatterns(storyConfig, ledgerOf([appraisal({ social: "rejection" })]));
  assert.deepEqual(once, []);
  const twice = detectPatterns(
    storyConfig,
    ledgerOf([appraisal({ social: "rejection" }), appraisal({ social: "rejection" })]),
  );
  assert.equal(twice[0].kind, "rejection");
  assert.equal(twice[0].repeats, 2);
});

test("drift moves traits a small step, and entrenched traits move less", () => {
  const pattern = { kind: "rejection", repeats: 3, strength: 0.5, effects: { attach_anxiety: 1 } };
  const fromCentre = driftValues(storyConfig, { attach_anxiety: 0 }, [pattern]);
  const fromEntrenched = driftValues(storyConfig, { attach_anxiety: 1.5 }, [pattern]);
  assert.equal(fromCentre.changes.attach_anxiety, 0.01);
  assert.ok(fromEntrenched.changes.attach_anxiety < fromCentre.changes.attach_anxiety);
});

test("the ledger keeps only its most recent entries", () => {
  let ledger = [];
  for (let scene = 1; scene <= 5; scene += 1) {
    ledger = appendToLedger(ledger, { scene }, 3);
  }
  assert.deepEqual(
    ledger.map((entry) => entry.scene),
    [3, 4, 5],
  );
});

test("a scene moves the mood, raises stress, logs the scene and drifts traits on repeats", () => {
  let personality = personalityWith();
  let engineState = undefined;
  const rejection = appraisal({
    goal_impact: -0.6,
    threat: 0.5,
    control: -0.4,
    social: "rejection",
  });
  for (let scene = 1; scene <= 3; scene += 1) {
    const outcome = runScene({
      lore,
      storyConfig,
      personality,
      engineState,
      appraisal: rejection,
      timestamp: scene,
    });
    personality = outcome.personality;
    engineState = outcome.engineState;
  }
  assert.equal(engineState.scene, 3);
  assert.equal(engineState.ledger.length, 3);
  assert.ok(engineState.stress > 0);
  assert.ok(personality.mood.p < -1);
  assert.ok(personality.values.attach_anxiety > 0);
  assert.ok(engineState.drift.attach_anxiety > 0);

  const view = describeEngine({ lore, storyConfig, personality, engineState });
  assert.equal(view.patterns[0].kind, "rejection");
  assert.equal(view.recentScenes[0].scene, 3);
  assert.ok(view.drift.some((entry) => entry.name === "Attachment anxiety"));
  assert.ok(view.masterDials.stability.effective < view.masterDials.stability.base);
});
