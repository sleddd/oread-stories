// How stories and characters look to API clients. Memories are left out of story and character
// views (they can be long); the memory endpoints serve them.
import { CONVERSATION_STYLE } from "../prompt/replyStyles.js";

export function summarizeStory(story) {
  return {
    id: story.id,
    title: story.title,
    theme: story.theme,
    characterCount: story.characters.length,
    created: story.created,
    updated: story.updated,
  };
}

export function describeCharacter(character) {
  const { memory, ...visibleFields } = character;
  return { ...visibleFields, memoryCount: memory.length };
}

// Stories saved before rules, opening scenes and reply styles existed get the defaults.
export function describeStory(story) {
  return {
    rules: [],
    openingScene: "",
    replyStyle: CONVERSATION_STYLE,
    ...story,
    characters: story.characters.map(describeCharacter),
  };
}
