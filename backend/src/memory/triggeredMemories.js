// Recall by trigger: memories come back when something they are about is in front of the
// character. Walking back into the old house brings back what happened there; the broken window
// brings back who broke it. An entry is triggered when one of its `about` tags matches a term
// from the scene (the place, who's here, what's within reach, the world facts in view) or is
// mentioned in the newest message.
import { SINGLE_MEMORY_KINDS } from "../stories/limits.js";
import { termsOverlap, mentionsTerm } from "../stories/termMatching.js";

export const MAX_TRIGGERED_MEMORIES = 6;

function isTriggered(entry, terms, text) {
  return entry.about.some((aboutTag) => {
    if (mentionsTerm(text, aboutTag)) {
      return true;
    }
    return terms.some((term) => termsOverlap(aboutTag, term));
  });
}

function mostImportantFirst(first, second) {
  if (second.importance !== first.importance) {
    return second.importance - first.importance;
  }
  return second.updated - first.updated;
}

// `terms` are short names (places, people, objects); `text` is the newest message.
export function triggeredMemories(
  memory,
  { terms = [], text = "" },
  limit = MAX_TRIGGERED_MEMORIES,
) {
  const candidates = memory.filter((entry) => !SINGLE_MEMORY_KINDS.includes(entry.kind));
  const triggered = candidates.filter((entry) => isTriggered(entry, terms, text));
  return triggered.sort(mostImportantFirst).slice(0, limit);
}
