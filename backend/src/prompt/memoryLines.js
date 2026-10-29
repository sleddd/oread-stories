// How a memory entry reads in the prompt: its short id (so the character can rewrite or remove
// it), then its text and what it is about.

export function describeMemoryLine(shortId, entry) {
  let about = "";
  if (entry.about.length > 0) {
    about = ` (about ${entry.about.join(", ")})`;
  }
  return `[${shortId}] ${entry.text}${about}`;
}

// Gives each entry a short id ("m1", "m2", …) for this turn. `shortIds` maps short id → entry
// id and is shared across the turn, so recalled memories continue the numbering.
export function assignShortIds(entries, shortIds) {
  return entries.map((entry) => {
    const existing = Object.entries(shortIds).find(([, entryId]) => entryId === entry.id);
    if (existing) {
      return { shortId: existing[0], entry };
    }
    const shortId = `m${Object.keys(shortIds).length + 1}`;
    shortIds[shortId] = entry.id;
    return { shortId, entry };
  });
}
