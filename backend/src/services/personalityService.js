// The personality the single-character API (/personality) reads and changes: the first AI
// character of the default story. Older clients keep working while personalities live on
// characters.
import { DEFAULT_STORY_ID } from "../stories/limits.js";
import { personalityOfCharacter, withoutName } from "../stories/characterPersonality.js";
import { primaryCharacterOf } from "./characterRecords.js";
import { createPersonalityOperations } from "./personalityOperations.js";
import { conflict } from "../http/errors.js";

function noPrimaryCharacter() {
  return conflict("My story has no AI character to read a personality from.");
}

export function createPersonalityService({ lore, storyRepository, random }) {
  async function primaryCharacter() {
    const defaultStory = await storyRepository.findStory(DEFAULT_STORY_ID);
    const character = primaryCharacterOf(defaultStory);
    if (!character) {
      throw noPrimaryCharacter();
    }
    return character;
  }

  async function load() {
    return personalityOfCharacter(lore, await primaryCharacter());
  }

  async function save(personality) {
    await storyRepository.updateStory(DEFAULT_STORY_ID, (story) => {
      const character = primaryCharacterOf(story);
      if (!character) {
        throw noPrimaryCharacter();
      }
      character.name = personality.name;
      character.personality = withoutName(personality);
    });
  }

  async function primaryCharacterId() {
    return (await primaryCharacter()).id;
  }

  const operations = createPersonalityOperations({ lore, load, save, random });
  return { ...operations, primaryCharacterId };
}
