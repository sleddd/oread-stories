// Finding characters inside a story. The primary character is the story's first AI character;
// for the default story it is the one the single-personality API stands for.
import { notFound } from "../http/errors.js";

export function findCharacterIn(story, characterId) {
  const character = story.characters.find((candidate) => candidate.id === characterId);
  if (!character) {
    throw notFound(`There is no character "${characterId}" in this story.`);
  }
  return character;
}

export function primaryCharacterOf(story) {
  return story.characters.find((character) => character.role === "ai") ?? null;
}
