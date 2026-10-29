// What the interface shows about a chat's story engine: stress, base vs effective master dials,
// the resting mood, the last appraisal, patterns forming, trait drift so far and recent scenes.
import { baselineMood } from "./moodDynamics.js";
import { effectiveMetatraits } from "./effectivePersonality.js";
import { detectPatterns } from "./traitDrift.js";
import { normalizeEngineState } from "./engineState.js";

function axisName(lore, axisId) {
  const axis = lore.axes.find((candidate) => candidate.id === axisId);
  return axis ? axis.name : axisId;
}

function describePatterns(lore, storyConfig, ledger) {
  return detectPatterns(storyConfig, ledger).map((pattern) => ({
    kind: pattern.kind,
    repeats: pattern.repeats,
    effects: Object.entries(pattern.effects).map(([axisId, direction]) => ({
      axis: axisId,
      name: axisName(lore, axisId),
      direction: Math.sign(direction),
    })),
  }));
}

function describeDrift(lore, driftTotals) {
  const entries = Object.entries(driftTotals).filter(([, total]) => total !== 0);
  return entries.map(([axisId, total]) => ({ axis: axisId, name: axisName(lore, axisId), total }));
}

function describeRecentScenes(storyConfig, ledger) {
  const recentEntries = ledger.slice(-storyConfig.recentSceneCount).reverse();
  return recentEntries.map((entry) => ({
    scene: entry.scene,
    social: entry.appraisal.social,
    threat: entry.appraisal.threat,
    safety: entry.appraisal.safety,
    goalImpact: entry.appraisal.goal_impact,
  }));
}

export function describeEngine({ lore, storyConfig, personality, engineState }) {
  const state = normalizeEngineState(engineState);
  return {
    scene: state.scene,
    stress: state.stress,
    stressMaximum: storyConfig.stress.maximum,
    masterDials: effectiveMetatraits(lore, storyConfig, personality.values, state),
    baselineMood: baselineMood(lore, personality.values),
    lastAppraisal: state.lastAppraisal,
    patterns: describePatterns(lore, storyConfig, state.ledger),
    drift: describeDrift(lore, state.drift),
    recentScenes: describeRecentScenes(storyConfig, state.ledger),
  };
}
