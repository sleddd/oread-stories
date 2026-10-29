// The pieces of a story turn on their own: prompt building, the stream filters, the hidden-note
// parsers and the code that applies them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lore } from "./helpers.js";
import { normalizePersonality } from "../src/lore/personality.js";
import { withoutName } from "../src/stories/characterPersonality.js";
import { newStory, newCharacter, newMemoryEntry, emptyScene } from "../src/stories/factories.js";
import { buildSystemPrefix } from "../src/prompt/systemPrefix.js";
import { selectWorldNotes } from "../src/prompt/worldNotes.js";
import { selectWorldState } from "../src/prompt/worldState.js";
import { selectMemories, recentMemories } from "../src/prompt/selectMemories.js";
import { triggeredMemories } from "../src/memory/triggeredMemories.js";
import { predictSpeaker } from "../src/stories/predictSpeaker.js";
import { createHeaderFilter } from "../src/stream/headerFilter.js";
import { createHiddenNotesFilter } from "../src/stream/hiddenNotesFilter.js";
import { readHiddenNotes } from "../src/stream/hiddenNotes.js";
import { isLengthLimitStop } from "../src/stream/stopReasons.js";
import { outputProtocol } from "../src/prompt/outputProtocol.js";
import { parseMemoryNote } from "../src/memory/memoryNoteParser.js";
import { applyMemoryOperations, revertMemoryChanges } from "../src/memory/applyMemoryOperations.js";
import { parseUpdatesNote } from "../src/story/updatesNoteParser.js";
import { applyStoryUpdates, revertStoryUpdates } from "../src/story/applyStoryUpdates.js";
import { parseWorldNote } from "../src/world/worldNoteParser.js";
import { applySceneSnapshot } from "../src/world/applySceneSnapshot.js";
import { applyWorldStateOperations } from "../src/world/applyWorldStateOperations.js";
import { mentionsTerm } from "../src/stories/termMatching.js";
import { MAX_WORLD_STATE_FACTS } from "../src/stories/limits.js";
import { sequence } from "./helpers.js";

const TIMESTAMP = 5_000;

function character(id, name, role = "ai") {
  const personality = withoutName(normalizePersonality(lore, {}));
  return newCharacter({ id, name, role, personality });
}

function memory(id, kind, text, { about = [], importance = 3, updated = TIMESTAMP } = {}) {
  const entry = newMemoryEntry({
    id,
    input: { kind, text, about, importance },
    source: "user",
    timestamp: updated,
  });
  return entry;
}

// A story with Mara and Brann (AI) and Jenny (the player).
function sampleStory() {
  const story = newStory({ id: "story-1", title: "The Flood", timestamp: TIMESTAMP });
  story.theme = "What we keep";
  story.characters.push(character("mara", "Mara"), character("brann", "Brann"));
  story.characters.push(character("jenny", "Jenny", "player"));
  return story;
}

function sampleChat(overrides = {}) {
  return {
    id: "chat-1",
    storyId: "story-1",
    presentCharacterIds: ["mara", "brann"],
    lastSpeakerId: "mara",
    scene: emptyScene(),
    messages: [],
    ...overrides,
  };
}

// Splits `text` into pieces of `size` characters, the way a stream might deliver it.
function piecesOf(text, size) {
  const pieces = [];
  for (let start = 0; start < text.length; start += size) {
    pieces.push(text.slice(start, start + size));
  }
  return pieces;
}

// ── prompt ──────────────────────────────────────────────────────────────────────────────

