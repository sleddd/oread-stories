// Reads and checks request bodies for a story's overview: title, theme, plot, conflict, point
// of view, rules and opening scene. Every failure is a 400 naming the field.
import {
  requireObject,
  optionalString,
  optionalStringList,
  rejectUnknownFields,
  requireSomeField,
} from "../http/validate.js";
import { badRequest } from "../http/errors.js";
import {
  MAX_STORY_TITLE_LENGTH,
  MAX_STORY_FIELD_LENGTH,
  MAX_STORY_RULES,
  MAX_STORY_RULE_LENGTH,
  MAX_OPENING_SCENE_LENGTH,
} from "./limits.js";

const OVERVIEW_FIELDS = ["theme", "plot", "conflict", "pointOfView"];
const STORY_FIELDS = ["title", ...OVERVIEW_FIELDS, "rules", "openingScene"];

function readTitle(title) {
  const cleaned = optionalString(title, "title", { max: MAX_STORY_TITLE_LENGTH });
  if (cleaned === undefined) {
    return undefined;
  }
  if (!cleaned.trim()) {
    throw badRequest("title can't be empty.", { field: "title" });
  }
  return cleaned.trim();
}

function readOverviewFields(body) {
  const fields = {};
  for (const field of OVERVIEW_FIELDS) {
    const value = optionalString(body[field], field, { max: MAX_STORY_FIELD_LENGTH });
    if (value !== undefined) {
      fields[field] = value;
    }
  }
  return fields;
}

function readStoryText(body) {
  const fields = readOverviewFields(body);
  const rules = optionalStringList(body.rules, "rules", {
    maxItems: MAX_STORY_RULES,
    maxLength: MAX_STORY_RULE_LENGTH,
  });
  const openingScene = optionalString(body.openingScene, "openingScene", {
    max: MAX_OPENING_SCENE_LENGTH,
  });
  if (rules !== undefined) {
    fields.rules = rules;
  }
  if (openingScene !== undefined) {
    fields.openingScene = openingScene.trim();
  }
  return fields;
}

// For POST: a title is required.
export function readNewStory(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, STORY_FIELDS);
  if (input.title === undefined) {
    throw badRequest("title is required.", { field: "title" });
  }
  return { title: readTitle(input.title), ...readStoryText(input) };
}

// For PATCH: only the fields sent.
export function readStoryChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, STORY_FIELDS);
  requireSomeField(input, STORY_FIELDS);
  const changes = readStoryText(input);
  const title = readTitle(input.title);
  if (title !== undefined) {
    changes.title = title;
  }
  return changes;
}
