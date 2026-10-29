// Chooses the memories the speaking character carries into this turn, within a budget:
//   1. memories triggered by what is in front of them (see memory/triggeredMemories.js)
//   2. memories close in meaning to the last few turns (the local meaning search)
//   3. the few most recently written or rewritten, so the newest experience is never lost
// Identity and thread entries are not chosen here; they always go in on their own.
import { SINGLE_MEMORY_KINDS } from "../stories/limits.js";

export const MEMORY_BUDGET = 2_400;
export const MAX_SELECTED_MEMORIES = 12;
export const RECENT_MEMORY_COUNT = 3;

function newestFirst(first, second) {
  return second.updated - first.updated;
}

export function recentMemories(memory, count = RECENT_MEMORY_COUNT) {
  const candidates = memory.filter((entry) => !SINGLE_MEMORY_KINDS.includes(entry.kind));
  return [...candidates].sort(newestFirst).slice(0, count);
}

// Each list holds memory entries in the order they should be preferred.
export function selectMemories({
  triggered = [],
  searched = [],
  recent = [],
  budget = MEMORY_BUDGET,
  maximumCount = MAX_SELECTED_MEMORIES,
}) {
  const selected = [];
  const selectedIds = new Set();
  let usedCharacters = 0;
  for (const entry of [...triggered, ...searched, ...recent]) {
    const isSingleKind = SINGLE_MEMORY_KINDS.includes(entry.kind);
    if (isSingleKind || selectedIds.has(entry.id) || selected.length >= maximumCount) {
      continue;
    }
    if (usedCharacters + entry.text.length > budget) {
      continue;
    }
    selected.push(entry);
    selectedIds.add(entry.id);
    usedCharacters += entry.text.length;
  }
  return selected;
}
