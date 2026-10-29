// Whole story turns with a scripted provider: the speaker header, switching speaker, recall, the
// hidden notes being applied (and undone on regenerate), memory shared across chats, the
// per-character story engine, and prompt caching.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, drain } from "./helpers.js";
import { fakeEmbedder, scriptedProvider, protocolReply } from "./storyHelpers.js";
import { loadStoryConfig } from "../src/story/loadStoryConfig.js";
import { CUT_OFF_NOTES_MESSAGE } from "../src/services/replyGenerator.js";
import { requestBody as anthropicRequestBody } from "../src/providers/anthropic.js";
import { converseBody as bedrockConverseBody } from "../src/providers/bedrock.js";

const storyConfig = loadStoryConfig();

const MARA_REPLY = {
  speaker: "Mara",
  text: "*sets the lantern down* Not tonight, Brann.",
  updates: {
    skills: [{ character: "Mara", name: "Lockpicking", change: 1, reason: "the cellar" }],
  },
  memory: {
    Mara: [
      { op: "add", kind: "person", about: ["Jenny"], text: "Jenny calls me Opy.", importance: 3 },
      { op: "thread", text: "Reaching for the cellar door." },
    ],
    Brann: [{ op: "add", kind: "event", about: ["Mara"], text: "Mara shut me out again." }],
    Jenny: [{ op: "add", kind: "self", text: "Written for the player." }],
  },
  world: {
    scene: { location: "the farmhouse kitchen", present: ["Mara", "Brann", "Jenny"] },
    state: [{ op: "set", subject: "kitchen window", fact: "broken", keywords: ["glass"] }],
  },
};

function classifierScoring(scores) {
  return {
    async classify() {
      return scores;
    },
  };
}

// A story with Mara and Brann (AI) and Jenny (the player), and a chat with everyone present.
async function setupStory(replies, options = {}) {
  const { stop, ...appOptions } = options;
  const provider = scriptedProvider(replies, { stop });
  const built = makeApp({ provider, embedder: fakeEmbedder(), ...appOptions });
  const { stories, cast, chats } = built.services;
  const story = await stories.create({ title: "The Flood", theme: "What we keep" });
  const mara = await cast.create(story.id, { name: "Mara", role: "ai" });
  const brann = await cast.create(story.id, { name: "Brann", role: "ai" });
  const jenny = await cast.create(story.id, { name: "Jenny", role: "player" });
  const chat = await chats.create({ storyId: story.id });
  return { ...built, provider, story, mara, brann, jenny, chat };
}

function eventTypes(events) {
  return events.map((event) => event.type);
}

function sentTextOf(events) {
  return events
    .filter((event) => event.type === "delta")
    .map((event) => event.text)
    .join("");
}

function lastMessageOf(call) {
  return call.request.messages.at(-1).content;
}

async function memoryTexts(services, storyId, characterId) {
  const entries = await services.memory.list(storyId, characterId);
  return entries.map((entry) => entry.text);
}

test("the right header means one call; only the reply shows and the notes apply", async () => {
  const { services, provider, story, mara, brann, jenny, chat } = await setupStory([
    protocolReply(MARA_REPLY),
  ]);
  const events = await drain(services.chats.send(chat.id, "Mara, what's in the cellar?"));

  assert.equal(provider.calls.length, 1);
  assert.deepEqual(eventTypes(events), [
    "chat",
    "start",
    "speaker",
    ...Array(eventTypes(events).filter((type) => type === "delta").length).fill("delta"),
    "done",
    "updates",
    "memory",
    "world",
    "story",
    "chat",
  ]);
  assert.equal(sentTextOf(events), "*sets the lantern down* Not tonight, Brann.");
  assert.deepEqual(events[2], {
    type: "speaker",
    characterId: mara.id,
    name: "Mara",
    switched: false,
  });

  const saved = events.at(-1).chat;
  const reply = saved.messages.at(-1);
  assert.equal(reply.content, "*sets the lantern down* Not tonight, Brann.");
  assert.equal(reply.speakerId, mara.id);
  assert.equal(saved.lastSpeakerId, mara.id);
  assert.equal(saved.scene.location, "the farmhouse kitchen");
  assert.equal(saved.turnLog.length, 1);
  assert.equal(saved.turnLog[0].messageId, reply.id);

  assert.deepEqual(await memoryTexts(services, story.id, mara.id), [
    "Jenny calls me Opy.",
    "Reaching for the cellar door.",
  ]);
  assert.deepEqual(await memoryTexts(services, story.id, brann.id), ["Mara shut me out again."]);
  assert.deepEqual(await memoryTexts(services, story.id, jenny.id), []);
  const marasSkills = (await services.cast.get(story.id, mara.id)).skills;
  assert.deepEqual(
    marasSkills.map((skill) => [skill.name, skill.level]),
    [["Lockpicking", 1]],
  );
  const facts = await services.world.listFacts(story.id);
  assert.deepEqual(
    facts.map((fact) => [fact.subject, fact.fact]),
    [["kitchen window", "broken"]],
  );
  const memoryEvent = events.find((event) => event.type === "memory");
  assert.ok(memoryEvent.changes.every((change) => change.characterName !== "Jenny"));
});

