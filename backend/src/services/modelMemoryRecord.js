// Which models keep memories, learned as they go. After every reply, whether the model's hidden
// notes arrived (inline or from the notes-only request) is counted against that model. A model
// that misses them on most of its recent replies is judged not to keep memories: it is left out
// of the model list, and a turn that misses its notes says so. Kept with each person's settings,
// written only by the app.
//
// records: { "featherless:Some/Model": { replies, withNotes } }

export const MODEL_MEMORY_SECTION = "modelMemory";
// Enough replies to judge from; fewer and a model gets the benefit of the doubt.
const REPLIES_BEFORE_JUDGING = 3;
const KEEPS_MEMORY_SHARE = 0.5;
// Counts are halved once a model reaches this many replies, so recent behaviour weighs most and
// a model that improves (or a prompt change that helps it) can win its place back.
const REPLIES_REMEMBERED = 20;
const MAX_RECORDED_MODELS = 200;

export const KEEPS_MEMORIES = "keeps";
export const MISSES_MEMORIES = "misses";
export const NOT_YET_KNOWN = "unknown";

export function recordKey(provider, model) {
  return `${provider}:${model}`;
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    isCount(record.replies) &&
    isCount(record.withNotes) &&
    record.withNotes <= record.replies
  );
}

// The saved records, keeping only well-formed ones.
export function readRecords(saved) {
  const records = {};
  if (saved === null || typeof saved !== "object") {
    return records;
  }
  for (const [key, record] of Object.entries(saved)) {
    if (isRecord(record)) {
      records[key] = { replies: record.replies, withNotes: record.withNotes };
    }
  }
  return records;
}

function halved(record) {
  return { replies: Math.ceil(record.replies / 2), withNotes: Math.ceil(record.withNotes / 2) };
}

// The oldest-judged models drop off first once there are too many.
function withinLimit(records) {
  const keys = Object.keys(records);
  if (keys.length <= MAX_RECORDED_MODELS) {
    return records;
  }
  const keptKeys = keys.slice(keys.length - MAX_RECORDED_MODELS);
  return Object.fromEntries(keptKeys.map((key) => [key, records[key]]));
}

// The records with one more reply counted for `key`.
export function withOutcome(records, key, hasNotes) {
  const previous = records[key] ?? { replies: 0, withNotes: 0 };
  let record = {
    replies: previous.replies + 1,
    withNotes: previous.withNotes + (hasNotes ? 1 : 0),
  };
  if (record.replies >= REPLIES_REMEMBERED) {
    record = halved(record);
  }
  // Re-added at the end, so the most recently used models are the last to drop off.
  const others = { ...records };
  delete others[key];
  return withinLimit({ ...others, [key]: record });
}

export function memoryVerdict(record) {
  if (!record || record.replies < REPLIES_BEFORE_JUDGING) {
    return NOT_YET_KNOWN;
  }
  if (record.withNotes / record.replies >= KEEPS_MEMORY_SHARE) {
    return KEEPS_MEMORIES;
  }
  return MISSES_MEMORIES;
}
