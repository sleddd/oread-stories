// Trait dials: their range, and how a dial value maps to a lorebook band and a readable pole.
export const DIAL_MIN = -2;
export const DIAL_MAX = 2;

const CENTER_BAND = "mid";
const STRONG_BAND_PREFIX = "very";

export function clamp(value) {
  return Math.max(DIAL_MIN, Math.min(DIAL_MAX, value));
}

export function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

// The first band whose upper bound the value doesn't exceed; the last band otherwise.
export function bandOf(lore, value) {
  for (const band of lore.bands) {
    if (value <= band.max) {
      return band.id;
    }
  }
  return lore.bands[lore.bands.length - 1].id;
}

// The pole label a dial value leans towards, e.g. axis.high for a positive value.
export function poleLabel(axis, value) {
  if (value < 0) {
    return axis.low;
  }
  return axis.high;
}

// "Centered", "Leaning sunny" or "Strongly sunny".
export function poleText(lore, axis, value) {
  const band = bandOf(lore, value);
  if (band === CENTER_BAND) {
    return "Centered";
  }
  let strengthWord = "Leaning ";
  if (band.startsWith(STRONG_BAND_PREFIX)) {
    strengthWord = "Strongly ";
  }
  return strengthWord + poleLabel(axis, value).toLowerCase();
}
