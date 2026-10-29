// Small formatting helpers shared by components.

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MINUS_SIGN = "−";

// Dial values read as +1.2, −0.4 or 0.0. Small changes, such as trait drift, can ask for more
// decimal places.
export function formatDialValue(value, decimalPlaces = 1) {
  const magnitude = Math.abs(value).toFixed(decimalPlaces);
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

const SMALL_NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

// "All nine traits": small counts read better as words.
export function describeTraitCount(count) {
  const countText = SMALL_NUMBER_WORDS[count] ?? String(count);
  return `All ${countText} traits`;
}
