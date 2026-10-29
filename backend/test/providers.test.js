// Provider plumbing: transcript normalisation, SSE parsing and the AWS SigV4 signer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessages } from "../src/providers/normalizeMessages.js";
import { sseEvents } from "../src/providers/sseEvents.js";
import { signAws } from "../src/providers/signAws.js";

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
