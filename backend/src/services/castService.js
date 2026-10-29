// A story's cast: adding, changing and removing characters, and each character's personality
// (the same operations as the single-personality API, aimed at one character).
// A story has at most one player character, and the default story always keeps an AI
// character, since the single-personality API reads from it.
import { randomUUID } from "node:crypto";
import { conflict } from "../http/errors.js";
import { normalizePersonality } from "../lore/personality.js";
import { newCharacter } from "../stories/factories.js";
import { DEFAULT_STORY_ID } from "../stories/limits.js";
import { withoutName } from "../stories/characterPersonality.js";
import { findCharacterIn } from "./characterRecords.js";
import { describeCharacter } from "./storyView.js";

function countCharactersWithRole(story, role, exceptCharacterId) {
  const matching = story.characters.filter((character) => {
    return character.role === role && character.id !== exceptCharacterId;
  });
  return matching.length;
}

function checkOnePlayer(story, role, characterId) {
  if (role === "player" && countCharactersWithRole(story, "player", characterId) > 0) {
    throw conflict("This story already has a player character.");
  }
}

// Throws if the change would leave the default story without an AI character.
function checkDefaultStoryKeepsAnAi(story, characterId) {
  if (story.id !== DEFAULT_STORY_ID) {
    return;
  }
  if (countCharactersWithRole(story, "ai", characterId) === 0) {
    throw conflict("My story needs at least one AI character.");
  }
}

export function createCastService({
  lore,
  storyRepository,
  characterPersonalities,
  chats,
  memoryIndex,
  newId = randomUUID,
}) {
  // Skills keep their id when they have one, so the interface can track rows.
  function withSkillIds(skills) {
    return skills.map((skill) => ({ ...skill, id: skill.id || newId() }));
  }

  async function list(storyId) {
    const story = await storyRepository.findStory(storyId);
    return story.characters.map(describeCharacter);
  }

  async function get(storyId, characterId) {
    const story = await storyRepository.findStory(storyId);
    return describeCharacter(findCharacterIn(story, characterId));
  }

  async function create(storyId, input) {
    const { name, role, abilities, skills, ...fields } = input;
    const defaultPersonality = withoutName(normalizePersonality(lore, {}));
    const character = newCharacter({ id: newId(), name, role, personality: defaultPersonality });
    Object.assign(character, fields);
    Object.assign(character.abilities, abilities ?? {});
    character.skills = withSkillIds(skills ?? []);
    await storyRepository.updateStory(storyId, (story) => {
      checkOnePlayer(story, role, character.id);
      story.characters.push(character);
    });
    return describeCharacter(character);
  }

  function applyCharacterChanges(story, character, changes) {
    const { abilities, skills, ...fields } = changes;
    if (fields.role !== undefined) {
      checkOnePlayer(story, fields.role, character.id);
      if (fields.role === "player") {
        checkDefaultStoryKeepsAnAi(story, character.id);
      }
    }
    Object.assign(character, fields);
    Object.assign(character.abilities, abilities ?? {});
    if (skills !== undefined) {
      character.skills = withSkillIds(skills);
    }
  }

  async function update(storyId, characterId, changes) {
    const character = await storyRepository.updateStory(storyId, (story) => {
      const characterToChange = findCharacterIn(story, characterId);
      applyCharacterChanges(story, characterToChange, changes);
      return characterToChange;
    });
    return describeCharacter(character);
  }

  async function remove(storyId, characterId) {
    const character = await storyRepository.updateStory(storyId, (story) => {
      const characterToRemove = findCharacterIn(story, characterId);
      checkDefaultStoryKeepsAnAi(story, characterId);
      story.characters = story.characters.filter((candidate) => candidate.id !== characterId);
      return characterToRemove;
    });
    await chats.forgetCharacter(storyId, characterId);
    await memoryIndex.forget(character.memory.map((entry) => entry.id));
  }

  // The personality operations for one character.
  function personalityOf(storyId, characterId) {
    return characterPersonalities.forCharacter(storyId, characterId);
  }

  return { list, get, create, update, remove, personalityOf };
}
