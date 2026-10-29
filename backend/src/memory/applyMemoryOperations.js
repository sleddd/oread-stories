// Applies the parsed <<memory>> note to the story's characters. Only AI characters present in
// the scene can write memory; the player's character never gets memories written by the AI.
// Every change is returned as a log entry with the entry before and after, so the turn can show
// what changed and a regenerated reply can undo it (see revertMemoryChanges).
import { newMemoryEntry } from "../stories/factories.js";
import { findCharacterByName } from "../stories/noteValues.js";

function canWriteMemory(character, presentCharacterIds) {
  return character.role === "ai" && presentCharacterIds.includes(character.id);
}

function findEntry(character, id, shortIds) {
  const entryId = shortIds[id] ?? id;
  return character.memory.find((entry) => entry.id === entryId) ?? null;
}

function sourceFor(story, operation, turnSource) {
  if (!operation.toldBy) {
    return { ...turnSource };
  }
  const teller = findCharacterByName(story, operation.toldBy);
  if (!teller) {
    return { ...turnSource };
  }
  return { ...turnSource, toldBy: teller.id };
}

function snapshot(entry) {
  if (!entry) {
    return null;
  }
  return structuredClone(entry);
}

function addEntry({ story, character, operation, turnSource, timestamp, newId }) {
  const { op, toldBy, ...input } = operation;
  const source = sourceFor(story, operation, turnSource);
  const entry = newMemoryEntry({ id: newId(), input, source, timestamp });
  character.memory.push(entry);
  return { before: null, after: snapshot(entry) };
}

// Identity and thread entries are one per character: rewritten in place, or created once.
function rewriteSingleEntry({ character, operation, turnSource, timestamp, newId }) {
  const existing = character.memory.find((entry) => entry.kind === operation.op);
  if (!existing) {
    const input = { kind: operation.op, text: operation.text };
    const entry = newMemoryEntry({ id: newId(), input, source: { ...turnSource }, timestamp });
    character.memory.push(entry);
    return { before: null, after: snapshot(entry) };
  }
  const before = snapshot(existing);
  Object.assign(existing, { text: operation.text, source: { ...turnSource }, updated: timestamp });
  return { before, after: snapshot(existing) };
}

// Update and remove name an entry shown in the scene note.
function changeExistingEntry({ character, operation, shortIds, timestamp }) {
  const entry = findEntry(character, operation.id, shortIds);
  if (!entry) {
    return null;
  }
  const before = snapshot(entry);
  if (operation.op === "remove") {
    character.memory = character.memory.filter((candidate) => candidate.id !== entry.id);
    return { before, after: null };
  }
  Object.assign(entry, operation.changes, { updated: timestamp });
  return { before, after: snapshot(entry) };
}

// Applies one operation to one character. Returns { before, after } or null if it did nothing.
function applyOperation(context) {
  const operationName = context.operation.op;
  if (operationName === "add") {
    return addEntry(context);
  }
  if (operationName === "identity" || operationName === "thread") {
    return rewriteSingleEntry(context);
  }
  return changeExistingEntry(context);
}

// characterNotes: from parseMemoryNote. shortIds: short id → entry id for this turn.
// turnSource: { chatId, turn }. Returns { changes, rejected }.
export function applyMemoryOperations({
  story,
  presentCharacterIds,
  characterNotes,
  shortIds = {},
  turnSource,
  timestamp,
  newId,
}) {
  const changes = [];
  const rejected = [];
  for (const { characterName, operations } of characterNotes) {
    const character = findCharacterByName(story, characterName);
    if (!character || !canWriteMemory(character, presentCharacterIds)) {
      rejected.push({ characterName, reason: "not an AI character in this scene" });
      continue;
    }
    for (const operation of operations) {
      const applied = applyOperation({
        story,
        character,
        operation,
        shortIds,
        turnSource,
        timestamp,
        newId,
      });
      if (applied) {
        changes.push({ characterId: character.id, op: operation.op, ...applied });
      }
    }
  }
  return { changes, rejected };
}

function entryIdOf(change) {
  return change.after?.id ?? change.before?.id;
}

// Puts one character's memory back the way it was before `change`, unless someone has edited
// the entry since (then their edit wins).
function revertChange(character, change) {
  const entryId = entryIdOf(change);
  const index = character.memory.findIndex((entry) => entry.id === entryId);
  const current = character.memory[index];
  if (change.after && (!current || current.updated !== change.after.updated)) {
    return;
  }
  if (!change.before) {
    character.memory.splice(index, 1);
    return;
  }
  if (current) {
    character.memory[index] = structuredClone(change.before);
    return;
  }
  character.memory.push(structuredClone(change.before));
}

// Undoes logged changes, newest first. Returns the ids of entries that no longer exist.
export function revertMemoryChanges(story, changes) {
  const removedEntryIds = [];
  for (const change of [...changes].reverse()) {
    const character = story.characters.find((candidate) => candidate.id === change.characterId);
    if (!character) {
      continue;
    }
    revertChange(character, change);
    if (!change.before) {
      removedEntryIds.push(entryIdOf(change));
    }
  }
  return removedEntryIds;
}
