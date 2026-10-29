// Hosted mode's request handling, with a stand-in for Better Auth (the header x-test-user is
// the signed-in user) and in-memory storage per user, so it runs without a database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { lore, storyTemplates, fakeProvider, listen, sequence, clock } from "./helpers.js";
import { fakeEmbedder } from "./storyHelpers.js";
import { checkTenantIsolation } from "./tenantIsolation.js";
import { createApp } from "../src/app.js";
import { createServices } from "../src/services/createServices.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createHostedTenancy } from "../src/tenancy/hostedTenancy.js";

const TEST_USER_HEADER = "x-test-user";

function standInAuth() {
  return {
    async handler(request) {
      const body = JSON.stringify({ handledBy: "auth", path: new URL(request.url).pathname });
      return new Response(body, { headers: { "content-type": "application/json" } });
    },
    api: {
      async getSession({ headers }) {
        const userId = headers.get(TEST_USER_HEADER);
        if (!userId) {
          return null;
        }
        return { user: { id: userId }, session: { userId } };
      },
    },
  };
}

const storesByUser = new Map();
const provider = fakeProvider();

function servicesForUser(userId) {
  if (!storesByUser.has(userId)) {
    storesByUser.set(userId, createMemoryStore());
  }
  return createServices({
    lore,
    store: storesByUser.get(userId),
    providers: { anthropic: provider, openai: provider, gemini: provider, bedrock: provider },
    env: {},
    storyTemplates,
    embedder: fakeEmbedder(),
    now: clock(),
    newId: sequence(`${userId}-`),
  });
}

let server;

before(async () => {
  const tenancy = createHostedTenancy({ auth: standInAuth(), servicesForUser });
  server = await listen(createApp({ lore, tenancy, logger: { error() {} } }));
});

after(() => server.close());

async function call(method, path, { body, user } = {}) {
  const headers = {};
  if (user) {
    headers[TEST_USER_HEADER] = user;
  }
  const options = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(server.base + path, options);
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

test("every API call needs a signed-in session, except the health check", async () => {
  const health = await call("GET", "/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.requiresSignIn, true);

  const stories = await call("GET", "/stories");
  assert.equal(stories.status, 401);
  assert.equal(stories.json.error.code, "unauthenticated");
  assert.equal((await call("POST", "/stories", { body: { title: "x" } })).status, 401);
});

test("sign-in routes under /api/auth go to the auth handler", async () => {
  const response = await fetch(server.base.replace("/api/v1", "/api/auth/get-session"));
  assert.deepEqual(await response.json(), { handledBy: "auth", path: "/api/auth/get-session" });
});

test("each user sees only their own stories, chats, memories and export", async () => {
  const callAs = (user, method, path, body) => call(method, path, { user, body });
  await checkTenantIsolation({ callAs, owner: "ann", stranger: "bob" });
});

test("every user starts with their own My story", async () => {
  const caraStories = (await call("GET", "/stories", { user: "cara" })).json.stories;
  const devStories = (await call("GET", "/stories", { user: "dev" })).json.stories;
  assert.equal(caraStories[0].id, "my-story");
  assert.equal(devStories[0].id, "my-story");
});
