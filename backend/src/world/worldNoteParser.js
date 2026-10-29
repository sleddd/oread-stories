// Reads the <<world>> note: { "scene": {…}, "state": [operation, …] }.
// The scene is cleaned field by field (cut to size, never rejected for being long). It comes
// back null when the note has no usable scene, so the previous one is kept. State operations are
// "set" (by subject) and "remove" (by subject).
import { emptyScene } from "../stories/factories.js";
import {
  MAX_SCENE_FIELD_LENGTH,
  MAX_SCENE_LIST_ITEMS,
  MAX_SCENE_LIST_ITEM_LENGTH,
  MAX_WORLD_STATE_SUBJECT_LENGTH,
  MAX_WORLD_STATE_FACT_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
} from "../stories/limits.js";
import { noteText, noteTextList, noteObjectList } from "../stories/noteValues.js";

export const MAX_STATE_OPERATIONS_PER_TURN = 8;
const SCENE_TEXT_FIELDS = ["location", "timeOfDay", "lastSaid", "inMotion"];
const SCENE_LIST_FIELDS = ["present", "withinReach"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readScene(rawScene) {
  if (!isObject(rawScene)) {
    return null;
  }
  const scene = emptyScene();
  for (const field of SCENE_TEXT_FIELDS) {
    scene[field] = noteText(rawScene[field], MAX_SCENE_FIELD_LENGTH);
  }
  for (const field of SCENE_LIST_FIELDS) {
    scene[field] = noteTextList(rawScene[field], {
      maxItems: MAX_SCENE_LIST_ITEMS,
      maxLength: MAX_SCENE_LIST_ITEM_LENGTH,
    });
  }
  const hasAnything = Object.values(scene).some((value) => value.length > 0);
  if (!hasAnything) {
    return null;
  }
  return scene;
}

function readStateOperation(rawOperation) {
  const operationName = String(rawOperation.op ?? "set").toLowerCase();
  const subject = noteText(rawOperation.subject, MAX_WORLD_STATE_SUBJECT_LENGTH);
  if (!subject) {
    return null;
  }
  if (operationName === "remove") {
    return { op: "remove", subject };
  }
  const fact = noteText(rawOperation.fact, MAX_WORLD_STATE_FACT_LENGTH);
  if (operationName !== "set" || !fact) {
    return null;
  }
  const keywords = noteTextList(rawOperation.keywords, {
    maxItems: MAX_KEYWORDS,
    maxLength: MAX_KEYWORD_LENGTH,
  });
  return { op: "set", subject, fact, keywords };
}

// Returns { scene, stateOperations }.
export function parseWorldNote(note) {
  if (!note) {
    return { scene: null, stateOperations: [] };
  }
  const stateOperations = noteObjectList(note.state).map(readStateOperation).filter(Boolean);
  return {
    scene: readScene(note.scene),
    stateOperations: stateOperations.slice(0, MAX_STATE_OPERATIONS_PER_TURN),
  };
}