test("only the speaker's sheet is sent; the others are roster lines and threads", async () => {
  const { services, provider, story, brann, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await services.memory.create(story.id, brann.id, { kind: "thread", text: "Watching the road." });
  await services.memory.create(story.id, brann.id, { kind: "event", text: "Brann's secret." });
  await drain(services.chats.send(chat.id, "Hello"));

  const note = lastMessageOf(provider.calls[0]);
  assert.match(note, /Main speaker: Mara/);
  assert.match(note, /- Brann: Watching the road\./);
  assert.ok(!note.includes("Main speaker: Brann"));
  assert.ok(!note.includes("Brann's secret."));
  assert.match(provider.calls[0].request.system, /- Brann \(played by you\)/);
});

test("identity always goes in, and the scene's place triggers what happened there", async () => {
  const { services, provider, story, mara, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await services.memory.create(story.id, mara.id, { kind: "identity", text: "I keep the farm." });
  await services.memory.create(story.id, mara.id, {
    kind: "event",
    about: ["the old house"],
    text: "We buried the dog behind it.",
  });
  for (let index = 0; index < 5; index++) {
    await services.memory.create(story.id, mara.id, { kind: "event", text: `Chore ${index}.` });
  }
  await drain(services.chats.send(chat.id, "Hello"));
  assert.ok(!lastMessageOf(provider.calls[0]).includes("We buried the dog"));

  await services.chats.update(chat.id, {
    scene: { location: "the old house", present: [], withinReach: [] },
  });
  await drain(services.chats.send(chat.id, "Hello"));
  const note = lastMessageOf(provider.calls[1]);
  assert.match(note, /Mara's sense of self: I keep the farm\./);
  assert.match(note, /We buried the dog behind it\. \(about the old house\)/);
});

test("naming someone else re-prompts once, with their sheet and the same prefix", async () => {
  const { services, provider, brann, chat } = await setupStory([
    protocolReply({ ...MARA_REPLY, speaker: "Brann", text: "Wrong sheet." }),
    protocolReply({ ...MARA_REPLY, speaker: "Brann", text: "*shrugs* Ask her yourself." }),
  ]);
  const events = await drain(services.chats.send(chat.id, "Hello"));

  assert.equal(provider.calls.length, 2);
  assert.match(lastMessageOf(provider.calls[0]), /Main speaker: Mara/);
  assert.match(lastMessageOf(provider.calls[1]), /Main speaker: Brann/);
  assert.equal(provider.calls[0].request.system, provider.calls[1].request.system);
  assert.equal(sentTextOf(events), "*shrugs* Ask her yourself.");
  assert.ok(!sentTextOf(events).includes("Wrong sheet."));
  assert.equal(eventTypes(events).filter((type) => type === "start").length, 2);
  const speakerEvent = events.find((event) => event.type === "speaker");
  assert.deepEqual(speakerEvent, {
    type: "speaker",
    characterId: brann.id,
    name: "Brann",
    switched: true,
  });
  assert.equal(events.at(-1).chat.messages.at(-1).speakerId, brann.id);
});

test("the player's character is never the speaker", async () => {
  const { services, provider, mara, chat } = await setupStory([
    protocolReply({ ...MARA_REPLY, speaker: "Jenny" }),
  ]);
  const events = await drain(services.chats.send(chat.id, "Hello"));
  assert.equal(provider.calls.length, 1);
  assert.equal(events.at(-1).chat.messages.at(-1).speakerId, mara.id);
});

test("a recall line searches the speaker's memory and re-prompts with what they find", async () => {
  const { services, provider, story, mara, chat } = await setupStory([
    protocolReply({ ...MARA_REPLY, recall: "the night of the fire" }),
    protocolReply(MARA_REPLY),
  ]);
  for (let index = 0; index < 6; index++) {
    await services.memory.create(story.id, mara.id, { kind: "event", text: `Chore ${index}.` });
  }
  await services.memory.create(story.id, mara.id, {
    kind: "event",
    text: "The barn burned down the night of the fire.",
  });
  await services.memory.create(story.id, mara.id, { kind: "event", text: "Newest chore." });
  const events = await drain(services.chats.send(chat.id, "Hello"));

  assert.equal(provider.calls.length, 2);
  const recallEvent = events.find((event) => event.type === "recall");
  assert.equal(recallEvent.characterId, mara.id);
  assert.equal(recallEvent.query, "the night of the fire");
  assert.ok(recallEvent.found > 0);
  const secondNote = lastMessageOf(provider.calls[1]);
  assert.match(secondNote, /What Mara finds when reaching for "the night of the fire":/);
  assert.match(secondNote, /\] The barn burned down the night of the fire\./);
  assert.match(secondNote, /Don't write a recall line again/);
});

test("a turn makes at most two extra calls", async () => {
  const { services, provider, chat } = await setupStory([
    protocolReply({ ...MARA_REPLY, speaker: "Brann", recall: "anything" }),
    protocolReply({ ...MARA_REPLY, speaker: "Brann", recall: "anything" }),
    protocolReply({ ...MARA_REPLY, speaker: "Mara", recall: "again" }),
  ]);
  const events = await drain(services.chats.send(chat.id, "Hello"));
  assert.equal(provider.calls.length, 3);
  assert.equal(events.at(-1).chat.messages.at(-1).content, MARA_REPLY.text);
});

test("memory written in one chat is there in another chat of the story", async () => {
  const { services, provider, story, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await drain(services.chats.send(chat.id, "Hello"));
  const otherChat = await services.chats.create({ storyId: story.id });
  await drain(services.chats.send(otherChat.id, "A new day."));

  const otherNote = lastMessageOf(provider.calls[1]);
  assert.match(otherNote, /Jenny calls me Opy\./);
  assert.match(otherNote, /- Mara: Reaching for the cellar door\./);
  const otherSaved = await services.chats.get(otherChat.id);
  assert.equal(otherSaved.scene.location, "the farmhouse kitchen");
});

test("a user's edit to a memory is what the next prompt carries", async () => {
  const { services, provider, story, mara, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await drain(services.chats.send(chat.id, "Hello"));
  const [entry] = await services.memory.list(story.id, mara.id);
  await services.memory.update(story.id, mara.id, entry.id, { text: "Jenny calls me Mars." });
  await drain(services.chats.send(chat.id, "Again"));

  const note = lastMessageOf(provider.calls[1]);
  assert.match(note, /Jenny calls me Mars\./);
  assert.ok(!note.includes("Jenny calls me Opy."));
});

test("the scene and world facts in view are in the next scene note", async () => {
  const { services, provider, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await drain(services.chats.send(chat.id, "Hello"));
  await drain(services.chats.send(chat.id, "Careful of the glass."));

  const note = lastMessageOf(provider.calls[1]);
  assert.match(note, /Where: the farmhouse kitchen/);
  assert.match(note, /How the world stands:\n- kitchen window: broken/);
});

test("regenerating undoes the old version's notes and applies the new ones", async () => {
  const { services, story, mara, brann, chat } = await setupStory([
    protocolReply(MARA_REPLY),
    protocolReply({
      speaker: "Mara",
      text: "*laughs* Fine, come and see.",
      memory: { Mara: [{ op: "add", kind: "event", text: "I showed them the cellar." }] },
      world: { scene: { location: "the cellar" } },
    }),
  ]);
  await drain(services.chats.send(chat.id, "Hello"));
  const events = await drain(services.chats.reply(chat.id));
  const saved = events.at(-1).chat;

  assert.deepEqual(saved.messages.at(-1).alts, [MARA_REPLY.text, "*laughs* Fine, come and see."]);
  assert.deepEqual(await memoryTexts(services, story.id, mara.id), ["I showed them the cellar."]);
  assert.deepEqual(await memoryTexts(services, story.id, brann.id), []);
  assert.deepEqual((await services.cast.get(story.id, mara.id)).skills, []);
  assert.deepEqual(await services.world.listFacts(story.id), []);
  assert.equal(saved.scene.location, "the cellar");
  assert.equal(saved.turnLog.length, 1);
});

test("a reply without notes still saves, and a missing scene keeps the last one", async () => {
  const { services, chat } = await setupStory([
    protocolReply(MARA_REPLY),
    ["[[speaker: Mara]]\n", "Just words, no notes."],
  ]);
  await drain(services.chats.send(chat.id, "Hello"));
  const events = await drain(services.chats.send(chat.id, "And?"));
  const saved = events.at(-1).chat;
  assert.equal(saved.messages.at(-1).content, "Just words, no notes.");
  assert.equal(saved.scene.location, "the farmhouse kitchen");
  assert.ok(!eventTypes(events).includes("memory"));
});

// The reply as the model would write it, cut off partway through the memory note.
function cutOffInsideMemoryNote(reply) {
  const fullText = protocolReply(reply).join("");
  const cutAt = fullText.indexOf("<<memory>>") + "<<memory>>".length + 20;
  return [fullText.slice(0, cutAt)];
}

test("a reply cut off at the length limit keeps its scene, drops the unfinished memories", async () => {
  const { services, story, mara, chat } = await setupStory([cutOffInsideMemoryNote(MARA_REPLY)], {
    stop: "max_tokens",
  });
  const events = await drain(services.chats.send(chat.id, "Mara, what's in the cellar?"));

  const saved = events.at(-1).chat;
  assert.equal(saved.messages.at(-1).content, "*sets the lantern down* Not tonight, Brann.");
  assert.equal(saved.scene.location, "the farmhouse kitchen");
  assert.equal(saved.turnLog[0].isSceneReplaced, true);
  assert.equal(saved.turnLog[0].stop, "max_tokens");
  assert.deepEqual(await memoryTexts(services, story.id, mara.id), []);
  const warning = events.find((event) => event.type === "notes_skipped");
  assert.equal(warning.message, CUT_OFF_NOTES_MESSAGE);
  assert.ok(!eventTypes(events).includes("memory"));
});

test("a reply that finishes normally isn't marked as cut off", async () => {
  const { services, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  const events = await drain(services.chats.send(chat.id, "Hello"));
  const saved = events.at(-1).chat;
  assert.equal(saved.turnLog[0].stop, null);
  assert.ok(!eventTypes(events).includes("notes_skipped"));
});

test("with nobody present there is no one to reply", async () => {
  const { services, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await services.chats.update(chat.id, { presentCharacterIds: [] });
  await assert.rejects(drain(services.chats.send(chat.id, "Hello?")), /No AI character/);
});

test("the story engine plays the scene once for every AI character present", async () => {
  const classifier = classifierScoring({ fear: 0.8, anger: 0.5, neutral: 0.1 });
  let classifiedCount = 0;
  const countingClassifier = {
    async classify(text) {
      classifiedCount += 1;
      return classifier.classify(text);
    },
  };
  const { services, mara, brann, chat } = await setupStory([protocolReply(MARA_REPLY)], {
    storyConfig,
    emotionClassifier: countingClassifier,
  });
  const events = await drain(services.chats.send(chat.id, "*draws a knife*"));

  assert.equal(classifiedCount, 1);
  const engineEvent = events.find((event) => event.type === "engine");
  assert.deepEqual(
    engineEvent.characters.map((played) => played.characterId),
    [mara.id, brann.id],
  );
  const saved = events.at(-1).chat;
  assert.equal(saved.engines[mara.id].scene, 1);
  assert.equal(saved.engines[brann.id].scene, 1);
  assert.equal(saved.engine.scene, 1);
});

test("requests ask for caching; Anthropic and Bedrock mark the prefix and history", async () => {
  const { services, provider, chat } = await setupStory([protocolReply(MARA_REPLY)]);
  await drain(services.chats.send(chat.id, "Hello"));
  assert.equal(provider.calls[0].request.cache, true);

  const request = {
    model: "us.anthropic.claude-sonnet-4-5",
    maxTokens: 100,
    system: "Prefix",
    messages: [
      { role: "user", content: "First" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Newest with note" },
    ],
    cache: true,
  };
  const anthropicBody = anthropicRequestBody(request);
  assert.deepEqual(anthropicBody.system, [
    { type: "text", text: "Prefix", cache_control: { type: "ephemeral" } },
  ]);
  assert.deepEqual(anthropicBody.messages[1].content, [
    { type: "text", text: "Reply", cache_control: { type: "ephemeral" } },
  ]);
  assert.equal(anthropicBody.messages[2].content, "Newest with note");

  const bedrockBody = JSON.parse(bedrockConverseBody(request));
  assert.deepEqual(bedrockBody.system.at(-1), { cachePoint: { type: "default" } });
  assert.deepEqual(bedrockBody.messages[1].content.at(-1), { cachePoint: { type: "default" } });
  const oldModelBody = JSON.parse(
    bedrockConverseBody({ ...request, model: "anthropic.claude-3-haiku-20240307-v1:0" }),
  );
  assert.equal(oldModelBody.system.length, 1, "models without caching get no cache points");
  assert.equal(anthropicRequestBody({ ...request, cache: false }).system, "Prefix");
});
