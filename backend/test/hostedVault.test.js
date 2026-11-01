// Hosted mode with encryption turned on, over HTTP: a signed-in session is locked until it
// unlocks with the password, the unlock cookie then opens the user's data, and the recovery
// code is shown once. Better Auth is stood in for (x-test-user and x-test-session headers), and
// the vault keeps its keys in memory, so this runs without a database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { lore, storyTemplates, fakeProvider, listen, sequence, clock } from "./helpers.js";
import { fakeEmbedder } from "./storyHelpers.js";
import { memoryVaultStore } from "./vaultHelpers.js";
import { createApp } from "../src/app.js";
import { createServices } from "../src/services/createServices.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createHostedTenancy } from "../src/tenancy/hostedTenancy.js";
import { createVaultService } from "../src/services/vaultService.js";
import { createVaultRoutes } from "../src/routes/vault.js";
import { badRequest } from "../src/http/errors.js";
import { UNLOCK_COOKIE_NAME } from "../src/http/unlockCookie.js";

const PASSWORD = "the account password";
const dataKeysSeen = [];

function standInAuth() {
  return {
    async handler() {
      return new Response("{}");
    },
    api: {
      async getSession({ headers }) {
        const userId = headers.get("x-test-user");
        if (!userId) {
          return null;
        }
        return { user: { id: userId }, session: { id: headers.get("x-test-session"), userId } };
      },
    },
  };
}

const storesByUser = new Map();
const provider = fakeProvider();

function servicesForUser(userId, dataKey) {
  dataKeysSeen.push(dataKey);
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

async function verifyPassword(request, password) {
  if (password !== PASSWORD) {
    throw badRequest("That password isn't right.", { field: "password" });
  }
}

let server;

before(async () => {
  const vault = createVaultService({ vaultStore: memoryVaultStore() });
  const tenancy = createHostedTenancy({
    auth: standInAuth(),
    servicesForUser,
    vault,
    vaultRoutes: createVaultRoutes({ vault, verifyPassword }),
  });
  server = await listen(createApp({ lore, tenancy, logger: { error() {} } }));
});

after(() => server.close());

async function call(method, path, { body, cookie } = {}) {
  const headers = { "x-test-user": "ada", "x-test-session": "session-1" };
  if (cookie) {
    headers.cookie = cookie;
  }
  const options = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(server.base + path, options);
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    setCookie: response.headers.get("set-cookie"),
  };
}

function unlockCookieFrom(setCookie) {
  const firstPart = setCookie.split(";")[0];
  assert.ok(firstPart.startsWith(`${UNLOCK_COOKIE_NAME}=`));
  return firstPart;
}

test("a session is locked until it unlocks, and then the cookie opens its data", async () => {
  const lockedStories = await call("GET", "/stories");
  assert.equal(lockedStories.status, 423);
  assert.equal(lockedStories.json.error.code, "locked");
  assert.equal((await call("GET", "/vault")).json.state, "locked");

  const wrong = await call("POST", "/vault/unlock", { body: { password: "nope" } });
  assert.equal(wrong.status, 400);

  const unlocked = await call("POST", "/vault/unlock", { body: { password: PASSWORD } });
  assert.equal(unlocked.status, 200);
  assert.match(unlocked.setCookie, /HttpOnly/);
  const cookie = unlockCookieFrom(unlocked.setCookie);

  const stories = await call("GET", "/stories", { cookie });
  assert.equal(stories.status, 200);
  assert.equal(dataKeysSeen.at(-1).length, 32, "the services get the unlocked data key");

  const firstStatus = await call("GET", "/vault", { cookie });
  assert.match(firstStatus.json.recoveryCode, /^[0-9A-Z-]+$/);
  await call("POST", "/vault/recovery-code/saved", { cookie });
  assert.equal((await call("GET", "/vault", { cookie })).json.recoveryCode, null);

  const forgedCookie = `${UNLOCK_COOKIE_NAME}=${"A".repeat(43)}`;
  assert.equal((await call("GET", "/stories", { cookie: forgedCookie })).status, 423);
});

test("starting over needs the typed confirmation", async () => {
  const unconfirmed = await call("POST", "/vault/start-over", { body: { password: PASSWORD } });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.json.error.details.field, "confirmation");
});
