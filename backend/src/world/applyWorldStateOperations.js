// Applies world state operations from the <<world>> note. Setting a fact about a subject replaces
// whatever was known about it; removing drops it. World state is capped, so when it is full a
// new subject is turned away instead of growing the list into a log.
import { MAX_WORLD_STATE_FACTS } from "../stories/limits.js";
import { sameName } from "../stories/noteValues.js";

function findFact(story, subject) {
  return story.worldState.find((fact) => sameName(fact.subject, subject)) ?? null;
}

function snapshot(fact) {
  if (!fact) {
    return null;
  }
  return structuredClone(fact);
}

function setFact({ story, operation, timestamp, newId }) {
  const existing = findFact(story, operation.subject);
  if (existing) {
    const before = snapshot(existing);
    Object.assign(existing, {
      fact: operation.fact,
      keywords: operation.keywords,
      updated: timestamp,
    });
    return { before, after: snapshot(existing) };
  }
  if (story.worldState.length >= MAX_WORLD_STATE_FACTS) {
    return null;
  }
  const { op, ...fields } = operation;
  const fact = { id: newId(), ...fields, updated: timestamp };
  story.worldState.push(fact);
  return { before: null, after: snapshot(fact) };
}

function removeFact(story, operation) {
  const existing = findFact(story, operation.subject);
  if (!existing) {
    return null;
  }
  story.worldState = story.worldState.filter((fact) => fact.id !== existing.id);
  return { before: snapshot(existing), after: null };
}

// Returns log entries [{ op, subject, before, after }].
export function applyWorldStateOperations({ story, operations, timestamp, newId }) {
  const log = [];
  for (const operation of operations) {
    let applied = null;
    if (operation.op === "set") {
      applied = setFact({ story, operation, timestamp, newId });
    } else {
      applied = removeFact(story, operation);
    }
    if (applied) {
      log.push({ op: operation.op, subject: operation.subject, ...applied });
    }
  }
  return log;
}

function factIdOf(change) {
  return change.after?.id ?? change.before?.id;
}

function revertFactChange(story, change) {
  const index = story.worldState.findIndex((fact) => fact.id === factIdOf(change));
  const current = story.worldState[index];
  if (change.after && (!current || current.updated !== change.after.updated)) {
    return;
  }
  if (!change.before) {
    story.worldState.splice(index, 1);
    return;
  }
  if (current) {
    story.worldState[index] = structuredClone(change.before);
    return;
  }
  story.worldState.push(structuredClone(change.before));
}

// Undoes logged changes, newest first. A fact someone edited since is left alone.
export function revertWorldStateChanges(story, log) {
  for (const change of [...log].reverse()) {
    revertFactChange(story, change);
  }
}
