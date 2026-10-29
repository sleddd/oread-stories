// The storage contract: what every storage (tenancy/documentStorage.js and
// tenancy/databaseStorage.js) must do the same way. It always runs on the in-memory document
// storage, and on Postgres too when TEST_DATABASE_URL is set.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { lore, sequence, clock } from "./helpers.js";
import {
  databaseSkipReason,
  connectTestDatabase,
  createTestUser,
  deleteTestUsers,
  uniqueId,
  TEST_SECRET_KEY,
} from "./databaseHelpers.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createDocumentStorage } from "../src/tenancy/documentStorage.js";
import { createSecretCipher } from "../src/security/secretCipher.js";
import { DEFAULT_STORY_ID } from "../src/stories/limits.js";

function story(id, title = `Story ${id}`) {
  return { id, title, characters: [], worldNotes: [], worldState: [], created: 1, updated: 1 };
}

function chat(id, storyId = DEFAULT_STORY_ID) {
  return { id, title: `Chat ${id}`, storyId, messages: [], created: 1, updated: 1 };
}

function ids(items) {
  return items.map((item) => item.id);
}

// `makeStorage()` returns a fresh, empty storage for one user.
function storageContract(label, { makeStorage, skip = false }) {
  describe(`storage contract: ${label}`, { skip }, () => {
    it("starts every user with My story, once", async () => {
      const storage = await makeStorage();
      const [first] = await storage.storyRepository.listStories();
      assert.equal(first.id, DEFAULT_STORY_ID);
      await storage.migration.runAgain();
      assert.equal((await storage.storyRepository.listStories()).length, 1);
    });

    it("keeps stories in the order added, and finds, changes and removes them", async () => {
      const { storyRepository } = await makeStorage();
      await storyRepository.addStory(story("s1"));
      await storyRepository.addStory(story("s2"));
      assert.deepEqual(ids(await storyRepository.listStories()), [DEFAULT_STORY_ID, "s1", "s2"]);

      const changeResult = await storyRepository.updateStory("s1", (current) => {
        current.title = "Renamed";
        return { saw: current.id };
      });
      assert.deepEqual(changeResult, { saw: "s1" });
      const changed = await storyRepository.findStory("s1");
      assert.equal(changed.title, "Renamed");
      assert.notEqual(changed.updated, 1);

      await storyRepository.removeStory("s2");
      await assert.rejects(storyRepository.findStory("s2"), { status: 404 });
      await assert.rejects(storyRepository.removeStory("s2"), { status: 404 });
      await assert.rejects(
        storyRepository.updateStory("s2", () => {}),
        { status: 404 },
      );
    });

    it("leaves a story unchanged when the change throws", async () => {
      const { storyRepository } = await makeStorage();
      await storyRepository.addStory(story("s1", "Before"));
      const failingChange = (current) => {
        current.title = "After";
        throw new Error("no");
      };
      await assert.rejects(storyRepository.updateStory("s1", failingChange), /no/);
      assert.equal((await storyRepository.findStory("s1")).title, "Before");
    });

    it("applies changes made at the same time to the same story", async () => {
      const { storyRepository } = await makeStorage();
      await storyRepository.addStory({ ...story("s1"), rules: [] });
      const addRule = (rule) => {
        return storyRepository.updateStory("s1", (current) => {
          current.rules.push(rule);
        });
      };
      await Promise.all([addRule("one"), addRule("two"), addRule("three")]);
      const { rules } = await storyRepository.findStory("s1");
      assert.deepEqual([...rules].sort(), ["one", "three", "two"]);
    });

    it("lists chats newest first, and finds, changes and removes them", async () => {
      const { chatRepository } = await makeStorage();
      await chatRepository.addChat(chat("c1"));
      await chatRepository.addChat(chat("c2"));
      assert.deepEqual(ids(await chatRepository.listChats()), ["c2", "c1"]);

      const saved = await chatRepository.updateChat("c1", (current) => {
        current.title = "Renamed";
      });
      assert.equal(saved.title, "Renamed");
      assert.equal((await chatRepository.findChat("c1")).title, "Renamed");

      await chatRepository.removeChat("c2");
      await assert.rejects(chatRepository.findChat("c2"), { status: 404 });
      await assert.rejects(
        chatRepository.updateChat("c2", () => {}),
        { status: 404 },
      );
    });

    it("changes or drops every chat at once", async () => {
      const { chatRepository } = await makeStorage();
      await chatRepository.addChat(chat("c1", "keep"));
      await chatRepository.addChat(chat("c2", "drop"));
      await chatRepository.updateAllChats((chats) => {
        for (const current of chats) {
          current.title = "Touched";
        }
        return chats.filter((current) => current.storyId !== "drop");
      });
      const chats = await chatRepository.listChats();
      assert.deepEqual(ids(chats), ["c1"]);
      assert.equal(chats[0].title, "Touched");
    });

    it("adds or replaces stories and chats by id on import", async () => {
      const { storyRepository, chatRepository } = await makeStorage();
      await storyRepository.addStory(story("s1", "Old"));
      await storyRepository.saveStories([story("s1", "New"), story("s2")]);
      assert.equal((await storyRepository.findStory("s1")).title, "New");
      assert.equal((await storyRepository.findStory("s2")).title, "Story s2");

      await chatRepository.addChat(chat("c1"));
      await chatRepository.saveChats([{ ...chat("c1"), title: "New" }, chat("c2")]);
      assert.equal((await chatRepository.findChat("c1")).title, "New");
      assert.equal((await chatRepository.listChats()).length, 2);
    });

    it("saves, reads and removes memory-search vectors", async () => {
      const { vectorStore } = await makeStorage();
      await vectorStore.save({
        m1: { textHash: "h1", vector: [0.5, 0.25] },
        m2: { textHash: "h2", vector: [1, 0] },
      });
      assert.deepEqual(await vectorStore.read(["m1"]), {
        m1: { textHash: "h1", vector: [0.5, 0.25] },
      });
      await vectorStore.remove(["m1"]);
      assert.deepEqual(Object.keys(await vectorStore.read(["m1", "m2"])), ["m2"]);
    });

    it("saves settings, keys included, and clears a key set to empty", async () => {
      const { settingsStore } = await makeStorage();
      assert.equal(await settingsStore.read(), null);
      const settings = {
        provider: "anthropic",
        anthropic: { apiKey: "sk-test-1234", model: "claude-test", baseUrl: "" },
        generation: { maxTokens: 900, temperature: "" },
      };
      await settingsStore.write(settings);
      const saved = await settingsStore.read();
      assert.equal(saved.anthropic.apiKey, "sk-test-1234");
      assert.equal(saved.generation.maxTokens, 900);

      await settingsStore.write({ ...settings, anthropic: { ...settings.anthropic, apiKey: "" } });
      assert.ok(!(await settingsStore.read()).anthropic.apiKey);
    });

    it("lets one reply at a time claim a chat", async () => {
      const { chatRepository, streamingGuard } = await makeStorage();
      await chatRepository.addChat(chat("c1"));
      assert.equal(await streamingGuard.claim("c1"), true);
      assert.equal(streamingGuard.isStreaming("c1"), true);
      assert.equal(await streamingGuard.claim("c1"), false);
      await streamingGuard.release("c1");
      assert.equal(streamingGuard.isStreaming("c1"), false);
      assert.equal(await streamingGuard.claim("c1"), true);
      await streamingGuard.release("c1");
    });
  });
}

storageContract("in-memory documents", {
  makeStorage: async () => {
    return createDocumentStorage({
      lore,
      store: createMemoryStore(),
      now: clock(),
      newId: sequence(),
    });
  },
});

let prisma;
const userIds = [];

if (!databaseSkipReason) {
  before(async () => {
    prisma = await connectTestDatabase();
  });
  after(async () => {
    await deleteTestUsers(prisma, userIds);
    await prisma.$disconnect();
  });
}

storageContract("Postgres", {
  skip: databaseSkipReason,
  makeStorage: async () => {
    const { createDatabaseStorage } = await import("../src/tenancy/databaseStorage.js");
    const userId = await createTestUser(prisma, uniqueId("contract"));
    userIds.push(userId);
    return createDatabaseStorage({
      prisma,
      userId,
      lore,
      cipher: createSecretCipher(TEST_SECRET_KEY),
      claimsInProcess: new Set(),
      now: clock(),
      newId: sequence(`${userId}-`),
    });
  },
});
