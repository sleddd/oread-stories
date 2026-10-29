// The story engine inside the chat flow: scenes are appraised before the reply, the reply is
// written by the changed character, and the engine can be switched off or reset.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, drain, listen, lore } from "./helpers.js";
import { loadStoryConfig } from "../src/story/loadStoryConfig.js";
import { promptRules } from "../src/lore/promptRules.js";

const storyConfig = loadStoryConfig();

const FRIGHTENING = { fear: 0.8, anger: 0.5, neutral: 0.1 };

// A stand-in for the local model: returns fixed scores and records what it was asked about.
function fakeClassifier({ scores = FRIGHTENING, fail } = {}) {
  const classifiedTexts = [];
  return {
    classifiedTexts,
    async classify(text) {
      classifiedTexts.push(text);
      if (fail) {
        throw new Error(fail);
      }
      return scores;
    },
  };
}

function setupWithEngine(options = {}) {
  const emotionClassifier = options.emotionClassifier ?? fakeClassifier();
  const built = makeApp({ storyConfig, emotionClassifier, ...options });
  return { ...built, chats: built.services.chats, emotionClassifier };
}

function eventTypes(events) {
  return events.map((event) => event.type);
}

test("a sent message is appraised before the reply, which uses the changed prompt", async () => {
  const { chats, provider, emotionClassifier } = setupWithEngine();
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "*draws a knife* Hand it over."));

  assert.deepEqual(eventTypes(events), [
    "chat",
    "appraising",
    "engine",
    "chat",
    "start",
    "speaker",
    "delta",
    "delta",
    "done",
    "chat",
  ]);
  assert.deepEqual(emotionClassifier.classifiedTexts, ["*draws a knife* Hand it over."]);

  const engineEvent = events[2];
  assert.equal(engineEvent.engine.scene, 1);
  assert.ok(engineEvent.engine.stress > 0);
  assert.equal(engineEvent.engine.lastAppraisal.social, "hostility");
  assert.ok(engineEvent.personality.personality.mood.a > 0);

  const sentNote = provider.calls[0].request.messages.at(-1).content;
  assert.equal(events[4].request.system, provider.calls[0].request.system);
  const baseRules = promptRules(lore, engineEvent.personality.personality).join("\n");
  assert.ok(sentNote.includes("Main speaker: "));
  assert.ok(!sentNote.includes(baseRules), "the reply uses the stressed, effective personality");

  const saved = events.at(-1).chat;
  assert.equal(saved.engine.scene, 1);
  assert.equal(saved.messages.filter((message) => message.role === "user").length, 1);
});

test("the mood the engine set is saved to the personality", async () => {
  const { chats, services } = setupWithEngine();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Run!"));
  const saved = await services.personality.get();
  assert.ok(saved.mood.p < 0);
});

test("regenerating replays the scene without appraising it again", async () => {
  const { chats, emotionClassifier } = setupWithEngine();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Hello"));
  const events = await drain(chats.reply(chat.id));

  assert.ok(!eventTypes(events).includes("appraising"));
  assert.equal(emotionClassifier.classifiedTexts.length, 1);
  assert.equal(events.at(-1).chat.engine.scene, 1);
});

test("asking for a reply to an unanswered message counts as a scene", async () => {
  const { chats, emotionClassifier } = setupWithEngine();
  const chat = await chats.create();
  const saved = (await drain(chats.send(chat.id, "First"))).at(-1).chat;
  await chats.deleteMessage(chat.id, saved.messages.at(-1).id);
  const events = await drain(chats.reply(chat.id));
  assert.ok(eventTypes(events).includes("engine"));
  assert.equal(emotionClassifier.classifiedTexts.length, 2);
});

test("with the engine switched off, nothing is appraised", async () => {
  const { chats, services, emotionClassifier } = setupWithEngine();
  await services.settings.patch({ engine: { enabled: false } });
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "Hello"));

  assert.deepEqual(eventTypes(events), [
    "chat",
    "start",
    "speaker",
    "delta",
    "delta",
    "done",
    "chat",
  ]);
  assert.equal(emotionClassifier.classifiedTexts.length, 0);
});

test("if appraisal fails, the scene is skipped and the reply still arrives", async () => {
  const { chats } = setupWithEngine({
    emotionClassifier: fakeClassifier({ fail: "model not downloaded" }),
  });
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "Hello"));

  const skipped = events.find((event) => event.type === "engine_skipped");
  assert.match(skipped.message, /model not downloaded/);
  assert.equal(events.at(-1).chat.messages.at(-1).content, "Hello there.");
  assert.equal(events.at(-1).chat.engine.scene, 0);
});

test("the context preview shows the prompt the stressed character would get", async () => {
  const { chats, services } = setupWithEngine();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Run!"));
  const context = await chats.context(chat.id);
  const baseRules = promptRules(lore, await services.personality.get()).join("\n");
  const sceneNote = context.messages.at(-1).content;
  assert.ok(sceneNote.includes("Main speaker: "));
  assert.ok(!sceneNote.includes(baseRules));
});

test("POST /chats/:id/engine/reset clears stress and the scene ledger", async () => {
  const { app, chats } = setupWithEngine();
  const server = await listen(app);
  try {
    const chat = await chats.create();
    await drain(chats.send(chat.id, "Run!"));
    const response = await fetch(`${server.base}/chats/${chat.id}/engine/reset`, {
      method: "POST",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.engine.scene, 0);
    assert.equal(body.engine.stress, 0);
  } finally {
    await server.close();
  }
});

test("engine.enabled must be a boolean", async () => {
  const { services } = setupWithEngine();
  await assert.rejects(services.settings.patch({ engine: { enabled: "yes" } }), /true or false/);
});

test("clearing a chat removes its messages and story state but keeps the dials", async () => {
  const { chats, services } = setupWithEngine();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Run!"));
  const moodBeforeClearing = (await services.personality.get()).mood;

  const cleared = await chats.clear(chat.id);

  assert.deepEqual(cleared.messages, []);
  assert.equal(cleared.title, "New chat");
  assert.equal(cleared.engine.scene, 0);
  assert.equal(cleared.engine.stress, 0);
  assert.equal(cleared.pendingShift, null);
  assert.deepEqual((await services.personality.get()).mood, moodBeforeClearing);
});

test("POST /chats/:id/clear empties the chat, and the next message starts a new story", async () => {
  const { app, chats } = setupWithEngine();
  const server = await listen(app);
  try {
    const chat = await chats.create();
    await drain(chats.send(chat.id, "First story"));
    const response = await fetch(`${server.base}/chats/${chat.id}/clear`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).messages, []);

    const events = await drain(chats.send(chat.id, "Second story"));
    const saved = events.at(-1).chat;
    assert.equal(saved.title, "Second story");
    assert.equal(saved.engine.scene, 1);
  } finally {
    await server.close();
  }
});
