// Forgiving readers for values the model writes in its hidden notes. Unlike request validation,
// these never throw: text that's too long is cut, lists are cleaned, numbers are clamped, and
// anything unusable comes back empty, so a sloppy note loses a detail, not the turn.

export function noteText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export function noteTextList(value, { maxItems, maxLength }) {
  if (!Array.isArray(value)) {
    return [];
  }
  const texts = value.map((item) => noteText(item, maxLength)).filter(Boolean);
  return [...new Set(texts)].slice(0, maxItems);
}

export function noteInteger(value, { min, max, fallback }) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function noteObjectList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item));
}

export function sameName(first, second) {
  return String(first).trim().toLowerCase() === String(second).trim().toLowerCase();
}

export function findCharacterByName(story, name) {
  return story.characters.find((character) => sameName(character.name, name)) ?? null;
}
