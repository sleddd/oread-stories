// Reads and checks request bodies for memory entries the user writes or edits in the memory
// editor, and for memory searches.
import {
  requireObject,
  optionalString,
  optionalInteger,
  optionalStringList,
  rejectUnknownFields,
  requireSomeField,
} from "../http/validate.js";
import { badRequest } from "../http/errors.js";
import {
  MEMORY_KINDS,
  MAX_MEMORY_TEXT_LENGTH,
  MAX_MEMORY_ABOUT_ITEMS,
  MAX_MEMORY_ABOUT_LENGTH,
  MIN_MEMORY_IMPORTANCE,
  MAX_MEMORY_IMPORTANCE,
} from "./limits.js";

const NEW_ENTRY_FIELDS = ["kind", "text", "about", "importance"];
const CHANGEABLE_FIELDS = ["text", "about", "importance"];
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const MAX_QUERY_LENGTH = 500;

function readKind(kind) {
  if (!MEMORY_KINDS.includes(kind)) {
    throw badRequest(`kind must be one of ${MEMORY_KINDS.join(", ")}.`, { field: "kind" });
  }
  return kind;
}

function readText(text) {
  const cleaned = optionalString(text, "text", { max: MAX_MEMORY_TEXT_LENGTH });
  if (cleaned === undefined) {
    return undefined;
  }
  if (!cleaned.trim()) {
    throw badRequest("text can't be empty.", { field: "text" });
  }
  return cleaned.trim();
}

function readOptionalFields(input) {
  const fields = {};
  const about = optionalStringList(input.about, "about", {
    maxItems: MAX_MEMORY_ABOUT_ITEMS,
    maxLength: MAX_MEMORY_ABOUT_LENGTH,
  });
  const importance = optionalInteger(input.importance, "importance", {
    min: MIN_MEMORY_IMPORTANCE,
    max: MAX_MEMORY_IMPORTANCE,
  });
  if (about !== undefined) {
    fields.about = about;
  }
  if (importance !== undefined) {
    fields.importance = importance;
  }
  return fields;
}

export function readNewMemoryEntry(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, NEW_ENTRY_FIELDS);
  if (input.text === undefined) {
    throw badRequest("text is required.", { field: "text" });
  }
  return { kind: readKind(input.kind), text: readText(input.text), ...readOptionalFields(input) };
}

export function readMemoryEntryChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, CHANGEABLE_FIELDS);
  requireSomeField(input, CHANGEABLE_FIELDS);
  const changes = readOptionalFields(input);
  const text = readText(input.text);
  if (text !== undefined) {
    changes.text = text;
  }
  return changes;
}

// From the query string: ?query=...&limit=...
export function readMemorySearch(searchParameters) {
  const query = searchParameters.get("query") ?? "";
  if (!query.trim()) {
    throw badRequest("query is required.", { field: "query" });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw badRequest(`query must be at most ${MAX_QUERY_LENGTH} characters.`, { field: "query" });
  }
  let limit = DEFAULT_SEARCH_LIMIT;
  if (searchParameters.has("limit")) {
    limit = optionalInteger(Number(searchParameters.get("limit")), "limit", {
      min: 1,
      max: MAX_SEARCH_LIMIT,
    });
  }
  return { query: query.trim(), limit };
}
