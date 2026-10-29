// Small formatting helpers shared by components.

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MINUS_SIGN = "−";

// Dial values read as +1.2, −0.4 or 0.0.
export function formatDialValue(value) {
  const magnitude = Math.abs(value).toFixed(1);
  if (value > 0) {
    return `+${magnitude}`;
  }
  if (value < 0) {
    return `${MINUS_SIGN}${magnitude}`;
  }
  return magnitude;
}

export function describeTimeAgo(timestamp, now = Date.now()) {
  const secondsAgo = (now - timestamp) / 1000;
  if (secondsAgo < SECONDS_PER_MINUTE) {
    return "just now";
  }
  if (secondsAgo < SECONDS_PER_HOUR) {
    return `${Math.floor(secondsAgo / SECONDS_PER_MINUTE)}m ago`;
  }
  if (secondsAgo < SECONDS_PER_DAY) {
    return `${Math.floor(secondsAgo / SECONDS_PER_HOUR)}h ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function initialOf(name) {
  const withoutArticle = (name || "").replace(/^the\s+/i, "").trim();
  return withoutArticle.slice(0, 1).toUpperCase() || "?";
}

// A character's avatar colour follows its dials: warmth turns the hue, volatility deepens it, mood lightens it.
export function avatarColorFor(personality) {
  const values = personality?.values ?? {};
  const pleasure = personality?.mood?.p ?? 0;
  const baseHue = 200;
  const hue = Math.round(baseHue - (values.communion ?? 0) * 45 + (values.agency ?? 0) * 15 + 360) % 360;
  const saturation = 35 + Math.abs(values.reactivity ?? 0) * 12;
  const lightness = 42 + pleasure * 4;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function formatTokenCount(count) {
  return `~${count.toLocaleString()} tokens`;
}

export function debounce(callback, delayMilliseconds) {
  let timer = null;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delayMilliseconds);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
