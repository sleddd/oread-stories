// Reads and checks a scene snapshot: what is true in a chat right now. A scene is always
// replaced whole, so fields left out become empty.
import {
  requireObject,
  optionalString,
  optionalStringList,
  rejectUnknownFields,
} from "../http/validate.js";
import { emptyScene } from "./factories.js";
import {
  MAX_SCENE_FIELD_LENGTH,
  MAX_SCENE_LIST_ITEMS,
  MAX_SCENE_LIST_ITEM_LENGTH,
} from "./limits.js";

const TEXT_FIELDS = ["location", "timeOfDay", "lastSaid", "inMotion"];
const LIST_FIELDS = ["present", "withinReach"];

export function readScene(value, field = "scene") {
  const input = requireObject(value, field);
  rejectUnknownFields(input, [...TEXT_FIELDS, ...LIST_FIELDS]);
  const scene = emptyScene();
  for (const textField of TEXT_FIELDS) {
    const text = optionalString(input[textField], `${field}.${textField}`, {
      max: MAX_SCENE_FIELD_LENGTH,
    });
    scene[textField] = text?.trim() ?? "";
  }
  for (const listField of LIST_FIELDS) {
    const items = optionalStringList(input[listField], `${field}.${listField}`, {
      maxItems: MAX_SCENE_LIST_ITEMS,
      maxLength: MAX_SCENE_LIST_ITEM_LENGTH,
    });
    scene[listField] = items ?? [];
  }
  return scene;
}
