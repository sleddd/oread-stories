// The cast roster: one line per character, so the model knows everyone without carrying their
// full sheets. Only things that rarely change go here (it sits in the cached part of the prompt):
// the name, who plays them, the summary and the first line of their identity memory.

function identityLineOf(character) {
  const identity = character.memory.find((entry) => entry.kind === "identity");
  if (!identity) {
    return "";
  }
  const [firstLine] = identity.text.split("\n");
  return firstLine.trim();
}

function rosterLine(character) {
  let player = "played by you";
  if (character.role === "player") {
    player = "played by the person you're writing with";
  }
  const parts = [`- ${character.name} (${player})`];
  const summary = character.summary.trim();
  if (summary) {
    parts.push(`: ${summary}`);
  }
  const identityLine = identityLineOf(character);
  if (character.role === "ai" && identityLine) {
    parts.push(` In their own words: "${identityLine}"`);
  }
  return parts.join("");
}

export function buildRoster(story) {
  if (story.characters.length === 0) {
    return "";
  }
  return ["The cast:", ...story.characters.map(rosterLine)].join("\n");
}
