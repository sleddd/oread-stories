// The scene snapshot as the prompt states it: what is true right now.

const SCENE_TEXT_FIELDS = [
  ["location", "Where"],
  ["timeOfDay", "When"],
];
const SCENE_LIST_FIELDS = [
  ["present", "Who's here"],
  ["withinReach", "Within reach"],
];
const SCENE_MOTION_FIELDS = [
  ["inMotion", "In motion"],
  ["lastSaid", "Last said"],
];

const EMPTY_SCENE_LINE =
  "Nothing has been set yet. Establish where everyone is as the scene unfolds.";

function sceneLines(scene) {
  const lines = [];
  for (const [field, label] of SCENE_TEXT_FIELDS) {
    if (scene[field]) {
      lines.push(`${label}: ${scene[field]}`);
    }
  }
  for (const [field, label] of SCENE_LIST_FIELDS) {
    if (scene[field]?.length) {
      lines.push(`${label}: ${scene[field].join(", ")}`);
    }
  }
  for (const [field, label] of SCENE_MOTION_FIELDS) {
    if (scene[field]) {
      lines.push(`${label}: ${scene[field]}`);
    }
  }
  return lines;
}

export function describeScene(scene) {
  const lines = sceneLines(scene ?? {});
  if (lines.length === 0) {
    lines.push(EMPTY_SCENE_LINE);
  }
  return ["Right now:", ...lines].join("\n");
}

// All the scene's words in one string, for keyword and trigger matching.
export function sceneText(scene) {
  if (!scene) {
    return "";
  }
  const parts = [scene.location, scene.timeOfDay, scene.inMotion, scene.lastSaid];
  parts.push(...(scene.present ?? []), ...(scene.withinReach ?? []));
  return parts.filter(Boolean).join("\n");
}
