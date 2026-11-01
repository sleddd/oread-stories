// Featherless chats remember first: a memory model writes the turn's notes before the reply, the
// roleplay model is asked only for the reply, and the reply reads what was just remembered.
// Scripted providers stand in for both models, so nothing here calls Featherless.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, drain } from "./helpers.js";
import { fakeEmbedder, scriptedProvider, protocolReply } from "./storyHelpers.js";
import { MEMORY_MODEL_CANDIDATES } from "../src/services/memoryModelChoice.js";

const MARA_MEMORY = {
  Mara: [{ op: "add", kind: "person", about: ["Jenny"], text: "Jenny can't eat eggs." }],
};

function notesOnly(memory = MARA_MEMORY) {
  const reply = protocolReply({ speaker: "Mara", text: "", memory, world: {} }).join("");
  return "<<updates>>" + reply.split("<<updates>>")[1];
}

const MARA_REPLY = ["[[speaker: Mara]]\n", "*sets the kettle on* No eggs, then."];

// Calls alternate: the memory pass, then the reply.
async function setupFeatherlessStory(replies) {
  const provider = scriptedProvider(replies);
  const built = makeApp({
    provider,
    embedder: fakeEmbedder(),
    providers: { featherless: provider, anthropic: provider },
  });
  const { services } = built;
  await services.settings.patch({
    provider: "featherless",
    featherless: { model: "Omega/Directive-24B" },
    engine: { enabled: false },
  });
  const story = await services.stories.create({ title: "The Kitchen" });
  const mara = await services.cast.create(story.id, { name: "Mara", role: "ai" });
  await services.cast.create(story.id, { name: "Jenny", role: "player" });
  const chat = await services.chats.create({ storyId: story.id });
  return { services, provider, story, mara, chat };
}

function eventTypes(events) {
  return events.map((event) => event.type).filter((type) => type !== "delta");
}

test("the memory model writes the notes first, and the reply reads them", async () => {
  const { services, provider, story, mara, chat } = await setupFeatherlessStory([
    [notesOnly()],
    MARA_REPLY,
  ]);
  const events = await drain(services.chats.send(chat.id, "I can't eat eggs any more."));

  const types = eventTypes(events);
  assert.ok(types.indexOf("remembering") < types.indexOf("start"), "remembering comes first");
  assert.ok(types.indexOf("memory") < types.indexOf("start"), "and its notes apply before");

  const memoryCall = provider.calls[0].request;
  assert.equal(memoryCall.model, MEMORY_MODEL_CANDIDATES[0]);
  assert.deepEqual(memoryCall.chatTemplateOptions, { enable_thinking: false });
  assert.match(memoryCall.system, /^You keep the records of an ongoing roleplay/);
  const memoryMessage = memoryCall.messages.at(-1).content;
  assert.match(memoryMessage, /The newest message:\nI can't eat eggs any more\./);
  assert.doesNotMatch(memoryMessage, /Write this reply as/);

  const replyCall = provider.calls[1].request;
  assert.equal(replyCall.model, "Omega/Directive-24B");
  assert.equal(replyCall.chatTemplateOptions, undefined, "thinking is only switched off for notes");
  assert.match(replyCall.system, /Write nothing after the reply\./);
  assert.doesNotMatch(replyCall.system, /three hidden notes/);
  assert.match(replyCall.messages.at(-1).content, /Jenny can't eat eggs\./, "fresh memory");

  const memories = await services.memory.list(story.id, mara.id);
  assert.deepEqual(
    memories.map((entry) => entry.text),
    ["Jenny can't eat eggs."],
  );
  assert.equal(events.at(-1).chat.messages.at(-1).content, "*sets the kettle on* No eggs, then.");
});

test("the next turn's memory pass records the character's previous reply too", async () => {
  const { services, provider, chat } = await setupFeatherlessStory([
    [notesOnly()],
    MARA_REPLY,
    [notesOnly({})],
    MARA_REPLY,
  ]);
  await drain(services.chats.send(chat.id, "I can't eat eggs any more."));
  await drain(services.chats.send(chat.id, "Toast is fine."));
  const secondMemoryMessage = provider.calls[2].request.messages.at(-1).content;
  assert.match(secondMemoryMessage, /Mara's last reply:\n\*sets the kettle on\* No eggs, then\./);
  assert.match(secondMemoryMessage, /The newest message:\nToast is fine\./);
});

test("notes the roleplay model writes anyway are ignored, so none are kept twice", async () => {
  const replyWithNotes = protocolReply({
    speaker: "Mara",
    text: "No eggs, then.",
    memory: { Mara: [{ op: "add", kind: "event", text: "Written by the story model." }] },
  });
  const { services, story, mara, chat } = await setupFeatherlessStory([
    [notesOnly()],
    replyWithNotes,
  ]);
  await drain(services.chats.send(chat.id, "I can't eat eggs any more."));
  const memories = await services.memory.list(story.id, mara.id);
  assert.deepEqual(
    memories.map((entry) => entry.text),
    ["Jenny can't eat eggs."],
  );
});

test("a memory model that keeps failing is passed over for the next candidate", async () => {
  const { services, provider, chat } = await setupFeatherlessStory([
    ["The memory model tells a story instead."],
    MARA_REPLY,
  ]);
  for (const message of ["One", "Two", "Three"]) {
    const events = await drain(services.chats.send(chat.id, message));
    assert.match(events.at(-1).chat.messages.at(-1).content, /No eggs, then\./);
    const failure = events.find((event) => /nothing was remembered/.test(event.message ?? ""));
    assert.match(failure.message, /^The memory model \(Qwen\/Qwen3.8-27B\) brought back no notes/);
  }
  await drain(services.chats.send(chat.id, "Four"));
  const fourthMemoryCall = provider.calls[6].request;
  assert.equal(fourthMemoryCall.model, MEMORY_MODEL_CANDIDATES[1]);
});

test("regenerating a reply redoes the memory pass without keeping the old notes", async () => {
  const { services, story, mara, chat } = await setupFeatherlessStory([
    [notesOnly()],
    MARA_REPLY,
    [notesOnly({ Mara: [{ op: "add", kind: "person", text: "Jenny eats toast." }] })],
    MARA_REPLY,
  ]);
  await drain(services.chats.send(chat.id, "I can't eat eggs any more."));
  await drain(services.chats.reply(chat.id));
  const memories = await services.memory.list(story.id, mara.id);
  assert.deepEqual(
    memories.map((entry) => entry.text),
    ["Jenny eats toast."],
  );
});
