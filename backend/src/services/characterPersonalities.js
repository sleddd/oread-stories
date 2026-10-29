// The personality operations (read, patch, randomize, presets, engine updates…) aimed at one
// character of one story. Used by the cast API and by the story engine, which moves each
// character's mood and traits.
import { createPersonalityOperations } from "./personalityOperations.js";
import { personalityOfCharacter, withoutName } from "../stories/characterPersonality.js";
import { findCharacterIn } from "./characterRecords.js";

export function createCharacterPersonalities({ lore, storyRepository, random }) {
  function forCharacter(storyId, characterId) {
    async function load() {
      const story = await storyRepository.findStory(storyId);
      return personalityOfCharacter(lore, findCharacterIn(story, characterId));
    }
    async function save(personality) {
      await storyRepository.updateStory(storyId, (story) => {
        const character = findCharacterIn(story, characterId);
        character.name = personality.name;
        character.personality = withoutName(personality);
      });
    }
    return createPersonalityOperations({ lore, load, save, random });
  }

  return { forCharacter };
}
