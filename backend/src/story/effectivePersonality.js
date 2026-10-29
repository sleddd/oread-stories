// The personality the character is operating from right now. Stress lowers Stability and the
// scene's threat or safety moves Plasticity. These shifts are temporary: they change a copy of
// the dials used for the prompt, never the saved dials.
import { clamp } from "../lore/dials.js";
import { metaValue, moveMeta } from "../lore/metatraits.js";

const STABILITY_ID = "stability";
const PLASTICITY_ID = "plasticity";
const DECIMALS = 2;
const MINIMUM_SHIFT = 0.01;

function rounded(value) {
  return Number(value.toFixed(DECIMALS));
}

function findMetatrait(lore, metatraitId) {
  return (lore.metatraits || []).find((metatrait) => metatrait.id === metatraitId);
}

function plasticityShift(storyConfig, appraisal) {
  if (!appraisal) {
    return 0;
  }
  const shift = storyConfig.plasticityShift;
  return appraisal.safety * shift.perSafety + appraisal.threat * shift.perThreat;
}

// Base and effective values of both master dials for the current engine state.
export function effectiveMetatraits(lore, storyConfig, values, engineState) {
  const stabilityTrait = findMetatrait(lore, STABILITY_ID);
  const plasticityTrait = findMetatrait(lore, PLASTICITY_ID);
  const baseStability = stabilityTrait ? metaValue(stabilityTrait, values) : 0;
  const basePlasticity = plasticityTrait ? metaValue(plasticityTrait, values) : 0;
  const stress = engineState?.stress ?? 0;
  const sceneShift = plasticityShift(storyConfig, engineState?.lastAppraisal);
  return {
    stability: {
      base: rounded(baseStability),
      effective: rounded(clamp(baseStability - stress)),
    },
    plasticity: {
      base: rounded(basePlasticity),
      effective: rounded(clamp(basePlasticity + sceneShift)),
    },
  };
}

// moveMeta rounds every trait it touches, so it's only used when the dial really moves;
// otherwise drifted values like 0.54 would be nudged and could change band.
function shiftMasterDial(lore, metatraitId, values, masterDial) {
  const metatrait = findMetatrait(lore, metatraitId);
  const hasShift = Math.abs(masterDial.effective - masterDial.base) >= MINIMUM_SHIFT;
  if (!metatrait || !hasShift) {
    return values;
  }
  return moveMeta(metatrait, values, masterDial.effective);
}

// A copy of the personality with the temporary master-dial shifts applied to its trait values.
export function effectivePersonality(lore, storyConfig, personality, engineState) {
  if (!engineState) {
    return personality;
  }
  const masterDials = effectiveMetatraits(lore, storyConfig, personality.values, engineState);
  let values = shiftMasterDial(lore, STABILITY_ID, personality.values, masterDials.stability);
  values = shiftMasterDial(lore, PLASTICITY_ID, values, masterDials.plasticity);
  return { ...personality, values };
}
