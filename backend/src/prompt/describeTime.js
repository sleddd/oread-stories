// The real-world time line of the scene note: what time it is for the person writing, and how
// long it has been since the conversation last moved. Characters use it the way a person would
// (a greeting that suits the hour, noticing a long absence) without the story losing its own
// clock.

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
  "Let this shape {speaker} the way real time would, when it fits: a greeting that suits the " +
  "hour, noticing they've been away a while. Never announce the time, and if the story keeps " +
  "its own clock, the story's time wins.";

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
