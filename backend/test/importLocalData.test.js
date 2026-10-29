// Moving a local Oread into an account, with made-up data shaped like a real backend/data folder.
// The pure steps and an in-memory account always run; the script against Postgres runs with
// TEST_DATABASE_URL.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { lore, sequence, clock } from "./helpers.js";
import {
  databaseSkipReason,
  testDatabaseUrl,
  connectTestDatabase,
  createTestUser,
  deleteTestUsers,
  uniqueId,
  TEST_SECRET_KEY,
} from "./databaseHelpers.js";
import { prepareLocalImport, importLocalData } from "../src/importer/importLocalData.js";
import { createDocumentStorage } from "../src/tenancy/documentStorage.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createSecretCipher } from "../src/security/secretCipher.js";
import { DEFAULT_STORY_ID } from "../src/stories/limits.js";

const runFile = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(new URL("../scripts/importLocalData.js", import.meta.url));

function sampleDocuments() {
  const mara = {
    id: "char-mara",
    name: "Mara",
    role: "ai",
    summary: "",
    backstory: "",
    abilities: {},
    skills: [],
    personality: {},
    memory: [
      { id: "mem-1", kind: "event", text: "The barn burned down.", about: [], importance: 4 },
    ],
  };
  const story = {
    id: DEFAULT_STORY_ID,
    title: "My story",
    characters: [mara],
    worldNotes: [],
    worldState: [],
    created: 1,
    updated: 1,
  };
  return {
    stories: [story],
    chats: [
      { id: "chat-1", title: "Night one", storyId: DEFAULT_STORY_ID, messages: [] },
      { id: "chat-old", title: "Before stories", messages: [] },
    ],
    personality: { name: "Mara" },
    memoryIndex: {
      "mem-1": { textHash: "hash-1", vector: [0.1, 0.2, 0.3] },
      "mem-gone": { textHash: "hash-2", vector: [0.4, 0.5, 0.6] },
    },
    settings: {
      provider: "anthropic",
      anthropic: { apiKey: "sk-ant-local-9999", model: "claude-test", baseUrl: "" },
    },
  };
}

test("preparing puts story-less chats in My story and drops stray vectors", () => {
  const prepared = prepareLocalImport({
    lore,
    documents: sampleDocuments(),
    now: clock(),
    newId: sequence(),
  });
  assert.equal(prepared.stories.length, 1);
  const oldChat = prepared.chats.find((chat) => chat.id === "chat-old");
  assert.equal(oldChat.storyId, DEFAULT_STORY_ID);
  assert.deepEqual(Object.keys(prepared.vectorsById), ["mem-1"]);
  assert.equal(prepared.settings.anthropic.apiKey, "sk-ant-local-9999");
});

test("importing twice into an account gives the same result", async () => {
  const storage = createDocumentStorage({
    lore,
    store: createMemoryStore(),
    now: clock(),
    newId: sequence(),
  });
  const prepared = prepareLocalImport({
    lore,
    documents: sampleDocuments(),
    now: clock(),
    newId: sequence(),
  });
  const firstCounts = await importLocalData({ storage, prepared });
  await importLocalData({ storage, prepared });
  assert.deepEqual(firstCounts, { stories: 1, chats: 2, memoryVectors: 1, settings: true });
  assert.equal((await storage.storyRepository.listStories()).length, 1);
  assert.equal((await storage.chatRepository.listChats()).length, 2);
  assert.deepEqual(Object.keys(await storage.vectorStore.read(["mem-1", "mem-gone"])), ["mem-1"]);
  assert.equal((await storage.settingsStore.read()).anthropic.apiKey, "sk-ant-local-9999");
});

describe("the import script, into Postgres", { skip: databaseSkipReason }, () => {
  let prisma;
  let dataDirectory;
  const userIds = [];

  before(async () => {
    prisma = await connectTestDatabase();
    dataDirectory = await mkdtemp(path.join(tmpdir(), "oread-import-"));
    for (const [name, document] of Object.entries(sampleDocuments())) {
      await writeFile(path.join(dataDirectory, `${name}.json`), JSON.stringify(document));
    }
  });

  after(async () => {
    await deleteTestUsers(prisma, userIds);
    await prisma.$disconnect();
    await rm(dataDirectory, { recursive: true, force: true });
  });

  async function runScript(email) {
    return runFile(process.execPath, [SCRIPT_PATH, "--email", email, "--data", dataDirectory], {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, OREAD_SECRET_KEY: TEST_SECRET_KEY },
    });
  }

  test("imports into the account, encrypts the keys, and is safe to run again", async () => {
    const userId = await createTestUser(prisma, uniqueId("importer"));
    userIds.push(userId);
    const email = `${userId}@example.test`;
    const filesBefore = await readFile(path.join(dataDirectory, "settings.json"), "utf8");

    await runScript(email);
    const { stdout } = await runScript(email);
    assert.match(stdout, /stories: 1/);

    assert.equal(await prisma.story.count({ where: { userId } }), 1);
    assert.equal(await prisma.chat.count({ where: { userId } }), 2);
    assert.equal(await prisma.memoryEmbedding.count({ where: { userId } }), 1);
    const secret = await prisma.providerSecret.findFirst({ where: { userId } });
    assert.ok(!secret.ciphertext.includes("sk-ant"));
    const cipher = createSecretCipher(TEST_SECRET_KEY);
    const context = `${userId}:anthropic:apiKey`;
    assert.equal(cipher.decrypt(secret, context), "sk-ant-local-9999");
    assert.equal(await readFile(path.join(dataDirectory, "settings.json"), "utf8"), filesBefore);
  });

  test("refuses an email that has no account", async () => {
    await assert.rejects(runScript("nobody@example.test"), /Sign up in the app first/);
  });
});