test("the system prefix holds the story, the roster and the protocol, never the speaker", () => {
  const story = sampleStory();
  story.characters[0].memory.push(memory("identity-1", "identity", "I keep the farm.\nI hide."));
  story.worldNotes.push({
    id: "note-1",
    category: "setting",
    title: "The valley",
    text: "It floods each spring.",
    keywords: ["valley"],
    pinned: true,
  });
  const prefix = buildSystemPrefix(story);

  assert.match(prefix, /^You are the voice of the characters/);
  assert.match(prefix, /every character in the cast except Jenny/);
  assert.match(prefix, /Never use emojis or emoticons/);
  assert.match(prefix, /Theme: What we keep/);
  assert.match(prefix, /- Mara \(played by you\) In their own words: "I keep the farm\."/);
  assert.match(prefix, /- Jenny \(played by the person you're writing with\)/);
  assert.match(prefix, /- The valley: It floods each spring\./);
  assert.match(prefix, /\[\[speaker: Name\]\]/);
  assert.match(prefix, /<<updates>>/);
  assert.ok(!prefix.includes("I hide."), "only the identity's first line is in the roster");
});

test("world notes and world state come in only when their keywords come up", () => {
  const story = sampleStory();
  story.worldNotes.push(
    {
      id: "a",
      category: "history",
      title: "The mill",
      text: "Burned.",
      keywords: ["mill"],
      pinned: false,
    },
    {
      id: "b",
      category: "setting",
      title: "The coast",
      text: "Far.",
      keywords: ["coast"],
      pinned: false,
    },
  );
  story.worldState.push({
    id: "fact-1",
    subject: "kitchen window",
    fact: "broken",
    keywords: ["glass"],
    updated: TIMESTAMP,
  });

  const notes = selectWorldNotes(story, "We met by the old Mill last night.");
  assert.deepEqual(
    notes.map((note) => note.id),
    ["a"],
  );
  assert.equal(selectWorldState(story, "Mind the glass.").length, 1);
  assert.equal(selectWorldState(story, "Nothing here.").length, 0);
  assert.equal(selectWorldNotes(story, "The mill", 3).length, 0, "the budget is respected");
});

test("trigger recall brings back memories about the place the scene moves to", () => {
  const memories = [
    memory("house", "event", "We buried the dog by the old house.", { about: ["the old house"] }),
    memory("road", "event", "The road was flooded.", { about: ["the road"] }),
    memory("thread-1", "thread", "Waiting.", { about: ["the old house"] }),
  ];
  const atTheHouse = triggeredMemories(memories, { terms: ["old house"], text: "" });
  assert.deepEqual(
    atTheHouse.map((entry) => entry.id),
    ["house"],
  );
  const mentioned = triggeredMemories(memories, { terms: [], text: "Is the road still out?" });
  assert.deepEqual(
    mentioned.map((entry) => entry.id),
    ["road"],
  );
});

test("memory selection keeps the budget, skips identity and thread, and drops duplicates", () => {
  const first = memory("first", "event", "a".repeat(50), { updated: 1 });
  const second = memory("second", "event", "b".repeat(50), { updated: 3 });
  const third = memory("third", "event", "c".repeat(50), { updated: 2 });
  const identity = memory("identity", "identity", "Me.");
  const selected = selectMemories({
    triggered: [first, identity],
    searched: [first, second],
    recent: recentMemories([first, second, third, identity], 2),
    budget: 120,
  });
  assert.deepEqual(
    selected.map((entry) => entry.id),
    ["first", "second"],
  );
});

test("the speaker is the one named, else whoever spoke last, else the first present", () => {
  const story = sampleStory();
  assert.equal(predictSpeaker({ story, chat: sampleChat(), newestMessage: "Hi" }).id, "mara");
  const naming = predictSpeaker({ story, chat: sampleChat(), newestMessage: "Brann, wait!" });
  assert.equal(naming.id, "brann");
  const both = predictSpeaker({ story, chat: sampleChat(), newestMessage: "Mara and Brann?" });
  assert.equal(both.id, "mara");
  const noLast = sampleChat({ lastSpeakerId: "jenny" });
  assert.equal(predictSpeaker({ story, chat: noLast, newestMessage: "Jenny here" }).id, "mara");
  assert.equal(predictSpeaker({ story, chat: sampleChat({ presentCharacterIds: [] }) }), null);
});

test("terms match whole words, ignoring case and a leading article", () => {
  assert.ok(mentionsTerm("Back at THE old  house now", "the old house"));
  assert.ok(!mentionsTerm("millstone", "mill"));
  assert.ok(!mentionsTerm("anything", ""));
});

// ── stream filters ─────────────────────────────────────────────────────────────────────

const FULL_REPLY =
  "[[speaker: Brann]]\n[[recall: the night of the fire]]\n*sighs* Not tonight." +
  '\n<<updates>>{"skills":[]}<</updates>>\n<<world>>{"scene":{"location":"the mill"}}<</world>>' +
  '\n<<memory>>{"Brann":[]}<</memory>>';

function runFilters(pieces) {
  const header = createHeaderFilter();
  const notes = createHiddenNotesFilter();
  const markers = [];
  let shown = "";
  for (const piece of pieces) {
    const result = header.push(piece);
    markers.push(...result.markers);
    shown += notes.push(result.text);
  }
  shown += notes.push(header.finish());
  const tail = notes.finish();
  return { shown: shown + tail.text, hiddenText: tail.hiddenText, markers };
}

test("the header and hidden notes are filtered out however the stream is split", () => {
  for (const size of [1, 2, 3, 5, 7, 11, 64, 1000]) {
    const { shown, hiddenText, markers } = runFilters(piecesOf(FULL_REPLY, size));
    assert.equal(shown.trim(), "*sighs* Not tonight.", `chunk size ${size}`);
    assert.ok(hiddenText.startsWith("<<updates>>"), `chunk size ${size}`);
    assert.deepEqual(
      readHiddenNotes(hiddenText),
      {
        updates: { skills: [] },
        world: { scene: { location: "the mill" } },
        memory: { Brann: [] },
      },
      `chunk size ${size}`,
    );
    assert.deepEqual(markers, [
      { kind: "speaker", value: "Brann" },
      { kind: "recall", value: "the night of the fire" },
    ]);
  }
});

test("a reply without a header or notes passes through untouched", () => {
  const text = "[Out of breath] She runs. <3 and << are fine.";
  for (const size of [1, 4, 100]) {
    assert.equal(runFilters(piecesOf(text, size)).shown, text);
  }
});

test("the header is settled before any text is shown", () => {
  const header = createHeaderFilter();
  assert.deepEqual(header.push("[[spea"), { text: "", markers: [], isSettled: false });
  const named = header.push("ker: Mara]]\n");
  assert.deepEqual(named.markers, [{ kind: "speaker", value: "Mara" }]);
  assert.equal(named.isSettled, false, "a recall line may still follow");
  assert.deepEqual(header.push("Hello"), { text: "Hello", markers: [], isSettled: true });
});

test("hidden notes are read in the protocol's order, and bad JSON is ignored", () => {
  const notes = readHiddenNotes(
    "<<updates>>not json<</updates>>" +
      '<<world>>```json\n{"scene":{}}\n```<</world>>' +
      '<<memory>>{"Mara":[]}<</memory>>',
  );
  assert.equal(notes.updates, null);
  assert.deepEqual(notes.world, { scene: {} });
  assert.deepEqual(notes.memory, { Mara: [] });
  assert.deepEqual(readHiddenNotes(""), { updates: null, world: null, memory: null });
});

test("a cut-off last note is ignored, even when what arrived happens to be valid JSON", () => {
  const notes = readHiddenNotes('<<world>>{"scene":{}}<</world>><<memory>>{"Mara":[]}');
  assert.deepEqual(notes.world, { scene: {} });
  assert.equal(notes.memory, null);
});

test("a note missing only its closing tag is read up to the next note", () => {
  const notes = readHiddenNotes('<<world>>{"scene":{}}\n<<memory>>{}<</memory>>');
  assert.deepEqual(notes.world, { scene: {} });
  assert.deepEqual(notes.memory, {});
});

test("the protocol asks for the world note before the memory note", () => {
  const protocol = outputProtocol("Jenny");
  assert.ok(protocol.indexOf("<<updates>> holds") < protocol.indexOf("<<world>> holds"));
  assert.ok(protocol.indexOf("<<world>> holds") < protocol.indexOf("<<memory>> holds"));
  assert.ok(protocol.indexOf("<<world>>{") < protocol.indexOf("<<memory>>{"));
});

test("only a length-limit stop counts as cut off, whatever the provider calls it", () => {
  for (const stopReason of ["max_tokens", "length", "MAX_TOKENS"]) {
    assert.equal(isLengthLimitStop(stopReason), true, stopReason);
  }
  for (const stopReason of ["end_turn", "stop", "STOP", "tool_use", undefined]) {
    assert.equal(isLengthLimitStop(stopReason), false, String(stopReason));
  }
});

// ── memory note ────────────────────────────────────────────────────────────────────────

test("memory operations are cleaned: unknown ones dropped, text cut, importance clamped", () => {
  const parsed = parseMemoryNote({
    Mara: [
      {
        op: "add",
        kind: "person",
        about: ["Jenny", 4, ""],
        text: "Jenny calls me Opy.",
        importance: 9,
      },
      { op: "add", kind: "dream", text: "Unknown kind." },
      { op: "fly", text: "Unknown op." },
      { op: "add", kind: "thread", text: "Waiting for Brann." },
      { op: "update", id: "m1" },
      { op: "remove", id: "m2" },
      { op: "add", kind: "event", text: "x".repeat(5_000) },
    ],
    Brann: "not a list",
  });
  assert.equal(parsed.length, 1);
  const operations = parsed[0].operations;
  assert.deepEqual(operations[0].about, ["Jenny"]);
  assert.equal(operations[0].importance, 5);
  assert.deepEqual(operations[1], { op: "thread", text: "Waiting for Brann." });
  assert.deepEqual(operations[2], { op: "remove", id: "m2" });
  assert.equal(operations[3].text.length, 1_000);
});

function applyMemory(story, note, extra = {}) {
  return applyMemoryOperations({
    story,
    presentCharacterIds: ["mara", "brann"],
    characterNotes: parseMemoryNote(note),
    shortIds: {},
    turnSource: { chatId: "chat-1", turn: 2 },
    timestamp: TIMESTAMP,
    newId: sequence("entry"),
    ...extra,
  });
}

test("memory is written per character; the player and absent characters are refused", () => {
  const story = sampleStory();
  story.characters.push(character("ollie", "Ollie"));
  const { changes, rejected } = applyMemory(story, {
    mara: [{ op: "add", kind: "person", about: ["Jenny"], text: "Jenny calls me Opy." }],
    Brann: [{ op: "add", kind: "event", text: "Mara shut me out.", toldBy: "Mara" }],
    Jenny: [{ op: "add", kind: "self", text: "I'm the player." }],
    Ollie: [{ op: "add", kind: "self", text: "I'm not here." }],
  });
  assert.equal(changes.length, 2);
  assert.deepEqual(
    rejected.map((entry) => entry.characterName),
    ["Jenny", "Ollie"],
  );
  const [mara, brann, jenny] = story.characters;
  assert.equal(mara.memory[0].text, "Jenny calls me Opy.");
  assert.deepEqual(mara.memory[0].source, { chatId: "chat-1", turn: 2 });
  assert.deepEqual(brann.memory[0].source, { chatId: "chat-1", turn: 2, toldBy: "mara" });
  assert.equal(jenny.memory.length, 0);
});

test("identity and thread are rewritten in place, one per character", () => {
  const story = sampleStory();
  applyMemory(story, {
    Mara: [
      { op: "thread", text: "Waiting." },
      { op: "identity", text: "Me." },
    ],
  });
  applyMemory(story, { Mara: [{ op: "thread", text: "Reaching for the door." }] });
  const threads = story.characters[0].memory.filter((entry) => entry.kind === "thread");
  assert.equal(threads.length, 1);
  assert.equal(threads[0].text, "Reaching for the door.");
});

test("update and remove use the scene note's short ids, and changes can be undone", () => {
  const story = sampleStory();
  story.characters[0].memory.push(memory("real-1", "event", "The barn burned."));
  story.characters[0].memory.push(memory("real-2", "event", "Brann lied."));
  const { changes } = applyMemory(
    story,
    {
      Mara: [
        { op: "update", id: "m1", text: "The barn burned, and I let it." },
        { op: "remove", id: "m2" },
        { op: "add", kind: "goal", text: "Leave the valley." },
      ],
    },
    { shortIds: { m1: "real-1", m2: "real-2" }, timestamp: TIMESTAMP + 1 },
  );
  const mara = story.characters[0];
  assert.deepEqual(
    mara.memory.map((entry) => entry.text),
    ["The barn burned, and I let it.", "Leave the valley."],
  );

  const removedIds = revertMemoryChanges(story, changes);
  assert.deepEqual(mara.memory.map((entry) => entry.text).sort(), [
    "Brann lied.",
    "The barn burned.",
  ]);
  assert.equal(removedIds.length, 1);
});

// ── updates note ───────────────────────────────────────────────────────────────────────

test("updates move one step at a time, clamp to range and learn new skills", () => {
  const story = sampleStory();
  const mara = story.characters[0];
  mara.skills.push({ id: "skill-1", name: "Lockpicking", level: 10, note: "" });
  mara.abilities.dexterity = 1;
  const parsed = parseUpdatesNote({
    skills: [
      { character: "Mara", name: "lockpicking", change: 3, reason: "Opened the cellar." },
      { character: "Mara", name: "Swimming", change: 2 },
      { character: "Mara", name: "Swimming", change: -1 },
      { character: "Jenny", name: "Running", change: 1 },
      { character: "Ollie", name: "Running", change: 1 },
      { character: "Mara", name: "Cooking", change: 0 },
    ],
    abilities: [
      { character: "Mara", name: "DEX", change: -4 },
      { character: "Brann", name: "charisma", change: 1 },
      { character: "Brann", name: "luck", change: 1 },
    ],
  });
  const log = applyStoryUpdates({
    story,
    allowedCharacterIds: ["mara", "brann", "jenny"],
    parsedUpdates: parsed,
    newId: sequence("skill"),
  });

  assert.equal(mara.skills[0].level, 10, "already at the top");
  assert.deepEqual(
    mara.skills.map((skill) => [skill.name, skill.level]),
    [
      ["Lockpicking", 10],
      ["Swimming", 1],
    ],
  );
  assert.equal(mara.abilities.dexterity, 1, "already at the bottom");
  assert.equal(story.characters[1].abilities.charisma, 11);
  assert.equal(story.characters[2].skills[0].name, "Running", "the player's skills can move");
  assert.equal(log.length, 3);

  revertStoryUpdates(story, log);
  assert.deepEqual(
    mara.skills.map((skill) => skill.name),
    ["Lockpicking"],
  );
  assert.equal(story.characters[1].abilities.charisma, 10);
  assert.equal(story.characters[2].skills.length, 0);
});

// ── world note ─────────────────────────────────────────────────────────────────────────

test("the scene is replaced whole, and kept when the note has none", () => {
  const previous = { ...emptyScene(), location: "the barn", present: ["Mara"] };
  const parsed = parseWorldNote({
    scene: { location: "the kitchen", withinReach: ["the lantern"] },
  });
  const replaced = applySceneSnapshot(previous, parsed.scene);
  assert.equal(replaced.isReplaced, true);
  assert.deepEqual(replaced.scene, {
    ...emptyScene(),
    location: "the kitchen",
    withinReach: ["the lantern"],
  });
  const kept = applySceneSnapshot(previous, parseWorldNote({ scene: {} }).scene);
  assert.equal(kept.isReplaced, false);
  assert.equal(kept.scene, previous);
  assert.equal(applySceneSnapshot(previous, parseWorldNote(null).scene).scene, previous);
});

test("world state set replaces by subject, remove drops it, and the cap holds", () => {
  const story = sampleStory();
  const newId = sequence("fact");
  const apply = (state) => {
    const operations = parseWorldNote({ state }).stateOperations;
    return applyWorldStateOperations({ story, operations, timestamp: TIMESTAMP, newId });
  };
  apply([{ op: "set", subject: "Kitchen window", fact: "cracked", keywords: ["glass"] }]);
  apply([{ op: "set", subject: "kitchen window", fact: "broken, glass on the floor" }]);
  assert.equal(story.worldState.length, 1);
  assert.equal(story.worldState[0].fact, "broken, glass on the floor");

  apply([
    { op: "remove", subject: "KITCHEN WINDOW" },
    { op: "set", subject: "no fact" },
  ]);
  assert.equal(story.worldState.length, 0);

  for (let index = 0; index < MAX_WORLD_STATE_FACTS + 5; index++) {
    apply([{ op: "set", subject: `thing ${index}`, fact: "here" }]);
  }
  assert.equal(story.worldState.length, MAX_WORLD_STATE_FACTS);
});
