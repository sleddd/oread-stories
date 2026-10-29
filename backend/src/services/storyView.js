// How stories and characters look to API clients. Memories are left out of story and character
// views (they can be long); the memory endpoints serve them.

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

// Stories saved before rules and opening scenes existed get empty ones.
export function describeStory(story) {
  return {
    rules: [],
    openingScene: "",
    ...story,
    characters: story.characters.map(describeCharacter),
  };
}
