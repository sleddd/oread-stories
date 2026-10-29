// A story's world: world notes the user writes (lore, setting, culture and so on), and world
// state, a short list of lasting facts about places and objects. Setting a fact about a subject
// that already has one replaces it, so world state never grows into a log.
import { randomUUID } from "node:crypto";
import { notFound, conflict } from "../http/errors.js";
import { MAX_WORLD_STATE_FACTS } from "../stories/limits.js";

function findNoteIn(story, noteId) {
  const note = story.worldNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    throw notFound(`There is no world note "${noteId}" in this story.`);
  }
  return note;
}

function findFactIn(story, factId) {
  const fact = story.worldState.find((candidate) => candidate.id === factId);
  if (!fact) {
    throw notFound(`There is no world state fact "${factId}" in this story.`);
  }
  return fact;
}

function isSameSubject(first, second) {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

function factAboutSubject(story, subject) {
  return story.worldState.find((fact) => isSameSubject(fact.subject, subject)) ?? null;
}

function checkRoomForAnotherFact(story) {
  if (story.worldState.length >= MAX_WORLD_STATE_FACTS) {
    throw conflict(`World state holds at most ${MAX_WORLD_STATE_FACTS} facts. Remove one first.`);
  }
}

// Changing a fact's subject to one another fact already has would make two facts about it.
function checkSubjectIsFree(story, subject, factId) {
  const existing = factAboutSubject(story, subject);
  if (existing && existing.id !== factId) {
    throw conflict(`There is already a fact about "${existing.subject}".`);
  }
}

export function createWorldService({ storyRepository, now = Date.now, newId = randomUUID }) {
  async function listNotes(storyId) {
    return (await storyRepository.findStory(storyId)).worldNotes;
  }

  async function createNote(storyId, input) {
    const note = { id: newId(), ...input };
    await storyRepository.updateStory(storyId, (story) => {
      story.worldNotes.push(note);
    });
    return note;
  }

  async function updateNote(storyId, noteId, changes) {
    return storyRepository.updateStory(storyId, (story) => {
      return Object.assign(findNoteIn(story, noteId), changes);
    });
  }

  async function removeNote(storyId, noteId) {
    await storyRepository.updateStory(storyId, (story) => {
      findNoteIn(story, noteId);
      story.worldNotes = story.worldNotes.filter((note) => note.id !== noteId);
    });
  }

  async function listFacts(storyId) {
    return (await storyRepository.findStory(storyId)).worldState;
  }

  // Returns { fact, isNew }: isNew is false when a fact about the same subject was replaced.
  async function setFact(storyId, input) {
    const timestamp = now();
    return storyRepository.updateStory(storyId, (story) => {
      const existing = factAboutSubject(story, input.subject);
      if (existing) {
        Object.assign(existing, input, { updated: timestamp });
        return { fact: existing, isNew: false };
      }
      checkRoomForAnotherFact(story);
      const fact = { id: newId(), ...input, updated: timestamp };
      story.worldState.push(fact);
      return { fact, isNew: true };
    });
  }

  async function updateFact(storyId, factId, changes) {
    const timestamp = now();
    return storyRepository.updateStory(storyId, (story) => {
      const fact = findFactIn(story, factId);
      if (changes.subject !== undefined) {
        checkSubjectIsFree(story, changes.subject, factId);
      }
      return Object.assign(fact, changes, { updated: timestamp });
    });
  }

  async function removeFact(storyId, factId) {
    await storyRepository.updateStory(storyId, (story) => {
      findFactIn(story, factId);
      story.worldState = story.worldState.filter((fact) => fact.id !== factId);
    });
  }

  return {
    listNotes,
    createNote,
    updateNote,
    removeNote,
    listFacts,
    setFact,
    updateFact,
    removeFact,
  };
}
