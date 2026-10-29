// Guesses who will speak this turn, so their sheet can be sent with the first request. The model
// has the final say through its [[speaker: …]] header; a good guess just saves a second call.
//   1. If the newest message names exactly one AI character present, they answer.
//   2. Otherwise whoever spoke last keeps the floor.
//   3. Otherwise the first AI character present.
import { mentionsTerm } from "./termMatching.js";

// The AI characters present in a chat, in the chat's order.
export function presentAiCharacters(story, chat) {
  const present = [];
  for (const characterId of chat.presentCharacterIds ?? []) {
    const character = story.characters.find((candidate) => candidate.id === characterId);
    if (character?.role === "ai") {
      present.push(character);
    }
  }
  return present;
}

// Returns the predicted character, or null when no AI character is present.
export function predictSpeaker({ story, chat, newestMessage = "" }) {
  const present = presentAiCharacters(story, chat);
  if (present.length === 0) {
    return null;
  }
  const named = present.filter((character) => mentionsTerm(newestMessage, character.name));
  if (named.length === 1) {
    return named[0];
  }
  const lastSpeaker = present.find((character) => character.id === chat.lastSpeakerId);
  return lastSpeaker ?? present[0];
}
