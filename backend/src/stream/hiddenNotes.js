// Reads the three hidden notes out of the text the hidden-notes filter kept aside, in the order
// the protocol asks for them:
//   <<updates>>{json}<</updates>>   <<world>>{json}<</world>>   <<memory>>{json}<</memory>>
// A note missing its closing tag is read up to the next note's tag. The last note with no closing
// tag was cut off mid-way, so it is ignored rather than half-applied. A note that is missing or
// isn't valid JSON comes back as null; it never breaks the turn.

export const NOTE_NAMES = ["updates", "world", "memory"];
export const NOTE_OPEN_TAGS = NOTE_NAMES.map((name) => `<<${name}>>`);

const CODE_FENCE = /```(?:json)?/g;

function noteBody(hiddenText, name) {
  const openTag = `<<${name}>>`;
  const closeTag = `<</${name}>>`;
  const start = hiddenText.indexOf(openTag);
  if (start < 0) {
    return null;
  }
  const bodyStart = start + openTag.length;
  const closeIndex = hiddenText.indexOf(closeTag, bodyStart);
  if (closeIndex >= 0) {
    return hiddenText.slice(bodyStart, closeIndex);
  }
  const nextTagIndex = hiddenText.indexOf("<<", bodyStart);
  if (nextTagIndex < 0) {
    return null;
  }
  return hiddenText.slice(bodyStart, nextTagIndex);
}

function parseJsonObject(body) {
  if (body === null) {
    return null;
  }
  const cleaned = body.replace(CODE_FENCE, "").trim();
  if (!cleaned) {
    return null;
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Returns { updates, memory, world }, each a parsed object or null.
export function readHiddenNotes(hiddenText) {
  const notes = {};
  for (const name of NOTE_NAMES) {
    notes[name] = parseJsonObject(noteBody(hiddenText ?? "", name));
  }
  return notes;
}

// The visible reply without trailing whitespace or a code fence opened just before the notes.
export function cleanVisibleText(text) {
  return text.replace(/\s*```(?:json)?\s*$/, "").trimEnd();
}
