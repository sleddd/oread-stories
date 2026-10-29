// End-to-end over real HTTP: status codes, error shape, CORS and streaming.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeApp, listen, readNdjson } from "./helpers.js";

const FRONTEND_ORIGIN = "http://127.0.0.1:5173";

let server;
let base;

before(async () => {
  server = await listen(makeApp().app);
  base = server.base;
});

after(() => server.close());

function requestJson(method, path, body) {
  const options = { method, headers: {} };
  if (body) {
    options.headers = { "content-type": "application/json" };
    options.body = JSON.stringify(body);
  }
  return fetch(base + path, options);
}

async function getJson(path) {
  const response = await fetch(base + path);
  return response.json();
}

test("GET /health", async () => {
  const response = await fetch(base + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", requiresSignIn: false });
});

test("unknown paths are JSON 404s; wrong methods are 405 with Allow", async () => {
  const notFoundResponse = await fetch(base + "/nope");
  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error.code, "not_found");

  const wrongMethodResponse = await requestJson("DELETE", "/lore");
  assert.equal(wrongMethodResponse.status, 405);
  assert.equal(wrongMethodResponse.headers.get("allow"), "GET");
});

test("bad JSON is a 400 and the wrong content type is a 415", async () => {
  const badJsonResponse = await fetch(base + "/personality", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{oops",
  });
  assert.equal(badJsonResponse.status, 400);

  const plainTextResponse = await fetch(base + "/personality", {
    method: "PATCH",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(plainTextResponse.status, 415);
});

test("CORS allows the frontend origin and answers preflight", async () => {
  const preflight = await fetch(base + "/chats", {
    method: "OPTIONS",
    headers: { origin: FRONTEND_ORIGIN, "access-control-request-method": "POST" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), FRONTEND_ORIGIN);

  const otherOrigin = await fetch(base + "/health", { headers: { origin: "http://evil.example" } });
  assert.equal(otherOrigin.headers.get("access-control-allow-origin"), null);
});

test("GET /lore returns controls only", async () => {
  const controls = await getJson("/lore");
  assert.equal(controls.axes.length, 9);
  assert.ok(!("language" in controls) && !("actionVoice" in controls));
});

test("personality: PATCH validates and returns the prompt; presets 404 when unknown", async () => {
  const validPatch = await requestJson("PATCH", "/personality", { values: { agency: 1.2 } });
  assert.equal(validPatch.status, 200);
  assert.match((await validPatch.json()).derived.prompt, /You speak with confidence/);

  const invalidPatch = await requestJson("PATCH", "/personality", { values: { agency: "lots" } });
  assert.equal(invalidPatch.status, 400);
  assert.equal((await invalidPatch.json()).error.details.field, "values.agency");

  assert.equal((await requestJson("POST", "/personality/presets/42")).status, 404);
  assert.equal((await requestJson("POST", "/personality/presets/0")).status, 200);
});

test("chats: create is 201, messages stream as NDJSON, delete is 204", async () => {
  const createResponse = await requestJson("POST", "/chats", { title: "Over HTTP" });
  assert.equal(createResponse.status, 201);
  const chat = await createResponse.json();

  const emptyMessage = await requestJson("POST", `/chats/${chat.id}/messages`, { content: "   " });
  assert.equal(emptyMessage.status, 400);

  const sendResponse = await requestJson("POST", `/chats/${chat.id}/messages`, {
    content: "Hello",
  });
  assert.equal(sendResponse.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  const events = await readNdjson(sendResponse);
  const eventTypes = events.map((event) => event.type);
  assert.deepEqual(eventTypes, ["chat", "start", "speaker", "delta", "delta", "done", "chat"]);
  assert.equal(events.at(-1).chat.messages.at(-1).content, "Hello there.");

  const context = await getJson(`/chats/${chat.id}/context?draft=More`);
  assert.match(context.messages.at(-1).content, /^More\n\n\[Scene note/);

  assert.equal((await requestJson("DELETE", `/chats/${chat.id}`)).status, 204);
  assert.equal((await fetch(`${base}/chats/${chat.id}`)).status, 404);
});

test("settings: PATCH masks secrets in the response", async () => {
  const response = await requestJson("PATCH", "/settings", {
    anthropic: { apiKey: "sk-ant-abcdefgh" },
  });
  const settings = await response.json();
  assert.ok(!JSON.stringify(settings).includes("abcdefgh".slice(0, 4)));
  assert.equal(settings.secrets.anthropic.apiKey.hint, "…efgh");
  assert.equal((await requestJson("PATCH", "/settings", { provider: "nope" })).status, 400);
});

test("providers: models and connection test", async () => {
  const modelList = await getJson("/providers/openai/models");
  assert.deepEqual(modelList.models, [{ id: "fake-1", label: "Fake 1" }]);

  const connectionTest = await (await requestJson("POST", "/providers/anthropic/test")).json();
  assert.equal(connectionTest.reply, "Hello there.");

  assert.equal((await fetch(base + "/providers/skynet/models")).status, 404);
});

test("export and import round-trip chats and personality", async () => {
  const exported = await getJson("/export");
  assert.equal(exported.app, "oread");
  assert.ok(!JSON.stringify(exported).includes("sk-ant"));

  const wrongApp = await requestJson("POST", "/import", { app: "other" });
  assert.equal(wrongApp.status, 400);

  const importResponse = await requestJson("POST", "/import", {
    app: "oread",
    personality: { name: "Imported" },
    chats: [{ id: "x1", title: "From file", messages: [], created: 1, updated: 1 }],
  });
  assert.deepEqual((await importResponse.json()).imported, {
    personality: true,
    stories: 0,
    chats: 1,
  });
  assert.equal((await getJson("/personality")).personality.name, "Imported");
});
