// Stories over real HTTP: stories, the cast and each character's personality, memory editing and
// search, world notes, world state, and story-aware chats.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeApp, listen } from "./helpers.js";
import { fakeEmbedder } from "./storyHelpers.js";

let server;
let base;

before(async () => {
  server = await listen(makeApp({ embedder: fakeEmbedder() }).app);
  base = server.base;
});

after(() => server.close());

async function call(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers = { "content-type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + path, options);
  let json = null;
  if (response.status !== 204) {
    json = await response.json();
  }
  return { status: response.status, json };
}

async function createStory(title = "The Flood") {
  return (await call("POST", "/stories", { title, theme: "Loss" })).json;
}

async function createCharacter(storyId, fields) {
  return (await call("POST", `/stories/${storyId}/characters`, fields)).json;
}

test("My story exists from the start and can't be deleted", async () => {
  const { json } = await call("GET", "/stories");
  const defaultStory = json.stories.find((story) => story.id === "my-story");
  assert.equal(defaultStory.title, "My story");
  assert.equal(defaultStory.characterCount, 1);
  assert.equal((await call("DELETE", "/stories/my-story")).status, 409);
});

test("stories are created, read, changed and deleted", async () => {
  const created = await call("POST", "/stories", { title: "  The Flood ", plot: "Rain." });
  assert.equal(created.status, 201);
  assert.equal(created.json.title, "The Flood");
  assert.equal(created.json.plot, "Rain.");
  assert.deepEqual(created.json.characters, []);

  const storyId = created.json.id;
  const changed = await call("PATCH", `/stories/${storyId}`, { conflict: "The dam" });
  assert.equal(changed.json.conflict, "The dam");
  assert.equal(changed.json.plot, "Rain.");

  assert.equal((await call("DELETE", `/stories/${storyId}`)).status, 204);
  assert.equal((await call("GET", `/stories/${storyId}`)).status, 404);
});

test("story input is checked at the edge", async () => {
  assert.equal((await call("POST", "/stories", {})).status, 400);
  assert.equal((await call("POST", "/stories", { title: " " })).status, 400);
  assert.equal((await call("POST", "/stories", { title: "A", colour: "red" })).status, 400);
  const story = await createStory();
  assert.equal((await call("PATCH", `/stories/${story.id}`, {})).status, 400);
});

test("characters have abilities, skills and their own personality", async () => {
  const story = await createStory();
  const created = await call("POST", `/stories/${story.id}/characters`, {
    name: "Mara",
    summary: "A ferrywoman.",
    abilities: { dexterity: 15 },
    skills: [{ name: "Lockpicking", level: 3 }],
  });
  assert.equal(created.status, 201);
  const mara = created.json;
  assert.equal(mara.role, "ai");
  assert.equal(mara.abilities.dexterity, 15);
  assert.equal(mara.abilities.strength, 10);
  assert.equal(mara.skills[0].name, "Lockpicking");
  assert.ok(mara.skills[0].id);
  assert.equal(mara.memoryCount, 0);

  const characterPath = `/stories/${story.id}/characters/${mara.id}`;
  const personality = await call("PATCH", `${characterPath}/personality`, {
    values: { communion: 1.5 },
  });
  assert.equal(personality.json.personality.name, "Mara");
  assert.equal(personality.json.personality.values.communion, 1.5);
  assert.match(personality.json.derived.prompt, /warm/);

  const renamed = await call("PATCH", characterPath, { name: "Mara Vell", backstory: "Born." });
  assert.equal(renamed.json.name, "Mara Vell");
  const reread = await call("GET", `${characterPath}/personality`);
  assert.equal(reread.json.personality.name, "Mara Vell");
  assert.equal(reread.json.personality.values.communion, 1.5);
});

test("character input is checked", async () => {
  const story = await createStory();
  const charactersPath = `/stories/${story.id}/characters`;
  const badAbility = await call("POST", charactersPath, { name: "X", abilities: { luck: 3 } });
  assert.equal(badAbility.status, 400);
  const outOfRange = await call("POST", charactersPath, { name: "X", abilities: { wisdom: 21 } });
  assert.equal(outOfRange.status, 400);
  const badSkill = await call("POST", charactersPath, { name: "X", skills: [{ level: 11 }] });
  assert.equal(badSkill.status, 400);
  assert.equal((await call("POST", charactersPath, { role: "ai" })).status, 400);
});

test("a story has at most one player, and My story keeps an AI character", async () => {
  const story = await createStory();
  await createCharacter(story.id, { name: "Kit", role: "player" });
  const secondPlayer = await call("POST", `/stories/${story.id}/characters`, {
    name: "Ash",
    role: "player",
  });
  assert.equal(secondPlayer.status, 409);

  const defaultStory = (await call("GET", "/stories/my-story")).json;
  const onlyAi = defaultStory.characters[0];
  const removal = await call("DELETE", `/stories/my-story/characters/${onlyAi.id}`);
  assert.equal(removal.status, 409);
  const demotion = await call("PATCH", `/stories/my-story/characters/${onlyAi.id}`, {
    role: "player",
  });
  assert.equal(demotion.status, 409);
});

test("memory entries are written, edited, deleted and searched", async () => {
  const story = await createStory();
  const mara = await createCharacter(story.id, { name: "Mara" });
  const memoryPath = `/stories/${story.id}/characters/${mara.id}/memory`;

  const fire = await call("POST", memoryPath, {
    kind: "event",
    text: "The barn burned down in the fire.",
    about: ["barn", "barn", " "],
    importance: 5,
  });
  assert.equal(fire.status, 201);
  assert.deepEqual(fire.json.about, ["barn"]);
  assert.equal(fire.json.source, "user");
  await call("POST", memoryPath, { kind: "person", text: "Jenny calls me Opy." });

  const search = await call("GET", `${memoryPath}/search?query=the%20night%20of%20the%20fire`);
  assert.equal(search.status, 200);
  assert.equal(search.json.results[0].entry.id, fire.json.id);

  const edited = await call("PATCH", `${memoryPath}/${fire.json.id}`, { text: "It was arson." });
  assert.equal(edited.json.text, "It was arson.");
  assert.equal(edited.json.importance, 5);

  assert.equal((await call("DELETE", `${memoryPath}/${fire.json.id}`)).status, 204);
  const remaining = await call("GET", memoryPath);
  assert.equal(remaining.json.memory.length, 1);
  assert.equal((await call("PATCH", `${memoryPath}/${fire.json.id}`, { text: "x" })).status, 404);
});

test("identity and thread entries are one per character, rewritten in place", async () => {
  const story = await createStory();
  const mara = await createCharacter(story.id, { name: "Mara" });
  const memoryPath = `/stories/${story.id}/characters/${mara.id}/memory`;

  const first = await call("POST", memoryPath, { kind: "thread", text: "Waiting for Brann." });
  assert.equal(first.status, 201);
  const second = await call("POST", memoryPath, { kind: "thread", text: "Reaching for the door." });
  assert.equal(second.status, 200);
  assert.equal(second.json.id, first.json.id);
  assert.equal(second.json.text, "Reaching for the door.");

  await call("POST", memoryPath, { kind: "identity", text: "I am the ferrywoman." });
  const memory = (await call("GET", memoryPath)).json.memory;
  assert.equal(memory.length, 2);
});

test("memory input is checked", async () => {
  const story = await createStory();
  const mara = await createCharacter(story.id, { name: "Mara" });
  const memoryPath = `/stories/${story.id}/characters/${mara.id}/memory`;
  assert.equal((await call("POST", memoryPath, { kind: "dream", text: "x" })).status, 400);
  assert.equal((await call("POST", memoryPath, { kind: "event" })).status, 400);
  const tooImportant = await call("POST", memoryPath, { kind: "event", text: "x", importance: 9 });
  assert.equal(tooImportant.status, 400);
  assert.equal((await call("GET", `${memoryPath}/search`)).status, 400);
});

test("world notes are written, edited and deleted", async () => {
  const story = await createStory();
  const notesPath = `/stories/${story.id}/world-notes`;
  const created = await call("POST", notesPath, {
    category: "setting",
    title: "The valley",
    text: "Flooded every spring.",
    keywords: ["valley", "river"],
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.pinned, false);

  const pinned = await call("PATCH", `${notesPath}/${created.json.id}`, { pinned: true });
  assert.equal(pinned.json.pinned, true);
  assert.equal(pinned.json.title, "The valley");

  assert.equal((await call("POST", notesPath, { title: "x", category: "weather" })).status, 400);
  assert.equal((await call("DELETE", `${notesPath}/${created.json.id}`)).status, 204);
  assert.deepEqual((await call("GET", notesPath)).json.worldNotes, []);
});

test("world state keeps one fact per subject", async () => {
  const story = await createStory();
  const statePath = `/stories/${story.id}/world-state`;
  const broken = await call("POST", statePath, {
    subject: "Kitchen window",
    fact: "Broken, glass on the floor.",
    keywords: ["window"],
  });
  assert.equal(broken.status, 201);

  const boarded = await call("POST", statePath, { subject: "kitchen window", fact: "Boarded up." });
  assert.equal(boarded.status, 200);
  assert.equal(boarded.json.id, broken.json.id);
  assert.equal(boarded.json.fact, "Boarded up.");

  const letter = await call("POST", statePath, { subject: "The letter", fact: "On the table." });
  const clash = await call("PATCH", `${statePath}/${letter.json.id}`, {
    subject: "Kitchen window",
  });
  assert.equal(clash.status, 409);

  const facts = (await call("GET", statePath)).json.worldState;
  assert.equal(facts.length, 2);
  assert.equal((await call("POST", statePath, { subject: "x" })).status, 400);
});

test("chats belong to stories, with a present cast and a scene", async () => {
  const story = await createStory();
  const mara = await createCharacter(story.id, { name: "Mara" });
  const brann = await createCharacter(story.id, { name: "Brann" });
  const kit = await createCharacter(story.id, { name: "Kit", role: "player" });

  const created = await call("POST", `/stories/${story.id}/chats`, { title: "Night one" });
  assert.equal(created.status, 201);
  const chat = created.json;
  assert.equal(chat.storyId, story.id);
  assert.deepEqual(chat.presentCharacterIds, [mara.id, brann.id]);
  assert.equal(chat.scene.location, "");

  const listed = await call("GET", `/stories/${story.id}/chats`);
  assert.deepEqual(
    listed.json.chats.map((summary) => summary.id),
    [chat.id],
  );

  const changed = await call("PATCH", `/chats/${chat.id}`, {
    presentCharacterIds: [brann.id],
    scene: { location: "The farmhouse kitchen", withinReach: ["the lantern"] },
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.json.presentCharacterIds, [brann.id]);
  assert.equal(changed.json.scene.location, "The farmhouse kitchen");
  assert.deepEqual(changed.json.scene.withinReach, ["the lantern"]);
  assert.equal(changed.json.scene.inMotion, "");
  assert.equal(changed.json.title, "Night one");

  const withPlayer = await call("PATCH", `/chats/${chat.id}`, { presentCharacterIds: [kit.id] });
  assert.equal(withPlayer.status, 400);
  const badScene = await call("PATCH", `/chats/${chat.id}`, { scene: { weather: "rain" } });
  assert.equal(badScene.status, 400);
  assert.equal((await call("PATCH", `/chats/${chat.id}`, {})).status, 400);
});

test("removing a character takes it out of its story's chats", async () => {
  const story = await createStory();
  const mara = await createCharacter(story.id, { name: "Mara" });
  const brann = await createCharacter(story.id, { name: "Brann" });
  const chat = (await call("POST", `/stories/${story.id}/chats`, {})).json;

  await call("DELETE", `/stories/${story.id}/characters/${mara.id}`);
  const reread = await call("GET", `/chats/${chat.id}`);
  assert.deepEqual(reread.json.presentCharacterIds, [brann.id]);
});

test("deleting a story deletes its chats", async () => {
  const story = await createStory();
  await createCharacter(story.id, { name: "Mara" });
  const chat = (await call("POST", `/stories/${story.id}/chats`, {})).json;
  await call("DELETE", `/stories/${story.id}`);
  assert.equal((await call("GET", `/chats/${chat.id}`)).status, 404);
});

test("old-style chats still join My story", async () => {
  const created = await call("POST", "/chats", { title: "Plain" });
  assert.equal(created.json.storyId, "my-story");
  assert.equal(created.json.presentCharacterIds.length, 1);
  const renamed = await call("PATCH", `/chats/${created.json.id}`, { title: "Renamed" });
  assert.equal(renamed.json.title, "Renamed");
});

test("export includes stories, and imported chats without a story join My story", async () => {
  const story = await createStory("Exported");
  const exported = (await call("GET", "/export")).json;
  assert.equal(exported.version, 4);
  assert.ok(exported.stories.some((candidate) => candidate.id === story.id));

  const imported = await call("POST", "/import", {
    app: "oread",
    chats: [{ id: "imported-chat", title: "Old", messages: [], created: 1, updated: 1 }],
  });
  assert.equal(imported.status, 200);
  const chat = await call("GET", "/chats/imported-chat");
  assert.equal(chat.json.storyId, "my-story");
  const badStories = await call("POST", "/import", { app: "oread", stories: [{ id: "x" }] });
  assert.equal(badStories.status, 400);
});

test("memory search is a 503 when the local model isn't there", async () => {
  const { services } = makeApp();
  const story = await services.stories.create({ title: "No model" });
  const mara = await services.cast.create(story.id, { name: "Mara", role: "ai" });
  await assert.rejects(
    services.memory.search(story.id, mara.id, { query: "fire", limit: 3 }),
    (error) => error.status === 503,
  );
});

test("clearing a chat empties its scene and keeps the characters' memories", async () => {
  const { services } = makeApp();
  const story = await services.stories.create({ title: "Clearing" });
  const mara = await services.cast.create(story.id, { name: "Mara", role: "ai" });
  await services.memory.create(story.id, mara.id, { kind: "event", text: "The flood came." });
  const chat = await services.chats.create({ storyId: story.id });
  await services.chats.update(chat.id, { scene: { ...chat.scene, location: "The mill" } });

  const cleared = await services.chats.clear(chat.id);
  assert.equal(cleared.scene.location, "");
  assert.equal(cleared.lastSpeakerId, mara.id);
  assert.equal((await services.memory.list(story.id, mara.id)).length, 1);
});
