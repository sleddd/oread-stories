// The one live personality: read it, change it, and describe it. The lorebook decides what's
// valid.
import { notFound } from "../http/errors.js";
import {
  normalizePersonality,
  randomize as randomizePersonality,
  applyPreset as applyPresetToPersonality,
  resetPersonality,
} from "../lore/personality.js";
import { describePersonality } from "../lore/describePersonality.js";
import { mergePersonalityPatch } from "./personalityPatch.js";

const PERSONALITY_DOCUMENT = "personality";
const PRESET_ID_PATTERN = /^\d+$/;

export function createPersonalityService({ lore, store, random = Math.random }) {
  async function get() {
    const stored = (await store.read(PERSONALITY_DOCUMENT)) || {};
    return normalizePersonality(lore, stored);
  }

  async function save(personality) {
    await store.write(PERSONALITY_DOCUMENT, personality);
    return personality;
  }

  function view(personality) {
    return { personality, derived: describePersonality(lore, personality) };
  }

  async function read() {
    return view(await get());
  }

  async function patch(body) {
    return view(await save(mergePersonalityPatch(lore, await get(), body)));
  }

  // PUT: the body is the whole personality; anything left out goes back to its default.
  async function replace(body) {
    const defaults = normalizePersonality(lore, {});
    return view(await save(mergePersonalityPatch(lore, defaults, body)));
  }

  async function randomize() {
    return view(await save(randomizePersonality(lore, await get(), random)));
  }

  async function reset() {
    return view(await save(resetPersonality(lore, await get())));
  }

  // Presets are addressed by their position in the lorebook ("0", "1", ...).
  async function applyPreset(presetId) {
    const preset = lore.presets[Number(presetId)];
    if (!PRESET_ID_PATTERN.test(String(presetId)) || !preset) {
      throw notFound(`There is no preset "${presetId}".`);
    }
    return view(await save(applyPresetToPersonality(lore, await get(), preset)));
  }

  // Puts the dials back to a stored snapshot (used to undo a pending shift).
  async function restoreProfile(profile) {
    const current = await get();
    const restored = normalizePersonality(lore, { ...current, ...structuredClone(profile) });
    return view(await save(restored));
  }

  return { get, view, read, patch, replace, randomize, reset, applyPreset, restoreProfile };
}
