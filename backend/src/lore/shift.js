// How a personality moved between two replies, summarised for the transcript's shift markers.
import { poleLabel } from "./dials.js";
import { MOOD_AXES, moodLabel } from "./mood.js";

// Smaller changes than this are treated as noise.
const NOTICEABLE_CHANGE = 0.05;
// Words for how far a trait moved, largest first.
const CHANGE_SIZES = [
  { minimum: 1.5, word: "far" },
  { minimum: 0.8, word: "much" },
  { minimum: 0.4, word: "somewhat" },
];
const SMALLEST_CHANGE_WORD = "a little";

// Snapshot of the parts of a personality that can shift mid-story.
export function profileOf(personality) {
  return {
    values: { ...personality.values },
    mood: { ...personality.mood },
    tags: [...personality.tags],
    rules: structuredClone(personality.rules),
  };
}

function changeSizeWord(change) {
  const distance = Math.abs(change);
  for (const size of CHANGE_SIZES) {
    if (distance >= size.minimum) {
      return size.word;
    }
  }
  return SMALLEST_CHANGE_WORD;
}

// e.g. ["much more warm", "a little more gloomy"]
function traitChanges(lore, before, after) {
  const changes = [];
  for (const axis of lore.axes) {
    const change = (after.values[axis.id] ?? 0) - (before.values[axis.id] ?? 0);
    if (Math.abs(change) < NOTICEABLE_CHANGE) {
      continue;
    }
    changes.push(`${changeSizeWord(change)} more ${poleLabel(axis, change).toLowerCase()}`);
  }
  return changes;
}

function hasMoodDialMoved(before, after) {
  return MOOD_AXES.some((moodAxis) => {
    const change = (after.mood[moodAxis] ?? 0) - (before.mood[moodAxis] ?? 0);
    return Math.abs(change) >= NOTICEABLE_CHANGE;
  });
}

function tagLabel(lore, tagId) {
  for (const group of lore.tags) {
    const tag = group.items.find((item) => item.id === tagId);
    if (tag) {
      return tag.label ?? tagId;
    }
  }
  return tagId;
}

function tagLabelsOnlyIn(lore, tags, otherTags) {
  const missingFromOther = tags.filter((tagId) => !otherTags.includes(tagId));
  return missingFromOther.map((tagId) => tagLabel(lore, tagId));
}

function haveRulesChanged(before, after) {
  return JSON.stringify(before.rules || []) !== JSON.stringify(after.rules || []);
}

function moodSummary(moodBefore, moodAfter) {
  if (moodBefore !== moodAfter) {
    return `mood ${moodBefore} → ${moodAfter}`;
  }
  return `mood shifts within ${moodAfter}`;
}

function voiceSummary(addedTags, removedTags) {
  const addedMarks = addedTags.map((label) => "+" + label);
  const removedMarks = removedTags.map((label) => "−" + label);
  return "voice " + [...addedMarks, ...removedMarks].join(" ");
}

// Returns {summary} describing the change, or null when nothing meaningful moved.
export function describeShift(lore, before, after) {
  if (!before) {
    return null;
  }
  const traits = traitChanges(lore, before, after);
  const moodBefore = moodLabel(lore, before).label;
  const moodAfter = moodLabel(lore, after).label;
  const hasMoodChanged = moodBefore !== moodAfter || hasMoodDialMoved(before, after);
  const addedTags = tagLabelsOnlyIn(lore, after.tags, before.tags);
  const removedTags = tagLabelsOnlyIn(lore, before.tags, after.tags);
  const hasTagsChanged = addedTags.length > 0 || removedTags.length > 0;
  const rulesChanged = haveRulesChanged(before, after);
  if (!traits.length && !hasMoodChanged && !hasTagsChanged && !rulesChanged) {
    return null;
  }

  const summaryParts = [];
  if (traits.length) {
    summaryParts.push(traits.join(", "));
  }
  if (hasMoodChanged) {
    summaryParts.push(moodSummary(moodBefore, moodAfter));
  }
  if (rulesChanged) {
    summaryParts.push("situational rules changed");
  }
  if (hasTagsChanged) {
    summaryParts.push(voiceSummary(addedTags, removedTags));
  }
  return { summary: summaryParts.join(" · ") };
}
