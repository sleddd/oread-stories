// Character development: when an experience repeats across recent scenes (rejection after
// rejection, kindness after kindness), the related traits move a small step. Strong traits
// resist change:
//   trait += stepSize * patternStrength * direction / (1 + |trait|)
import { clamp } from "../lore/dials.js";

const VALUE_DECIMALS = 3;
const THREAT_PATTERN = "repeated threat";
const SAFETY_PATTERN = "repeated safety";

function rounded(value) {
  return Number(value.toFixed(VALUE_DECIMALS));
}

function countWhere(scenes, isMatch) {
  return scenes.filter(isMatch).length;
}

function patternFrom({ kind, repeats, sceneWindow, effects }) {
  return { kind, repeats, strength: repeats / sceneWindow, effects };
}

function isHighThreat(drift) {
  return (scene) => scene.appraisal.threat >= drift.highThreat;
}

function isHighSafety(drift) {
  return (scene) => scene.appraisal.safety >= drift.highSafety;
}

// The patterns present in the most recent scenes of the ledger.
export function detectPatterns(storyConfig, ledger) {
  const drift = storyConfig.traitDrift;
  const recentScenes = ledger.slice(-drift.sceneWindow);
  const patterns = [];

  for (const [meaning, effects] of Object.entries(drift.socialEffects)) {
    const repeats = countWhere(recentScenes, (scene) => scene.appraisal.social === meaning);
    if (repeats >= drift.minimumRepeats) {
      const sceneWindow = drift.sceneWindow;
      patterns.push(patternFrom({ kind: meaning, repeats, sceneWindow, effects }));
    }
  }

  const threatRepeats = countWhere(recentScenes, isHighThreat(drift));
  if (threatRepeats >= drift.minimumRepeats) {
    patterns.push(
      patternFrom({
        kind: THREAT_PATTERN,
        repeats: threatRepeats,
        sceneWindow: drift.sceneWindow,
        effects: drift.threatEffects,
      }),
    );
  }

  const safetyRepeats = countWhere(recentScenes, isHighSafety(drift));
  if (safetyRepeats >= drift.minimumRepeats) {
    patterns.push(
      patternFrom({
        kind: SAFETY_PATTERN,
        repeats: safetyRepeats,
        sceneWindow: drift.sceneWindow,
        effects: drift.safetyEffects,
      }),
    );
  }
  return patterns;
}

// Applies one scene's worth of drift. Returns the new values and how much each trait moved.
export function driftValues(storyConfig, values, patterns) {
  const stepSize = storyConfig.traitDrift.stepSize;
  const nextValues = { ...values };
  const changes = {};
  for (const pattern of patterns) {
    for (const [axisId, direction] of Object.entries(pattern.effects)) {
      if (nextValues[axisId] === undefined) {
        continue;
      }
      const resistance = 1 + Math.abs(nextValues[axisId]);
      const step = (stepSize * pattern.strength * direction) / resistance;
      nextValues[axisId] = rounded(clamp(nextValues[axisId] + step));
      changes[axisId] = rounded((changes[axisId] ?? 0) + step);
    }
  }
  return { values: nextValues, changes };
}
