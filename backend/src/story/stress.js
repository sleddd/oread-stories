// Stress (allostatic load): it rises with threat, drains with safety, and carries over from
// scene to scene, so a run of bad scenes frays the character and a safe one steadies them.

const STRESS_DECIMALS = 2;

export function updateStress(storyConfig, currentStress, appraisal) {
  const settings = storyConfig.stress;
  const carriedOver = currentStress * settings.retention;
  const added = appraisal.threat * settings.perThreat;
  const relieved = appraisal.safety * settings.perSafety;
  const nextStress = carriedOver + added - relieved;
  const bounded = Math.max(0, Math.min(settings.maximum, nextStress));
  return Number(bounded.toFixed(STRESS_DECIMALS));
}
