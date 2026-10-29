// How a scene moves the mood. Each scene the mood decays partway back toward the character's
// resting mood, then takes the scene's jolt:
//   mood = baseline + (mood - baseline) * (1 - decay) + impulse * gain
// Labile characters feel events harder (more gain); stable ones settle back faster (more decay).
import { clamp } from "../lore/dials.js";
import { metatraits } from "../lore/metatraits.js";
import { MOOD_AXES } from "../lore/mood.js";

const DIAL_RANGE = 2;
const MOOD_DECIMALS = 2;

function rounded(value) {
  return Number(value.toFixed(MOOD_DECIMALS));
}

// The mood a character settles into when nothing is happening, from the lorebook's mood.rest
// weights over traits and master dials.
export function baselineMood(lore, values) {
  const masterDials = metatraits(lore, values);
  const restWeights = lore.mood.rest ?? {};
  const baseline = {};
  for (const moodAxis of MOOD_AXES) {
    let total = 0;
    for (const [dialName, weight] of Object.entries(restWeights[moodAxis] ?? {})) {
      const dialValue = values[dialName] ?? masterDials[dialName] ?? 0;
      total += weight * dialValue;
    }
    baseline[moodAxis] = rounded(clamp(total));
  }
  return baseline;
}

// The scene's push on each mood axis, from the configured weights over appraisal fields.
export function moodImpulse(storyConfig, appraisal) {
  const impulse = {};
  for (const moodAxis of MOOD_AXES) {
    let total = 0;
    for (const [field, weight] of Object.entries(storyConfig.moodImpulse[moodAxis] ?? {})) {
      total += weight * (appraisal[field] ?? 0);
    }
    impulse[moodAxis] = rounded(total);
  }
  return impulse;
}

// Gain and decay come from stability, scaled from the dial's -2..2 to -1..1.
export function moodResponsiveness(storyConfig, stability) {
  const dynamics = storyConfig.moodDynamics;
  const scaledStability = clamp(stability) / DIAL_RANGE;
  return {
    gain: dynamics.gainBase + dynamics.gainPerStability * scaledStability,
    decay: dynamics.decayBase + dynamics.decayPerStability * scaledStability,
  };
}

export function updateMood({ storyConfig, mood, baseline, impulse, stability }) {
  const { gain, decay } = moodResponsiveness(storyConfig, stability);
  const nextMood = {};
  for (const moodAxis of MOOD_AXES) {
    const distanceFromBaseline = mood[moodAxis] - baseline[moodAxis];
    const settled = baseline[moodAxis] + distanceFromBaseline * (1 - decay);
    nextMood[moodAxis] = rounded(clamp(settled + impulse[moodAxis] * gain));
  }
  return nextMood;
}
