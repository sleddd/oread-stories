// Provider plumbing: transcript normalisation, SSE parsing and the AWS SigV4 signer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessages } from "../src/providers/normalizeMessages.js";
import { sseEvents } from "../src/providers/sseEvents.js";
import { signAws } from "../src/providers/signAws.js";
import { featherless } from "../src/providers/featherless.js";
import { createModelService } from "../src/services/modelService.js";

test("normalizeMessages merges repeated roles, drops empties and starts with the user", () => {
  const messages = [
    { role: "assistant", content: "Hi." },
    { role: "assistant", content: "Still here." },
    { role: "user", content: "  " },
    { role: "user", content: "Hello" },
    { role: "shift", content: "x" },
  ];
  assert.deepEqual(normalizeMessages(messages), [
    { role: "user", content: "(The scene begins.)" },
    { role: "assistant", content: "Hi.\n\nStill here." },
    { role: "user", content: "Hello" },
  ]);
});

test("sseEvents parses events split across chunks", async () => {
  const encoder = new TextEncoder();
  async function* body() {
    yield encoder.encode('event: delta\ndata: {"a"');
    yield encoder.encode(":1}\n\ndata: line1\ndata: line2\r\n\r\n");
  }
  const events = [];
  for await (const event of sseEvents(body())) {
    events.push(event);
  }
  assert.deepEqual(events, [
    { event: "delta", data: '{"a":1}' },
    { event: "message", data: "line1\nline2" },
  ]);
});

test("signAws matches the AWS SigV4 test suite (get-vanilla)", () => {
  const headers = signAws({
    method: "GET",
    url: "https://example.amazonaws.com/",
    service: "service",
    region: "us-east-1",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    now: new Date("2015-08-30T12:36:00Z"),
    payloadHeader: false,
  });
  const expectedAuthorization =
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
    "SignedHeaders=host;x-amz-date, " +
    "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31";
  assert.equal(headers.authorization, expectedAuthorization);
});

// A fetch that records each call and answers with `answerFor(url)`, passed in the config.
function fakeFetch(answerFor) {
  const calls = [];
  async function fetchFunction(url, options) {
    calls.push({ url, options });
    return answerFor(url);
  }
  return { calls, fetchFunction };
}

function jsonAnswer(body) {
  return new Response(JSON.stringify(body), { status: 200 });
}

test("featherless streams from its own API, names the app and needs a key", async () => {
  const streamBody =
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
  const fake = fakeFetch(() => new Response(streamBody, { status: 200 }));
  const config = { apiKey: "fl-key", fetchFunction: fake.fetchFunction };
  {
    const request = { model: "some/model", system: "Be Mara.", messages: [], maxTokens: 512 };
    const chunks = [];
    for await (const chunk of featherless.stream(config, request)) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, [{ text: "Hello" }, { usage: { stop: "stop" } }]);
    const [call] = fake.calls;
    assert.equal(call.url, "https://api.featherless.ai/v1/chat/completions");
    assert.equal(call.options.headers.authorization, "Bearer fl-key");
    assert.equal(call.options.headers["X-Title"], "Oread");
    assert.match(call.options.headers["user-agent"], /^Oread\//);
    assert.equal(JSON.parse(call.options.body).max_tokens, 512);

    const withoutKey = featherless.stream({ fetchFunction: fake.fetchFunction }, request);
    await assert.rejects(withoutKey.next(), /Featherless API key is not set/);
  }
});

test("featherless lists the plan's chat models in one call, most-downloaded first", async () => {
  const fake = fakeFetch(() =>
    jsonAnswer({
      data: [
        { id: "popular/model", context_length: 32768, available_on_current_plan: true },
        { id: "locked/model", context_length: 32768, available_on_current_plan: false },
        { id: "another/model", available_on_current_plan: true },
      ],
    }),
  );
  {
    const models = await featherless.listModels({
      apiKey: "fl-key",
      fetchFunction: fake.fetchFunction,
    });
    assert.deepEqual(models, [
      { id: "popular/model", label: "popular/model (33k context)" },
      { id: "another/model", label: "another/model" },
    ]);
    assert.equal(fake.calls.length, 1);
    const query = new URL(fake.calls[0].url).searchParams;
    assert.equal(query.get("available_on_current_plan"), "true");
    assert.equal(query.get("conversational"), "true");
    assert.equal(query.get("sort"), "-downloads");
    assert.equal(query.get("q"), null);

    await featherless.listModels(
      { apiKey: "fl-key", fetchFunction: fake.fetchFunction },
      { search: "hermes" },
    );
    const searchQuery = new URL(fake.calls[1].url).searchParams;
    assert.equal(searchQuery.get("q"), "hermes");
    assert.equal(searchQuery.get("available_on_current_plan"), "true");
    assert.equal(searchQuery.get("conversational"), null, "a search reaches non-chat models");
    assert.equal(searchQuery.get("context_length_min"), null, "and short-context ones");
  }
});

test("a model search keeps the models whose id or name contains it, ignoring case", async () => {
  const fakeProvider = {
    listModels: async () => [
      { id: "anthropic.claude-sonnet", label: "Anthropic Claude Sonnet" },
      { id: "meta.llama3-70b", label: "Meta Llama 3 70B" },
    ],
  };
  const models = createModelService({
    settings: { providerConfig: async () => ({}) },
    providers: { bedrock: fakeProvider },
  });
  const byName = await models.listModels("bedrock", { search: "LLAMA" });
  assert.deepEqual(
    byName.map((model) => model.id),
    ["meta.llama3-70b"],
  );
  assert.equal((await models.listModels("bedrock")).length, 2);
});
