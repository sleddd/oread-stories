// Which Featherless models are big enough for Oread. A story turn asks a lot: a long system
// prompt, a character sheet and memories, a reply in character, then three hidden JSON notes.
// Small models lose the thread under that (they ignore the newest message, recite memories and
// run past their turn), so only models of MIN_PARAMETERS_IN_BILLIONS or more are offered.
//
// The model list doesn't carry parameter counts, but each model's class names its size
// ("llama31-8b", "qwen3-0b6" for 0.6B, "deepseek4-1.6t"). A few large families name none.

// Below this, models don't even get the chance: 8B and smaller reliably lose the thread. Above
// it, whether a model keeps memories is learned from its replies (services/modelMemoryRecord.js).
export const MIN_PARAMETERS_IN_BILLIONS = 12;
export const MIN_CONTEXT_TOKENS = 16_384;

const BILLION = 1e9;
const UNITS_IN_BILLIONS = { m: 0.001, b: 1, t: 1000 };
// "8b", "0b6" (0.6), "3b8" (3.8), "1.6t", "270m": a whole part, a unit, then optional decimals.
const SIZE_PATTERN = /^(\d+(?:\.\d+)?)([mbt])(\d*)$/;
// Families whose classes carry no size but are all far above the minimum.
const LARGE_FAMILIES_WITHOUT_SIZES = ["kimi", "deepseek", "minimax", "glm", "mimo"];
// Classes that name no size but are known to be one, in billions.
const KNOWN_CLASS_SIZES = { "mistral-nemo": 12 };

function sizeOfPart(part) {
  const match = SIZE_PATTERN.exec(part);
  if (!match) {
    return null;
  }
  const [, wholePart, unit, decimalPart] = match;
  const amount = Number(decimalPart ? `${wholePart}.${decimalPart}` : wholePart);
  return amount * UNITS_IN_BILLIONS[unit];
}

// The size in billions a model class names, or null when it names none.
export function billionsInModelClass(modelClass) {
  const name = String(modelClass ?? "").toLowerCase();
  if (KNOWN_CLASS_SIZES[name]) {
    return KNOWN_CLASS_SIZES[name];
  }
  const parts = name.split("-");
  for (const part of parts.reverse()) {
    const size = sizeOfPart(part);
    if (size !== null) {
      return size;
    }
  }
  return null;
}

function isLargeFamily(modelClass) {
  const name = String(modelClass ?? "").toLowerCase();
  return LARGE_FAMILIES_WITHOUT_SIZES.some((family) => name.startsWith(family));
}

// For the model list. Unknown sizes are left out unless they belong to a large family.
export function isListedModelBigEnough(model) {
  if ((model.context_length ?? 0) < MIN_CONTEXT_TOKENS) {
    return false;
  }
  const billions = billionsInModelClass(model.model_class);
  if (billions === null) {
    return isLargeFamily(model.model_class);
  }
  return billions >= MIN_PARAMETERS_IN_BILLIONS;
}

// For one model's details (/v1/models/{id}), which carry the exact count. Returns the reason it
// won't do, or null when it will (or when Featherless doesn't say).
export function reasonModelIsTooSmall(details) {
  if (details.parameter_size && details.parameter_size < MIN_PARAMETERS_IN_BILLIONS * BILLION) {
    const billions = Math.round(details.parameter_size / BILLION);
    return `${details.id} has ${billions}B parameters`;
  }
  if (details.context_length && details.context_length < MIN_CONTEXT_TOKENS) {
    return `${details.id} has a ${Math.round(details.context_length / 1024)}k context`;
  }
  return null;
}
