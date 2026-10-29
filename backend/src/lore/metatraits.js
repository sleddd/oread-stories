// Metatraits ("master dials"): weighted averages over several trait dials.
import { clamp, roundToTenth } from "./dials.js";

const METATRAIT_DECIMALS = 2;

export function metaValue(metatrait, values) {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [axisId, weight] of Object.entries(metatrait.weights)) {
    weightedSum += weight * (values[axisId] || 0);
    totalWeight += Math.abs(weight);
  }
  if (!totalWeight) {
    return 0;
  }
  return weightedSum / totalWeight;
}

export function metatraits(lore, values) {
  const result = {};
  for (const metatrait of lore.metatraits || []) {
    result[metatrait.id] = Number(metaValue(metatrait, values).toFixed(METATRAIT_DECIMALS));
  }
  return result;
}

// Moving a master dial shifts each of its traits by the same amount, in the direction of its
// weight.
export function moveMeta(metatrait, values, target) {
  const movedValues = { ...values };
  const distanceToTarget = target - metaValue(metatrait, values);
  for (const [axisId, weight] of Object.entries(metatrait.weights)) {
    if (movedValues[axisId] === undefined) {
      continue;
    }
    const shifted = movedValues[axisId] + Math.sign(weight) * distanceToTarget;
    movedValues[axisId] = clamp(roundToTenth(shifted));
  }
  return movedValues;
}
