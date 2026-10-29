// The chat service: sending, streaming, regenerating, shift markers, busy chats and editing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, fakeProvider, drain } from "./helpers.js";

const FULL_REPLY_EVENTS = ["chat", "start", "delta", "delta", "done", "chat"];

function setup(options) {
  const { services, provider } = makeApp(options);
  return { chats: services.chats, personality: services.personality, provider };
}

function hasStatus(status) {
  return (error) => error.status === status;
}

function eventTypes(events) {
  return events.map((event) => event.type);
}

function roles(messages) {
  return messages.map((message) => message.role);
}

// The chat as saved after a reply: the last event is always the final chat state.
async function sendAndGetSavedChat(chats, chatId, content) {
  const events = await drain(chats.send(chatId, content));
  return events.at(-1).chat;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("send stores the user turn, streams the reply and saves it", async () => {
  const { chats, provider } = setup();
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "Hello, who are you?"));

  assert.deepEqual(eventTypes(events), FULL_REPLY_EVENTS);
  assert.equal(events[0].chat.streaming, true);
  assert.match(events[1].request.system, /^Use the following rules/);
  assert.deepEqual(events[1].request.messages, [{ role: "user", content: "Hello, who are you?" }]);

  const saved = events.at(-1).chat;
  assert.equal(saved.title, "Hello, who are you?");
  const rolesAndContents = saved.messages.map((message) => [message.role, message.content]);
  assert.deepEqual(rolesAndContents, [
    ["user", "Hello, who are you?"],
    ["assistant", "Hello there."],
  ]);
  assert.ok(!("profileBefore" in saved.messages[1]));
  assert.equal(provider.calls.length, 1);
});

test("dial changes between replies add one shift marker before the next user turn", async () => {
  const { chats, personality } = setup();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "First"));
  await personality.patch({ values: { communion: 1.5 } });
  assert.match((await chats.get(chat.id)).pendingShift.summary, /more warm/);

  const saved = await sendAndGetSavedChat(chats, chat.id, "Second");
  assert.deepEqual(roles(saved.messages), ["user", "assistant", "shift", "user", "assistant"]);
  assert.match(saved.messages[2].content, /far more warm/);
  assert.equal(saved.pendingShift, null);
});

test("reply regenerates the last assistant message as a new version", async () => {
  const { chats } = setup({ provider: fakeProvider({ chunks: ["Take two."] }) });
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Hi"));

  const saved = (await drain(chats.reply(chat.id))).at(-1).chat;
  const lastMessage = saved.messages.at(-1);
  assert.deepEqual(lastMessage.alts, ["Take two.", "Take two."]);
  assert.equal(lastMessage.alt, 1);

  const switched = await chats.editMessage(chat.id, lastMessage.id, { alt: 0 });
  assert.equal(switched.messages.at(-1).alt, 0);
});

test("reply with nothing to answer is a 400, and an unknown chat is a 404", async () => {
  const { chats } = setup();
  const chat = await chats.create();
  await assert.rejects(drain(chats.reply(chat.id)), hasStatus(400));
  await assert.rejects(drain(chats.send("missing", "hi")), hasStatus(404));
});

test("provider failures are saved on the message and reported as an error event", async () => {
  const failingProvider = fakeProvider({ fail: "Anthropic 401: invalid x-api-key" });
  const { chats } = setup({ provider: failingProvider });
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "Hi"));
  assert.deepEqual(eventTypes(events), ["chat", "start", "error", "chat"]);
  assert.match(events.at(-1).chat.messages.at(-1).error, /401/);
});

test("stopping an empty reply removes it; the chat isn't left busy", async () => {
  const abortController = new AbortController();
  const stopImmediately = () => abortController.abort();
  const { chats } = setup({ provider: fakeProvider({ chunks: [stopImmediately, "never"] }) });
  const chat = await chats.create();
  const events = await drain(chats.send(chat.id, "Hi", { signal: abortController.signal }));

  assert.equal(events.at(-2).type, "done");
  const saved = events.at(-1).chat;
  assert.deepEqual(roles(saved.messages), ["user"]);
  assert.equal(saved.streaming, false);
});

test("a second reply while one is streaming is a 409", async () => {
  let releaseReply;
  const replyGate = new Promise((resolve) => {
    releaseReply = resolve;
  });
  const { chats } = setup({ provider: fakeProvider({ chunks: [() => replyGate, "done"] }) });
  const chat = await chats.create();

  const firstReply = drain(chats.send(chat.id, "Hi"));
  await wait(10);
  await assert.rejects(drain(chats.send(chat.id, "Again")), hasStatus(409));
  await assert.rejects(chats.remove(chat.id), hasStatus(409));

  releaseReply();
  await firstReply;
});

test("context shows exactly what would be sent, including the draft", async () => {
  const { chats } = setup();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Hi"));

  const context = await chats.context(chat.id, "Next line");
  const contents = context.messages.map((message) => message.content);
  assert.deepEqual(contents, ["Hi", "Hello there.", "Next line"]);
  assert.equal(context.estimate.total, context.estimate.system + context.estimate.messages);
});

test("undoShift puts the dials back to the last reply", async () => {
  const { chats, personality } = setup();
  const chat = await chats.create();
  await drain(chats.send(chat.id, "Hi"));
  await personality.patch({ values: { valence: -2 } });

  const restored = await chats.undoShift(chat.id);
  assert.equal(restored.personality.values.valence, 0);
  assert.equal((await chats.get(chat.id)).pendingShift, null);
});

test("list, rename, edit, delete message and delete chat", async () => {
  const { chats } = setup();
  const firstChat = await chats.create({ title: "A" });
  await chats.create({ title: "B" });
  await drain(chats.send(firstChat.id, "Hi"));

  const titles = async () => (await chats.list()).map((chat) => chat.title);
  assert.deepEqual(await titles(), ["A", "B"]);
  assert.equal((await chats.rename(firstChat.id, "  Renamed ")).title, "Renamed");

  const messages = (await chats.get(firstChat.id)).messages;
  const edited = await chats.editMessage(firstChat.id, messages[1].id, { content: "Edited." });
  assert.equal(edited.messages[1].content, "Edited.");
  const afterDelete = await chats.deleteMessage(firstChat.id, messages[0].id);
  assert.equal(afterDelete.messages.length, 1);
  await assert.rejects(chats.deleteMessage(firstChat.id, "nope"), hasStatus(404));

  await chats.remove(firstChat.id);
  assert.deepEqual(await titles(), ["B"]);
});
