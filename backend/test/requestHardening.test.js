// Hardening at the HTTP edge: security headers on every response, malformed URLs and imports
// answered with a 400 instead of a server error, and the per-user request limit.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { makeApp, listen } from "./helpers.js";
import { Router } from "../src/http/router.js";
import { createRateLimiter } from "../src/http/rateLimiter.js";
import { createHostedTenancy } from "../src/tenancy/hostedTenancy.js";

let server;

before(async () => {
  server = await listen(makeApp().app);
});

after(() => server.close());

function postJson(path, body) {
  return fetch(server.base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("every response carries the security headers", async () => {
  const response = await fetch(server.base + "/health");
  const policy = response.headers.get("content-security-policy");
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /script-src 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  // Served over plain http here, so no Strict-Transport-Security.
  assert.equal(response.headers.get("strict-transport-security"), null);
});

test("Strict-Transport-Security is sent when Oread is served over https", async () => {
  const httpsServer = await listen(makeApp({ isServedOverHttps: true }).app);
  try {
    const response = await fetch(httpsServer.base + "/health");
    assert.match(response.headers.get("strict-transport-security"), /max-age=\d+/);
  } finally {
    await httpsServer.close();
  }
});

test("a malformed %-escape in a path parameter is a 400", async () => {
  const router = new Router().get("/chats/:chatId", () => "found");
  assert.throws(() => router.match("GET", "/chats/%E0%A4%A"), { status: 400 });
  const response = await fetch(server.base + "/chats/%E0%A4%A");
  assert.equal(response.status, 400);
});

test("imports with ids that aren't short strings are refused", async () => {
  const story = { id: "s1", title: "A", characters: [], worldNotes: [], worldState: [] };
  const badImports = [
    { app: "oread", chats: [{ id: { not: "" }, messages: [] }] },
    { app: "oread", chats: [{ id: 42, messages: [] }] },
    { app: "oread", chats: [{ id: "c1", storyId: ["x"], messages: [] }] },
    { app: "oread", chats: [{ id: "c1", title: 7, messages: [] }] },
    { app: "oread", chats: [{ id: "x".repeat(201), messages: [] }] },
    { app: "oread", stories: [{ ...story, id: { in: ["s1"] } }] },
    { app: "oread", stories: [{ ...story, id: "   " }] },
  ];
  for (const badImport of badImports) {
    const response = await postJson("/import", badImport);
    assert.equal(response.status, 400, JSON.stringify(badImport).slice(0, 80));
  }
});

test("the rate limiter allows the limit per window, then says when to retry", () => {
  let currentTime = 0;
  const limiter = createRateLimiter({
    limit: 2,
    windowMilliseconds: 60_000,
    now: () => currentTime,
  });
  assert.equal(limiter.hit("ana").isAllowed, true);
  assert.equal(limiter.hit("ana").isAllowed, true);
  assert.equal(limiter.hit("bo").isAllowed, true, "each user has their own count");
  currentTime = 15_000;
  assert.deepEqual(limiter.hit("ana"), { isAllowed: false, retryAfterSeconds: 45 });
  currentTime = 60_000;
  assert.equal(limiter.hit("ana").isAllowed, true, "a new window starts fresh");
});

test("hosted requests over the per-user limit get a 429", async () => {
  const auth = {
    handler: async () => new Response("{}"),
    api: { getSession: async () => ({ user: { id: "ana" } }) },
  };
  const tenancy = createHostedTenancy({
    auth,
    servicesForUser: () => ({}),
    rateLimiter: createRateLimiter({ limit: 1, windowMilliseconds: 60_000 }),
  });
  const request = { headers: {} };
  await tenancy.servicesFor(request);
  await assert.rejects(tenancy.servicesFor(request), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, "too_many_requests");
    assert.ok(error.details.retryAfterSeconds > 0);
    return true;
  });
});
