// Which world notes go into the prompt. Pinned notes always do, in the cached prefix. Other notes
// join the turn's scene note only when one of their keywords comes up in the scene or the recent
// conversation, up to a character budget.
import { mentionsAnyTerm } from "../stories/termMatching.js";

export const SCENE_WORLD_NOTES_BUDGET = 3_000;

export function pinnedWorldNotes(story) {
  return story.worldNotes.filter((note) => note.pinned);
}

export function describeWorldNote(note) {
  const text = note.text.trim();
  if (!text) {
    return `- ${note.title}`;
  }
  return `- ${note.title}: ${text}`;
}

// The pinned notes as a prompt section, or "" when there are none.
export function describePinnedWorldNotes(story) {
  const notes = pinnedWorldNotes(story);
  if (notes.length === 0) {
    return "";
  }
  return ["The world:", ...notes.map(describeWorldNote)].join("\n");
}

function isTriggeredBy(note, scanText) {
  return !note.pinned && mentionsAnyTerm(scanText, note.keywords);
}

// `scanText` is the scene and the recent conversation. Notes are kept in their story order until
// the budget runs out.
export function selectWorldNotes(story, scanText, budget = SCENE_WORLD_NOTES_BUDGET) {
  const selected = [];
  let usedCharacters = 0;
  for (const note of story.worldNotes) {
    if (!isTriggeredBy(note, scanText)) {
      continue;
    }
    const size = describeWorldNote(note).length;
    if (usedCharacters + size > budget) {
      continue;
    }
    selected.push(note);
    usedCharacters += size;
  }
  return selected;
}
