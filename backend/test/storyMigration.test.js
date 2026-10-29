// Moving data from before stories into "My story": the pure migration, and the runner against a
// store holding data shaped like today's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lore, sequence, makeApp } from "./helpers.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { migrateToStories } from "../src/stories/storyMigration.js";
import { DEFAULT_STORY_ID } from "../src/stories/limits.js";
import { loadStoryConfig } from "../src/story/loadStoryConfig.js";

const OLD_ENGINE_STATE = { scene: 3, stress: 0.4, lastAppraisal: null, ledger: [], drift: {} };

function oldPersonality() {
  return {
    name: "Ilse",
    values: { communion: 1.5 },
    mood: { p: 0.5, a: 0, d: 0 },
    tags: ["dry"],
    rules: [],
  };
}

function oldChat(id) {
  return {
    id,
    title: "Before stories",
    messages: [
      { id: `${id}-user`, role: "user", content: "Hello", ts: 1 },
      { id: `${id}-reply`, role: "assistant", content: "Hi.", ts: 2 },
    ],
    profile: { values: {}, mood: { p: 0, a: 0, d: 0 }, tags: [], rules: [] },
    engine: OLD_ENGINE_STATE,
    created: 1,
    updated: 2,
  };
}

function migrate(documents) {
  return migrateToStories({
    lore,
    stories: documents.stories,
    chats: documents.chats,
    oldPersonality: documents.personality,
    timestamp: 5,
    newId: sequence("character"),
  });
}

test("the old personality becomes the AI character of My story, keeping its name", () => {
  const { stories } = migrate({ personality: oldPersonality(), chats: [] });
  assert.equal(stories.length, 1);
  const [story] = stories;
  assert.equal(story.id, DEFAULT_STORY_ID);
  assert.equal(story.title, "My story");
  assert.deepEqual(story.worldNotes, []);
  assert.deepEqual(story.worldState, []);
  const [character] = story.characters;
  assert.equal(character.name, "Ilse");
  assert.equal(character.role, "ai");
  assert.equal(character.personality.values.communion, 1.5);
  assert.deepEqual(character.personality.tags, ["dry"]);
  assert.ok(!("name" in character.personality));
  assert.equal(character.abilities.strength, 10);
  assert.deepEqual(character.memory, []);
});

test("old chats join My story and their engine state moves under its character", () => {
  const { stories, chats } = migrate({ personality: oldPersonality(), chats: [oldChat("c1")] });
  const characterId = stories[0].characters[0].id;
  const [chat] = chats;
  assert.equal(chat.storyId, DEFAULT_STORY_ID);
  assert.deepEqual(chat.presentCharacterIds, [characterId]);
  assert.equal(chat.lastSpeakerId, characterId);
  assert.deepEqual(chat.engines, { [characterId]: OLD_ENGINE_STATE });
  assert.ok(!("engine" in chat));
  assert.deepEqual(chat.turnLog, []);
  assert.equal(chat.scene.location, "");
  assert.equal(chat.messages[1].speakerId, characterId);
  assert.ok(!("speakerId" in chat.messages[0]));
  assert.equal(chat.title, "Before stories");
  assert.ok(chat.profile);
});

test("running the migration again changes nothing", () => {
  const first = migrate({ personality: oldPersonality(), chats: [oldChat("c1")] });
  const second = migrate({ personality: oldPersonality(), ...first });
  assert.deepEqual(second.stories, first.stories);
  assert.deepEqual(second.chats, first.chats);
});

test("with no old personality, My story gets a default character", () => {
  const { stories } = migrate({ chats: [] });
  assert.equal(stories[0].characters[0].name, "Rowan");
});

test("chats whose story is gone join My story", () => {
  const first = migrate({ personality: oldPersonality(), chats: [] });
  const strayChat = { ...oldChat("c2"), storyId: "deleted-story" };
  const { chats } = migrate({ stories: first.stories, chats: [strayChat] });
  assert.equal(chats[0].storyId, DEFAULT_STORY_ID);
});

test("the runner migrates a store with today's data and keeps personality.json", async () => {
  const store = createMemoryStore({ personality: oldPersonality(), chats: [oldChat("c1")] });
  const { services } = makeApp({ store });

  const chats = await services.chats.list();
  assert.equal(chats[0].storyId, DEFAULT_STORY_ID);
  assert.equal((await services.personality.get()).name, "Ilse");

  const documents = store.snapshot();
  assert.equal(documents.personality.name, "Ilse");
  assert.equal(documents.stories.length, 1);
  assert.equal(documents.chats[0].storyId, DEFAULT_STORY_ID);
});

test("the old personality API reads and writes the My story character", async () => {
  const store = createMemoryStore({ personality: oldPersonality() });
  const { services } = makeApp({ store });
  await services.personality.patch({ name: "Wren", values: { agency: 1 } });

  const [character] = store.snapshot().stories[0].characters;
  assert.equal(character.name, "Wren");
  assert.equal(character.personality.values.agency, 1);
  assert.equal(store.snapshot().personality.name, "Ilse");
});

test("old chats keep working with the story engine state that moved", async () => {
  const store = createMemoryStore({ personality: oldPersonality(), chats: [oldChat("c1")] });
  const storyConfig = loadStoryConfig();
  const emotionClassifier = { classify: async () => ({ neutral: 1 }) };
  const { services } = makeApp({ store, storyConfig, emotionClassifier });
  const chat = await services.chats.get("c1");
  assert.equal(chat.engine.scene, 3);
});
