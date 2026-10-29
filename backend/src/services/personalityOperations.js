// Everything that can be done to one personality (read, patch, replace, randomize, reset,
// presets, restore, engine updates), whichever character it belongs to. `load` and `save`
// say where the personality lives.
import { notFound } from "../http/errors.js";
import {
  normalizePersonality,
  randomize as randomizePersonality,
  applyPreset as applyPresetToPersonality,
  resetPersonality,
} from "../lore/personality.js";
import { describePersonality } from "../lore/describePersonality.js";
import { mergePersonalityPatch } from "./personalityPatch.js";

const PRESET_ID_PATTERN = /^\d+$/;

export function createPersonalityOperations({ lore, load, save, random = Math.random }) {
  async function get() {
    return normalizePersonality(lore, await load());
  }

  async function saveNormalized(personality) {
    const normalized = normalizePersonality(lore, personality);
    await save(normalized);
    return normalized;
  }

  function view(personality) {
    return { personality, derived: describePersonality(lore, personality) };
  }

  async function read() {
    return view(await get());
  }

  async function patch(body) {
    return view(await saveNormalized(mergePersonalityPatch(lore, await get(), body)));
  }

  // PUT: the body is the whole personality; anything left out goes back to its default.
  async function replace(body) {
    const defaults = normalizePersonality(lore, {});
    return view(await saveNormalized(mergePersonalityPatch(lore, defaults, body)));
  }

  async function randomize() {
    return view(await saveNormalized(randomizePersonality(lore, await get(), random)));
  }

  async function reset() {
    return view(await saveNormalized(resetPersonality(lore, await get())));
  }

  // Presets are addressed by their position in the lorebook ("0", "1", ...).
  async function applyPreset(presetId) {
    const preset = lore.presets[Number(presetId)];
    if (!PRESET_ID_PATTERN.test(String(presetId)) || !preset) {
      throw notFound(`There is no preset "${presetId}".`);
    }
    return view(await saveNormalized(applyPresetToPersonality(lore, await get(), preset)));
  }

  // Puts the dials back to a stored snapshot (used to undo a pending shift).
  async function restoreProfile(profile) {
    const current = await get();
    return view(await saveNormalized({ ...current, ...structuredClone(profile) }));
  }

  // Saves a whole personality as given, after cleaning it against the lorebook (used by
  // imports and by the story engine, which moves mood and drifts traits).
  async function set(personality) {
    return view(await saveNormalized(personality));
  }

  return {
    get,
    view,
    read,
    patch,
    replace,
    randomize,
    reset,
    applyPreset,
    restoreProfile,
    set,
  };
}
