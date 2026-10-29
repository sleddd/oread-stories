// One step of the story engine. Given the scene's appraisal, it updates stress, moves the mood,
// logs the scene, and drifts traits when a pattern repeats. Pure: returns new values.
import { baselineMood, moodImpulse, updateMood } from "./moodDynamics.js";
import { updateStress } from "./stress.js";
import { effectiveMetatraits } from "./effectivePersonality.js";
import { detectPatterns, driftValues } from "./traitDrift.js";
import { appendToLedger, addDrift, normalizeEngineState } from "./engineState.js";

export function runScene({ lore, storyConfig, personality, engineState, appraisal, timestamp }) {
  const previousState = normalizeEngineState(engineState);
  const stress = updateStress(storyConfig, previousState.stress, appraisal);
  const sceneNumber = previousState.scene + 1;
  const ledger = appendToLedger(
    previousState.ledger,
    { scene: sceneNumber, ts: timestamp, appraisal },
    storyConfig.ledgerLimit,
  );
  const stateAfterScene = {
    ...previousState,
    scene: sceneNumber,
    stress,
    lastAppraisal: appraisal,
    ledger,
  };

  // The mood responds with the stability the character has right now, frayed by stress.
  const masterDials = effectiveMetatraits(lore, storyConfig, personality.values, stateAfterScene);
  const mood = updateMood({
    storyConfig,
    mood: personality.mood,
    baseline: baselineMood(lore, personality.values),
    impulse: moodImpulse(storyConfig, appraisal),
    stability: masterDials.stability.effective,
  });

  const patterns = detectPatterns(storyConfig, ledger);
  const drifted = driftValues(storyConfig, personality.values, patterns);

  return {
    personality: { ...personality, mood, values: drifted.values },
    engineState: { ...stateAfterScene, drift: addDrift(previousState.drift, drifted.changes) },
  };
}
