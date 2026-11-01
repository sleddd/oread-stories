// Learning which models keep memories: each reply counted against its model, the verdict after
// a few replies, and the turn saying why when a model keeps missing its notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, drain } from "./helpers.js";
import { fakeEmbedder, scriptedProvider, protocolReply } from "./storyHelpers.js";
import {
  KEEPS_MEMORIES,
  MISSES_MEMORIES,
  NOT_YET_KNOWN,
  memoryVerdict,
  readRecords,
  withOutcome,
} from "../src/services/modelMemoryRecord.js";

const MODEL_KEY = "anthropic:story-model";

test("a model is judged only after a few replies, by how many brought their notes", () => {
  let records = {};
  records = withOutcome(records, MODEL_KEY, false);
  records = withOutcome(records, MODEL_KEY, false);
  assert.equal(memoryVerdict(records[MODEL_KEY]), NOT_YET_KNOWN);
  records = withOutcome(records, MODEL_KEY, false);
  assert.equal(memoryVerdict(records[MODEL_KEY]), MISSES_MEMORIES);
  for (let reply = 0; reply < 4; reply++) {
    records = withOutcome(records, MODEL_KEY, true);
  }
  assert.equal(memoryVerdict(records[MODEL_KEY]), KEEPS_MEMORIES, "a model can win its place back");
  assert.deepEqual(readRecords({ broken: { replies: -1 }, [MODEL_KEY]: records[MODEL_KEY] }), {
    [MODEL_KEY]: records[MODEL_KEY],
  });
});

test("recent replies weigh most: counts are halved once a model has many", () => {
  let records = {};
  for (let reply = 0; reply < 19; reply++) {
    records = withOutcome(records, MODEL_KEY, true);
  }
  records = withOutcome(records, MODEL_KEY, true);
  assert.deepEqual(records[MODEL_KEY], { replies: 10, withNotes: 10 });
});

// A story with one AI character, and a model that never writes its notes (nor when asked).
async function setupForgetfulModel() {
  const provider = scriptedProvider([["[[speaker: Mara]]\n", "Not tonight."]]);
  provider.listModels = async () => [
    { id: "story-model", label: "Story model" },
    { id: "other-model", label: "Other model" },
  ];
  const built = makeApp({ provider, embedder: fakeEmbedder() });
  const { services } = built;
  await services.settings.patch({
    anthropic: { model: "story-model" },
    engine: { enabled: false },
  });
  const story = await services.stories.create({ title: "The Flood" });
  await services.cast.create(story.id, { name: "Mara", role: "ai" });
  const chat = await services.chats.create({ storyId: story.id });
  return { services, chat };
}

function skippedMessages(events) {
  return events.filter((event) => event.type === "notes_skipped").map((event) => event.message);
}

test("a model that keeps missing its notes is named, and stays in the list", async () => {
  const { services, chat } = await setupForgetfulModel();
  const firstTurn = await drain(services.chats.send(chat.id, "Hello"));
  assert.match(skippedMessages(firstTurn)[0], /^This reply came without its hidden notes/);
  await drain(services.chats.send(chat.id, "Still there?"));
  const thirdTurn = await drain(services.chats.send(chat.id, "Hello again"));

  assert.match(skippedMessages(thirdTurn)[0], /^story-model hasn't been keeping memories/);
  const verdict = await services.settings.memoryVerdictFor({
    provider: "anthropic",
    model: "story-model",
  });
  assert.equal(verdict, MISSES_MEMORIES);
  const listed = await services.models.listModels("anthropic");
  assert.deepEqual(
    listed.map((model) => model.id),
    ["story-model", "other-model"],
    "a story model that skips its notes stays usable: a memory model can keep its records",
  );
});

test("the record survives settings changes and can't be written from outside", async () => {
  const { services, chat } = await setupForgetfulModel();
  await drain(services.chats.send(chat.id, "Hello"));
  await services.settings.patch({ user: { name: "Claudette" } });
  const settings = await services.settings.get();
  assert.deepEqual(settings.modelMemory, {
    "anthropic:story-model": { replies: 1, withNotes: 0 },
  });
  await assert.rejects(
    services.settings.patch({ modelMemory: { "anthropic:story-model": { replies: 0 } } }),
    { status: 400 },
  );
});

test("a model that writes its notes keeps its place", async () => {
  const provider = scriptedProvider([
    protocolReply({ speaker: "Mara", text: "Not tonight.", memory: {}, world: {} }),
  ]);
  const { services } = makeApp({ provider, embedder: fakeEmbedder() });
  await services.settings.patch({
    anthropic: { model: "story-model" },
    engine: { enabled: false },
  });
  const story = await services.stories.create({ title: "The Flood" });
  await services.cast.create(story.id, { name: "Mara", role: "ai" });
  const chat = await services.chats.create({ storyId: story.id });
  for (const message of ["One", "Two", "Three"]) {
    await drain(services.chats.send(chat.id, message));
  }
  const verdict = await services.settings.memoryVerdictFor({
    provider: "anthropic",
    model: "story-model",
  });
  assert.equal(verdict, KEEPS_MEMORIES);
});
