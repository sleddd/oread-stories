// Stories: listing, creating, changing and deleting them, and the chats inside them. The
// default story ("My story") can't be deleted, since the single-personality API reads from it.
import { randomUUID } from "node:crypto";
import { conflict } from "../http/errors.js";
import { newStory } from "../stories/factories.js";
import { DEFAULT_STORY_ID } from "../stories/limits.js";
import { summarizeStory, describeStory } from "./storyView.js";

function memoryEntryIdsIn(story) {
  const entryIds = [];
  for (const character of story.characters) {
    for (const entry of character.memory) {
      entryIds.push(entry.id);
    }
  }
  return entryIds;
}

export function createStoryService({
  storyRepository,
  chats,
  memoryIndex,
  now = Date.now,
  newId = randomUUID,
}) {
  async function list() {
    const stories = await storyRepository.listStories();
    return stories.map(summarizeStory);
  }

  async function get(storyId) {
    return describeStory(await storyRepository.findStory(storyId));
  }

  async function create(input) {
    const { title, ...fields } = input;
    const story = newStory({ id: newId(), title, timestamp: now(), fields });
    await storyRepository.addStory(story);
    return describeStory(story);
  }

  async function update(storyId, changes) {
    const story = await storyRepository.updateStory(storyId, (storyToChange) => {
      Object.assign(storyToChange, changes);
    });
    return describeStory(story);
  }

  async function remove(storyId) {
    if (storyId === DEFAULT_STORY_ID) {
      throw conflict("My story can't be deleted.");
    }
    const story = await storyRepository.findStory(storyId);
    await chats.removeAllInStory(storyId);
    await storyRepository.removeStory(storyId);
    await memoryIndex.forget(memoryEntryIdsIn(story));
  }

  return { list, get, create, update, remove };
}
