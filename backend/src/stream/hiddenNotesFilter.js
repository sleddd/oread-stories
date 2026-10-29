// Holds back the hidden notes at the end of a streamed reply. Everything from the first note tag
// (<<updates>>, <<memory>> or <<world>>) onward is kept aside and never shown; the text before it
// streams through. A tag split across chunks is held until it can be told apart from reply text,
// and trailing whitespace is held until more text follows, so the blank line before the notes is
// never shown.
import { NOTE_OPEN_TAGS } from "./hiddenNotes.js";

// The length of the longest end of `text` that is the start of a note tag.
function partialTagLength(text) {
  const longestTag = Math.max(...NOTE_OPEN_TAGS.map((tag) => tag.length));
  const longestCheck = Math.min(longestTag - 1, text.length);
  for (let length = longestCheck; length > 0; length--) {
    const ending = text.slice(text.length - length);
    if (NOTE_OPEN_TAGS.some((tag) => tag.startsWith(ending))) {
      return length;
    }
  }
  return 0;
}

function firstTagIndex(text) {
  const positions = NOTE_OPEN_TAGS.map((tag) => text.indexOf(tag));
  const found = positions.filter((position) => position >= 0);
  if (found.length === 0) {
    return -1;
  }
  return Math.min(...found);
}

export function createHiddenNotesFilter() {
  let held = "";
  let hiddenText = "";
  let isHiding = false;

  // Returns the text that may be shown now.
  function push(chunk) {
    if (isHiding) {
      hiddenText += chunk;
      return "";
    }
    const text = held + chunk;
    held = "";
    const tagIndex = firstTagIndex(text);
    if (tagIndex >= 0) {
      isHiding = true;
      hiddenText = text.slice(tagIndex);
      return text.slice(0, tagIndex).trimEnd();
    }
    const withoutPartialTag = text.slice(0, text.length - partialTagLength(text));
    const showable = withoutPartialTag.trimEnd();
    held = text.slice(showable.length);
    return showable;
  }

  // The stream ended: returns { text, hiddenText }, the last showable text and the notes.
  function finish() {
    const text = held.trimEnd();
    held = "";
    return { text, hiddenText };
  }

  return { push, finish };
}
