// Everything the interface shows about a personality besides its raw values.
import { bandOf, poleText } from "./dials.js";
import { metatraits } from "./metatraits.js";
import { moodLabel } from "./mood.js";
import { activePatterns } from "./patterns.js";
import { buildPrompt } from "./prompt.js";
import { buildSteering } from "./steering.js";

function describeBands(lore, values) {
  const bands = {};
  for (const axis of lore.axes) {
    const value = values[axis.id] ?? 0;
    const band = bandOf(lore, value);
    bands[axis.id] = { band, pole: poleText(lore, axis, value), text: axis.text[band] };
  }
  return bands;
}

function warningTexts(lore, values) {
  const warnings = activePatterns(lore, values).filter((pattern) => pattern.kind === "warning");
  return warnings.map((pattern) => pattern.text);
}

export function describePersonality(lore, personality) {
  const mood = moodLabel(lore, personality);
  const values = personality.values;
  return {
    mood: { label: mood.label, intensity: mood.intensity },
    metatraits: metatraits(lore, values),
    bands: describeBands(lore, values),
    warnings: warningTexts(lore, values),
    prompt: buildPrompt(lore, personality),
    steering: buildSteering(lore, personality),
  };
}
