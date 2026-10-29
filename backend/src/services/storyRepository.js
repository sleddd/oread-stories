// Storage access for stories. All stories (with their characters, memories, world notes and
// world state) live in one "stories" document; changes run read-modify-write under the store's
// lock. Every call waits for the move into stories to finish first.
import { notFound } from "../http/errors.js";

const STORIES_DOCUMENT = "stories";

function storyNotFound(storyId) {
  return notFound(`There is no story "${storyId}".`);
}

// Existing items keep their place (replaced by an imported one with the same id); new ones go
// at the end.
export function mergeById(existingItems, importedItems) {
  const itemsById = new Map(existingItems.map((item) => [item.id, item]));
  for (const item of importedItems) {
    itemsById.set(item.id, item);
  }
  return [...itemsById.values()];
}

function findIn(stories, storyId) {
  const story = stories.find((candidate) => candidate.id === storyId);
  if (!story) {
    throw storyNotFound(storyId);
  }
  return story;
}

export function createStoryRepository({ store, migration, now }) {
  async function listStories() {
    await migration.ensureMigrated();
    return (await store.read(STORIES_DOCUMENT, [])) || [];
  }

  async function findStory(storyId) {
    return findIn(await listStories(), storyId);
  }

  // Applies `applyChange` to one story, stamps its update time and returns what applyChange
  // returned (or the saved story when it returned nothing).
  async function updateStory(storyId, applyChange) {
    await migration.ensureMigrated();
    let result;
    await store.update(STORIES_DOCUMENT, [], (stories) => {
      const story = findIn(stories, storyId);
      const changeResult = applyChange(story);
      story.updated = now();
      result = changeResult ?? story;
      return stories;
    });
    return structuredClone(result);
  }

  async function addStory(story) {
    await migration.ensureMigrated();
    await store.update(STORIES_DOCUMENT, [], (stories) => [...stories, story]);
  }

  async function removeStory(storyId) {
    await migration.ensureMigrated();
    await store.update(STORIES_DOCUMENT, [], (stories) => {
      findIn(stories, storyId);
      return stories.filter((story) => story.id !== storyId);
    });
  }

  // Adds or replaces stories by id (used by import).
  async function saveStories(importedStories) {
    await migration.ensureMigrated();
    await store.update(STORIES_DOCUMENT, [], (stories) => mergeById(stories, importedStories));
  }

  return { listStories, findStory, updateStory, addStory, removeStory, saveStories };
}
