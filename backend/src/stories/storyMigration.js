// Moves data from before stories into the story model. Pure: takes the stored documents and
// returns the new ones, so it can be tested without storage.
//
// - If there is no default story, "My story" is created with one AI character built from the
//   old personality (keeping its name).
// - Every chat without a story (or whose story is gone) joins the default story: all its AI characters are present,
//   the chat's engine state moves under the default story's first AI character, and existing
//   replies are marked as spoken by that character.
//
// Running it again changes nothing. personality.json is only read, never removed.
import { normalizePersonality } from "../lore/personality.js";
import { newStory, newCharacter, emptyScene } from "./factories.js";
import { withoutName } from "./characterPersonality.js";
import { DEFAULT_STORY_ID, DEFAULT_STORY_TITLE } from "./limits.js";

export function aiCharacterIds(story) {
  const aiCharacters = story.characters.filter((character) => character.role === "ai");
  return aiCharacters.map((character) => character.id);
}

function createDefaultStory({ lore, oldPersonality, timestamp, newId }) {
  const personality = normalizePersonality(lore, oldPersonality ?? {});
  const story = newStory({ id: DEFAULT_STORY_ID, title: DEFAULT_STORY_TITLE, timestamp });
  const character = newCharacter({
    id: newId(),
    name: personality.name,
    role: "ai",
    personality: withoutName(personality),
  });
  story.characters.push(character);
  return story;
}

function engineStatesFor(chat, speakerId) {
  if (!chat.engine || !speakerId) {
    return {};
  }
  return { [speakerId]: chat.engine };
}

function markSpeaker(messages, speakerId) {
  return messages.map((message) => {
    if (message.role !== "assistant" || message.speakerId || !speakerId) {
      return message;
    }
    return { ...message, speakerId };
  });
}

// Fills the story fields of a chat that has none.
export function joinStory(chat, story) {
  const presentCharacterIds = aiCharacterIds(story);
  const speakerId = presentCharacterIds[0] ?? null;
  const { engine, ...chatWithoutEngine } = chat;
  return {
    ...chatWithoutEngine,
    storyId: story.id,
    presentCharacterIds,
    lastSpeakerId: speakerId,
    scene: emptyScene(),
    engines: engineStatesFor(chat, speakerId),
    turnLog: [],
    messages: markSpeaker(chat.messages ?? [], speakerId),
  };
}

export function needsStory(chat, knownStoryIds) {
  return !knownStoryIds.has(chat.storyId);
}

export function storyIdsOf(stories) {
  return new Set(stories.map((story) => story.id));
}

// Returns the stories with the default story in them, creating it if it's missing.
export function withDefaultStory({ lore, stories, oldPersonality, timestamp, newId }) {
  const existingStories = stories ?? [];
  const defaultStory = existingStories.find((story) => story.id === DEFAULT_STORY_ID);
  if (defaultStory) {
    return { stories: existingStories, defaultStory };
  }
  const createdStory = createDefaultStory({ lore, oldPersonality, timestamp, newId });
  return { stories: [createdStory, ...existingStories], defaultStory: createdStory };
}

// Every chat without a known story joins `defaultStory`; the rest are returned unchanged.
export function withChatsInStories(chats, stories, defaultStory) {
  const knownStoryIds = storyIdsOf(stories);
  return (chats ?? []).map((chat) => {
    if (!needsStory(chat, knownStoryIds)) {
      return chat;
    }
    return joinStory(chat, defaultStory);
  });
}

// Both steps at once, for callers holding every document.
export function migrateToStories({ lore, stories, chats, oldPersonality, timestamp, newId }) {
  const storiesStep = withDefaultStory({ lore, stories, oldPersonality, timestamp, newId });
  return {
    stories: storiesStep.stories,
    chats: withChatsInStories(chats, storiesStep.stories, storiesStep.defaultStory),
  };
}
