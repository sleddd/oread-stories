// Reads the <<memory>> note: { "<character name>": [operation, …], … } into clean operations.
// Operations: add, update (by id), remove (by id), identity and thread (rewritten in place).
// Unknown operations and kinds are dropped; at most MAX_OPERATIONS_PER_CHARACTER are kept per
// character each turn.
import {
  MEMORY_KINDS,
  SINGLE_MEMORY_KINDS,
  MAX_MEMORY_TEXT_LENGTH,
  MAX_MEMORY_ABOUT_ITEMS,
  MAX_MEMORY_ABOUT_LENGTH,
  MIN_MEMORY_IMPORTANCE,
  MAX_MEMORY_IMPORTANCE,
  DEFAULT_MEMORY_IMPORTANCE,
  MAX_CHARACTER_NAME_LENGTH,
} from "../stories/limits.js";
import { noteText, noteTextList, noteInteger, noteObjectList } from "../stories/noteValues.js";

export const MAX_OPERATIONS_PER_CHARACTER = 8;
const MAX_ID_LENGTH = 100;
const OPERATION_NAMES = ["add", "update", "remove", "identity", "thread"];

function readAbout(value) {
  return noteTextList(value, {
    maxItems: MAX_MEMORY_ABOUT_ITEMS,
    maxLength: MAX_MEMORY_ABOUT_LENGTH,
  });
}

function readImportance(value) {
  return noteInteger(value, {
    min: MIN_MEMORY_IMPORTANCE,
    max: MAX_MEMORY_IMPORTANCE,
    fallback: DEFAULT_MEMORY_IMPORTANCE,
  });
}

// "add" with kind identity or thread means the same as the identity or thread operation.
function operationNameOf(rawOperation) {
  const name = String(rawOperation.op ?? "").toLowerCase();
  if (name === "add" && SINGLE_MEMORY_KINDS.includes(rawOperation.kind)) {
    return rawOperation.kind;
  }
  return name;
}

function readAdd(rawOperation, text) {
  if (!text || !MEMORY_KINDS.includes(rawOperation.kind)) {
    return null;
  }
  return {
    op: "add",
    kind: rawOperation.kind,
    text,
    about: readAbout(rawOperation.about),
    importance: readImportance(rawOperation.importance),
    toldBy: noteText(rawOperation.toldBy, MAX_CHARACTER_NAME_LENGTH),
  };
}

// Only the fields the model actually sent are changed.
function readUpdate(rawOperation, text, id) {
  if (!id) {
    return null;
  }
  const changes = {};
  if (text) {
    changes.text = text;
  }
  if (rawOperation.about !== undefined) {
    changes.about = readAbout(rawOperation.about);
  }
  if (rawOperation.importance !== undefined) {
    changes.importance = readImportance(rawOperation.importance);
  }
  if (Object.keys(changes).length === 0) {
    return null;
  }
  return { op: "update", id, changes };
}

function readOperation(rawOperation) {
  const operationName = operationNameOf(rawOperation);
  if (!OPERATION_NAMES.includes(operationName)) {
    return null;
  }
  const text = noteText(rawOperation.text, MAX_MEMORY_TEXT_LENGTH);
  const id = noteText(rawOperation.id, MAX_ID_LENGTH);
  if (operationName === "add") {
    return readAdd(rawOperation, text);
  }
  if (operationName === "update") {
    return readUpdate(rawOperation, text, id);
  }
  if (operationName === "remove") {
    return id ? { op: "remove", id } : null;
  }
  return text ? { op: operationName, text } : null;
}

// Returns [{ characterName, operations }].
export function parseMemoryNote(note) {
  if (!note) {
    return [];
  }
  const parsed = [];
  for (const [characterName, rawOperations] of Object.entries(note)) {
    const operations = noteObjectList(rawOperations).map(readOperation).filter(Boolean);
    if (operations.length > 0) {
      parsed.push({ characterName, operations: operations.slice(0, MAX_OPERATIONS_PER_CHARACTER) });
    }
  }
  return parsed;
}
