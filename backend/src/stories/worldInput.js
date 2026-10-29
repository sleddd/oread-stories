// Reads and checks request bodies for world notes (written by the user) and world state facts
// (lasting physical facts about places and objects).
import {
  requireObject,
  optionalString,
  optionalBoolean,
  optionalStringList,
  rejectUnknownFields,
  requireSomeField,
  withoutMissingFields,
} from "../http/validate.js";
import { badRequest } from "../http/errors.js";
import {
  WORLD_NOTE_CATEGORIES,
  MAX_WORLD_NOTE_TITLE_LENGTH,
  MAX_WORLD_NOTE_TEXT_LENGTH,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_WORLD_STATE_SUBJECT_LENGTH,
  MAX_WORLD_STATE_FACT_LENGTH,
} from "./limits.js";

const WORLD_NOTE_FIELDS = ["category", "title", "text", "keywords", "pinned"];
const WORLD_STATE_FIELDS = ["subject", "fact", "keywords"];

function readCategory(category) {
  if (category === undefined) {
    return undefined;
  }
  if (!WORLD_NOTE_CATEGORIES.includes(category)) {
    const categories = WORLD_NOTE_CATEGORIES.join(", ");
    throw badRequest(`category must be one of ${categories}.`, { field: "category" });
  }
  return category;
}

function readKeywords(keywords) {
  return optionalStringList(keywords, "keywords", {
    maxItems: MAX_KEYWORDS,
    maxLength: MAX_KEYWORD_LENGTH,
  });
}

// A required-when-creating string that can't be blank.
function readFilledString(value, field, maxLength) {
  const cleaned = optionalString(value, field, { max: maxLength });
  if (cleaned === undefined) {
    return undefined;
  }
  if (!cleaned.trim()) {
    throw badRequest(`${field} can't be empty.`, { field });
  }
  return cleaned.trim();
}

function requireFields(input, fields) {
  for (const field of fields) {
    if (input[field] === undefined) {
      throw badRequest(`${field} is required.`, { field });
    }
  }
}

function readWorldNoteFields(input) {
  return withoutMissingFields({
    category: readCategory(input.category),
    title: readFilledString(input.title, "title", MAX_WORLD_NOTE_TITLE_LENGTH),
    text: optionalString(input.text, "text", { max: MAX_WORLD_NOTE_TEXT_LENGTH }),
    keywords: readKeywords(input.keywords),
    pinned: optionalBoolean(input.pinned, "pinned"),
  });
}

function readWorldStateFields(input) {
  return withoutMissingFields({
    subject: readFilledString(input.subject, "subject", MAX_WORLD_STATE_SUBJECT_LENGTH),
    fact: readFilledString(input.fact, "fact", MAX_WORLD_STATE_FACT_LENGTH),
    keywords: readKeywords(input.keywords),
  });
}

export function readNewWorldNote(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, WORLD_NOTE_FIELDS);
  requireFields(input, ["title"]);
  const defaults = { category: "general", text: "", keywords: [], pinned: false };
  return { ...defaults, ...readWorldNoteFields(input) };
}

export function readWorldNoteChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, WORLD_NOTE_FIELDS);
  requireSomeField(input, WORLD_NOTE_FIELDS);
  return readWorldNoteFields(input);
}

export function readNewWorldStateFact(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, WORLD_STATE_FIELDS);
  requireFields(input, ["subject", "fact"]);
  return { keywords: [], ...readWorldStateFields(input) };
}

export function readWorldStateFactChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, WORLD_STATE_FIELDS);
  requireSomeField(input, WORLD_STATE_FIELDS);
  return readWorldStateFields(input);
}
