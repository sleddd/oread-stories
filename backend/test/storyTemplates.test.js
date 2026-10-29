// Pre-built stories: converting the templates, the trait-to-dial table, starting a story from a
// template over HTTP, the opening scene as narration, and the story's rules in the prompt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { lore, storyTemplates, makeApp, listen, drain } from "./helpers.js";
import { fakeEmbedder, scriptedProvider, protocolReply } from "./storyHelpers.js";
import { templateToStory, TEMPLATE_SKILL_LEVEL } from "../src/stories/templateToStory.js";
import { dialValuesForTraits, tagsForTraits } from "../src/stories/templateTraits.js";
import { DEFAULT_STORY_TEMPLATES_DIRECTORY } from "../src/stories/loadStoryTemplates.js";
import { describeStoryCore } from "../src/prompt/storyCore.js";

const TEMPLATE_COUNT = 19;

function readTemplateFile(templateId) {
  const filePath = path.join(DEFAULT_STORY_TEMPLATES_DIRECTORY, `${templateId}.json`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function snapshotTemplateFiles() {
  const snapshot = {};
  for (const fileName of readdirSync(DEFAULT_STORY_TEMPLATES_DIRECTORY)) {
    snapshot[fileName] = readFileSync(path.join(DEFAULT_STORY_TEMPLATES_DIRECTORY, fileName));
  }
  return snapshot;
}

let server;
let base;
let templateFilesBefore;

before(async () => {
  templateFilesBefore = snapshotTemplateFiles();
  server = await listen(makeApp({ embedder: fakeEmbedder() }).app);
  base = server.base;
});

after(() => server.close());

async function call(method, urlPath, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers = { "content-type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + urlPath, options);
  let json = null;
  if (response.status !== 204) {
    json = await response.json();
  }
  return { status: response.status, json };
}

test("every template loads, sorted by title, with a category and its cast", () => {
  assert.equal(storyTemplates.length, TEMPLATE_COUNT);
  const titles = storyTemplates.map((template) => template.title);
  assert.deepEqual(
    titles,
    [...titles].sort((first, second) => first.localeCompare(second)),
  );
  const manor = storyTemplates.find((template) => template.id === "whodunnit-manor");
  assert.equal(manor.category, "mystery");
  assert.deepEqual(manor.characterNames, [
    "Colonel Richard Ashford",
    "Vivienne LaRoux",
    "Mrs. Agnes Finch",
  ]);
  assert.ok(Object.isFrozen(manor.blueprint));
});

test("a multi-character template becomes a story with a cast, a setting and an opening", () => {
  const story = templateToStory(lore, readTemplateFile("whodunnit-manor"));
  assert.equal(story.title, "Whodunnit Manor");
  assert.match(story.plot, /Clue-style murder mystery/);
  assert.match(story.pointOfView, /^Third person limited/);
  assert.equal(story.rules[0], "Never speak or act for the User");
  assert.match(story.openingScene, /^Lightning splits the sky/);
  assert.equal(story.worldNotes.length, 1);
  assert.equal(story.worldNotes[0].category, "setting");
  assert.equal(story.worldNotes[0].pinned, true);
  assert.equal(story.worldState.length, 3);
  assert.match(story.worldState[2].fact, /^Mrs\. Agnes Finch carries master key ring/);
  assert.deepEqual(story.worldState[2].keywords, ["Agnes", "Finch"]);

  const colonel = story.characters[0];
  assert.equal(colonel.name, "Colonel Richard Ashford");
  assert.match(colonel.summary, /found the body\. 62, Male, Human\.$/);
  assert.equal(colonel.skills[1].name, "Firearms");
  assert.equal(colonel.skills[1].note, "Firearms, bladed weapons, and hand-to-hand combat");
  assert.ok(colonel.skills.every((skill) => skill.level === TEMPLATE_SKILL_LEVEL));
  assert.equal(colonel.memory[0].kind, "identity");
  assert.match(colonel.memory[0].text, /^I am Colonel Richard Ashford: retired military/);
  const kinds = new Set(colonel.memory.map((entry) => entry.kind));
  assert.deepEqual([...kinds], ["identity", "self", "opinion"]);
  assert.equal(story.characters.length, 3);
});

test("a companion template keeps its opening instruction and banned words as rules", () => {
  const story = templateToStory(lore, readTemplateFile("companion-echo"));
  assert.equal(story.openingScene, "");
  assert.equal(story.characters.length, 1);
  assert.equal(story.characters[0].name, "Echo");
  assert.match(story.rules[0], /^How to open a conversation: Lead with YOUR energy/);
  assert.ok(story.rules.some((rule) => rule.startsWith("Never use these words: buddy, pal")));
  assert.ok(story.rules.some((rule) => rule.includes("as an AI language model")));
  assert.equal(story.worldState.length, 0);
});

test("every template character gets ability scores, and a bad score falls back", () => {
  for (const template of storyTemplates) {
    for (const character of template.blueprint.characters) {
      const scores = Object.values(character.abilities);
      assert.equal(scores.length, 6, `${character.name} has six scores`);
      assert.ok(
        scores.some((score) => score !== 10),
        `${character.name} has real scores`,
      );
    }
  }
  const template = readTemplateFile("fantasy-tavern");
  const scores = { Grimjaw: { strength: 18, wisdom: 40, charisma: "high" } };
  const blueprint = templateToStory(lore, template, scores);
  const grimjaw = blueprint.characters.find((character) => character.name === "Grimjaw");
  assert.equal(grimjaw.abilities.strength, 18);
  assert.equal(grimjaw.abilities.wisdom, 10);
  assert.equal(grimjaw.abilities.charisma, 10);
});

test("trait words move dials and pick at most one tag per group", () => {
  const values = dialValuesForTraits(lore, ["Reserved", "Steady", "Calm", "Practical"]);
  assert.equal(values.reactivity, -2);
  assert.equal(values.communion, -0.5);
  assert.equal(values.openness, -0.5);
  assert.equal(values.valence, 0);
  assert.deepEqual(tagsForTraits(lore, ["Dry", "Witty", "Honest", "Unknown"]), ["dry", "candor"]);
});

test("the template list leaves out the blueprints", async () => {
  const { status, json } = await call("GET", "/story-templates");
  assert.equal(status, 200);
  assert.equal(json.templates.length, TEMPLATE_COUNT);
  assert.equal(json.templates[0].blueprint, undefined);
  assert.ok(json.templates.every((template) => template.characterNames.length > 0));
});

test("a story started from a template is an independent copy", async () => {
  const first = await call("POST", "/story-templates/whodunnit-manor/stories");
  const second = await call("POST", "/story-templates/whodunnit-manor/stories");
  assert.equal(first.status, 201);
  assert.notEqual(first.json.id, second.json.id);
  assert.equal(first.json.characters.length, 3);
  assert.notEqual(first.json.characters[0].id, second.json.characters[0].id);
  assert.equal(first.json.characters[0].memoryCount > 1, true);
  assert.equal(first.json.rules.length, 8);
  assert.equal(first.json.characters[0].abilities.wisdom, 15);

  const storyId = first.json.id;
  await call("PATCH", `/stories/${storyId}`, { title: "My manor", rules: ["Keep it short."] });
  const changed = await call("GET", `/stories/${storyId}`);
  assert.deepEqual(changed.json.rules, ["Keep it short."]);
  const untouched = await call("GET", `/stories/${second.json.id}`);
  assert.equal(untouched.json.title, "Whodunnit Manor");

  const colonelId = first.json.characters[0].id;
  const memory = await call("GET", `/stories/${storyId}/characters/${colonelId}/memory`);
  assert.ok(memory.json.memory.every((entry) => entry.source === "template"));

  assert.equal((await call("POST", "/story-templates/nowhere/stories")).status, 404);
  assert.deepEqual(snapshotTemplateFiles(), templateFilesBefore);
});

test("a new chat in the story opens with the scene as narration", async () => {
  const story = (await call("POST", "/story-templates/whodunnit-manor/stories")).json;
  const chat = (await call("POST", `/stories/${story.id}/chats`, {})).json;
  assert.equal(chat.messages.length, 1);
  const [opening] = chat.messages;
  assert.equal(opening.role, "narration");
  assert.equal(opening.speakerId, undefined);
  assert.match(opening.content, /^Lightning splits the sky/);

  const cleared = (await call("POST", `/chats/${chat.id}/clear`)).json;
  assert.equal(cleared.messages.length, 1);
  assert.equal(cleared.messages[0].role, "narration");

  const companion = (await call("POST", "/story-templates/companion-echo/stories")).json;
  const companionChat = (await call("POST", `/stories/${companion.id}/chats`, {})).json;
  assert.equal(companionChat.messages.length, 0);
});

test("the opening narration reaches the model, and the rules are in the story core", async () => {
  const provider = scriptedProvider([
    protocolReply({ speaker: "Colonel Richard Ashford", text: "*grips the poker* Nobody move." }),
  ]);
  const { services } = makeApp({ provider, embedder: fakeEmbedder() });
  const story = await services.storyTemplates.createStory("whodunnit-manor");
  const chat = await services.chats.create({ storyId: story.id });

  await drain(services.chats.send(chat.id, "Who locked the door?"));

  const request = provider.calls[0].request;
  assert.match(request.system, /Rules of this story:\n- Never speak or act for the User/);
  assert.match(request.messages[0].content, /^\(Narration\)\nLightning splits the sky/);
  assert.match(request.messages[1].content, /^Who locked the door\?/);
  const saved = await services.chats.get(chat.id);
  assert.equal(saved.messages[0].role, "narration");
  assert.equal(saved.messages.at(-1).content, "*grips the poker* Nobody move.");
});

test("the story core lists the rules after the overview", () => {
  const core = describeStoryCore({ title: "T", rules: ["One.", "Two."] });
  assert.equal(core, "The story:\nTitle: T\nRules of this story:\n- One.\n- Two.");
  assert.equal(describeStoryCore({ title: "T" }), "The story:\nTitle: T");
});

test("rules and the opening scene are checked at the edge", async () => {
  const story = (await call("POST", "/stories", { title: "Edge" })).json;
  assert.deepEqual(story.rules, []);
  assert.equal(story.openingScene, "");
  const badRules = await call("PATCH", `/stories/${story.id}`, { rules: "not a list" });
  assert.equal(badRules.status, 400);
  const tooLong = await call("PATCH", `/stories/${story.id}`, { openingScene: "x".repeat(9000) });
  assert.equal(tooLong.status, 400);
  const saved = await call("PATCH", `/stories/${story.id}`, { openingScene: "  Rain.  " });
  assert.equal(saved.json.openingScene, "Rain.");
});
