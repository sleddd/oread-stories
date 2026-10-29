// Storage, settings, personality and model-context services, tested without HTTP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lore, sequence, clock, makeApp } from "./helpers.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createSettingsService } from "../src/services/settingsService.js";
import { buildContext, windowStart, conversationTurns } from "../src/services/context.js";

function neutralPersonality(name) {
  const values = {};
  for (const axis of lore.axes) {
    values[axis.id] = 0;
  }
  return { name, values, mood: { p: 0, a: 0, d: 0 }, tags: [], rules: [] };
}

test("memory store returns copies and update is read-modify-write", async () => {
  const store = createMemoryStore({ list: [1] });
  const copy = await store.read("list");
  copy.push(99);
  assert.deepEqual(await store.read("list"), [1]);

  const concurrentUpdates = [1, 2, 3].map((number) => {
    return store.update("list", [], (list) => [...list, number + 1]);
  });
  await Promise.all(concurrentUpdates);
  assert.deepEqual((await store.read("list")).sort(), [1, 2, 3, 4]);
  assert.equal(await store.read("missing", "fallback"), "fallback");
});

test("settings never expose secrets, only where they came from", async () => {
  const store = createMemoryStore({ settings: { anthropic: { apiKey: "sk-ant-secret-1234" } } });
  const settings = createSettingsService({ store, env: { OPENAI_API_KEY: "sk-openai-9876" } });
  const view = await settings.get();
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes("secret-1234") && !serialized.includes("openai-9876"));
  assert.deepEqual(view.secrets.anthropic.apiKey, { source: "saved", hint: "…1234" });
  assert.deepEqual(view.secrets.openai.apiKey, { source: "env", hint: "…9876" });
  assert.deepEqual(view.secrets.gemini.apiKey, { source: "" });
  assert.equal(view.anthropic.model, "claude-sonnet-5-5");
});

test("settings patch: empty secret is unchanged, null clears, saved wins over env", async () => {
  const settings = createSettingsService({
    store: createMemoryStore(),
    env: { ANTHROPIC_API_KEY: "env-key-0000" },
  });
  const anthropicKey = async () => (await settings.providerConfig("anthropic")).apiKey;

  await settings.patch({ anthropic: { apiKey: "saved-key-1111" } });
  assert.equal(await anthropicKey(), "saved-key-1111");
  await settings.patch({ anthropic: { apiKey: "" } });
  assert.equal(await anthropicKey(), "saved-key-1111");
  await settings.patch({ anthropic: { apiKey: null } });
  assert.equal(await anthropicKey(), "env-key-0000");
});

test("settings patch validates fields and rejects unknown ones", async () => {
  const settings = createSettingsService({ store: createMemoryStore(), env: {} });
  await assert.rejects(settings.patch({ provider: "skynet" }), /provider must be one of/);
  await assert.rejects(settings.patch({ nope: {} }), /Unknown setting "nope"/);
  await assert.rejects(settings.patch({ generation: { maxTokens: 5 } }), /16 to 64000/);
  await assert.rejects(settings.patch({ generation: { temperature: "hot" } }), /temperature/);

  const view = await settings.patch({
    provider: "gemini",
    generation: { temperature: "0.7" },
    memory: { historyWindow: 10 },
  });
  assert.equal(view.provider, "gemini");
  assert.equal(view.generation.temperature, 0.7);
  assert.equal(view.memory.historyWindow, 10);
});

test("settings drop fields from older versions", async () => {
  const store = createMemoryStore({
    settings: {
      memory: { historyWindow: 8, rollingSummary: true },
      user: { name: "Kit", description: "x" },
    },
  });
  const view = await createSettingsService({ store, env: {} }).get();
  assert.deepEqual(view.memory, { historyWindow: 8 });
  assert.deepEqual(view.user, { name: "Kit" });
});

test("personality patch merges dials and returns the derived view", async () => {
  const service = makeApp().services.personality;
  const { personality, derived } = await service.patch({
    values: { communion: 1.5 },
    mood: { p: 1 },
    tags: ["dry"],
  });
  assert.equal(personality.values.communion, 1.5);
  assert.equal(personality.values.valence, 0);
  assert.equal(personality.mood.p, 1);
  assert.match(derived.prompt, /You are warm and attentive/);
  assert.equal((await service.read()).personality.values.communion, 1.5);
});

test("personality patch rejects unknown traits, tags and out-of-range dials", async () => {
  const service = makeApp().services.personality;
  const sidewaysRule = { situation: "upset", axis: "valence", dir: "sideways", amount: "slight" };
  await assert.rejects(service.patch({ values: { charisma: 1 } }), /Unknown trait "charisma"/);
  await assert.rejects(service.patch({ values: { valence: 3 } }), /between -2 and 2/);
  await assert.rejects(service.patch({ tags: ["sparkly"] }), /Unknown tag/);
  await assert.rejects(service.patch({ rules: [sidewaysRule] }), /dir must be/);
  await assert.rejects(service.patch({ colour: "blue" }), /Unknown field "colour"/);
});

test("personality master dials, presets, reset and PUT", async () => {
  const service = makeApp({ random: () => 0.5 }).services.personality;
  const moved = await service.patch({ metatraits: { plasticity: 1 } });
  assert.equal(moved.derived.metatraits.plasticity, 1);

  assert.equal((await service.applyPreset("1")).personality.values.openness, 2);
  await assert.rejects(service.applyPreset("99"), (error) => error.status === 404);
  assert.equal((await service.reset()).personality.values.openness, 0);

  const replaced = await service.replace({ name: "Ilse", values: { agency: 1 } });
  assert.equal(replaced.personality.name, "Ilse");
  assert.deepEqual(replaced.personality.tags, []);
});

test("context sends only talk turns from the window, plus the draft", () => {
  const messages = [
    { role: "user", content: "one" },
    { role: "assistant", content: "two" },
    { role: "shift", content: "far more warm" },
    { role: "user", content: "three" },
    { role: "assistant", content: "four" },
  ];
  assert.equal(windowStart(5, 2), 3);
  assert.equal(conversationTurns(messages).length, 4);

  const context = buildContext(lore, neutralPersonality("R"), messages, {
    historyWindow: 2,
    draft: " five ",
  });
  assert.deepEqual(context.messages, [
    { role: "user", content: "three" },
    { role: "assistant", content: "four" },
    { role: "user", content: "five" },
  ]);
  assert.match(context.system, /^You are /);
});

test("test helpers produce stable ids and times", () => {
  const nextId = sequence("c");
  const now = clock(0);
  assert.deepEqual([nextId(), nextId(), now(), now()], ["c1", "c2", 1000, 2000]);
});
