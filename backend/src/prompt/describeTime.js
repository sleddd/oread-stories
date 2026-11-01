// The real-world time line of the scene note: what time it is for the person writing, and how
// long it has been since the conversation last moved. It is background only: left loose, models
// turn a late hour into telling the person to go to bed, so the guidance forbids exactly that.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Gaps shorter than this are just the conversation flowing, so they go unmentioned.
const NOTICEABLE_GAP = 30 * MINUTE;

const DATE_FORMAT = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const TIME_GUIDANCE =
  "This is background for {speaker}, like the light outside: it can colour the mood, and a " +
  "long absence can be noticed the way a person would. Never use it to suggest they should " +
  "sleep, eat or stop, and don't mention the time unless they do. If the story keeps its own " +
  "clock, the story's time wins.";

function formatLocalTime(now, timeZone) {
  return new Intl.DateTimeFormat("en-US", { ...DATE_FORMAT, timeZone }).format(now);
}

function countOf(amount, unit) {
  if (amount === 1) {
    return `1 ${unit}`;
  }
  return `${amount} ${unit}s`;
}

function describeGap(gap) {
  if (gap >= DAY) {
    return countOf(Math.floor(gap / DAY), "day");
  }
  if (gap >= HOUR) {
    return countOf(Math.floor(gap / HOUR), "hour");
  }
  return countOf(Math.floor(gap / MINUTE), "minute");
}

// now and previousTurnAt are millisecond timestamps; previousTurnAt is null in a new chat.
// timeZone is an IANA name, or undefined for the server's own zone.
export function describeTime({ now, timeZone, previousTurnAt, speakerName }) {
  const localTime = formatLocalTime(now, timeZone);
  const lines = [`Real-world time for the person you're writing with: ${localTime}.`];
  const gap = now - (previousTurnAt ?? now);
  if (gap >= NOTICEABLE_GAP) {
    lines.push(`It has been ${describeGap(gap)} since the message before this one.`);
  }
  lines.push(TIME_GUIDANCE.replace("{speaker}", speakerName));
  return lines.join("\n");
}
