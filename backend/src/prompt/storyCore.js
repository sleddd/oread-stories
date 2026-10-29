// The story itself as the prompt states it: title, theme, plot, conflict, point of view and the
// story's rules. Empty fields are left out.

const STORY_FIELDS = [
  ["title", "Title"],
  ["theme", "Theme"],
  ["plot", "Plot"],
  ["conflict", "Conflict"],
  ["pointOfView", "Point of view"],
];

function fieldLines(story) {
  const lines = [];
  for (const [field, label] of STORY_FIELDS) {
    const value = String(story[field] ?? "").trim();
    if (value) {
      lines.push(`${label}: ${value}`);
    }
  }
  return lines;
}

function ruleLines(story) {
  const rules = story.rules ?? [];
  if (rules.length === 0) {
    return [];
  }
  const bulletedRules = rules.map((rule) => `- ${rule}`);
  return ["Rules of this story:", ...bulletedRules];
}

// Returns "" when the story has nothing to say yet.
export function describeStoryCore(story) {
  const lines = [...fieldLines(story), ...ruleLines(story)];
  if (lines.length === 0) {
    return "";
  }
  return ["The story:", ...lines].join("\n");
}
