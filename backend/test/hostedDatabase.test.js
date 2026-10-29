// Hosted mode for real: Better Auth and Prisma against Postgres, with a fake mailer that keeps
// the emails it would have sent. Runs only with TEST_DATABASE_URL (npm run test:db).
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { lore, storyTemplates, fakeProvider } from "./helpers.js";
import { fakeEmbedder } from "./storyHelpers.js";
import { checkTenantIsolation } from "./tenantIsolation.js";
import {
  databaseSkipReason,
  connectTestDatabase,
  uniqueId,
  TEST_SECRET_KEY,
} from "./databaseHelpers.js";
import { createApp } from "../src/app.js";
import { parseSignUpAllowlist } from "../src/auth/signUpAllowlist.js";

const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "staple battery horse correct";

function fakeMailer() {
  const sent = [];
  return {
    sent,
    async send(email) {
      sent.push(email);
    },
  };
}

function linkIn(email) {
  return email.text.split("\n").find((line) => line.startsWith("http"));
}

function lastEmailTo(mailer, address) {
  const emails = mailer.sent.filter((email) => email.to === address);
  return emails[emails.length - 1];
}

function sessionCookieFrom(response) {
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  return cookies.join("; ");
}

describe("hosted mode with Postgres", { skip: databaseSkipReason }, () => {
  let prisma;
  let server;
  let origin;
  let hosted;
  const mailer = fakeMailer();
  const emails = [];

  // A second "process" sharing the database, to check claims across instances.
  let otherInstance;

  before(async () => {
    prisma = await connectTestDatabase();
    const { createHostedSetup } = await import("../src/tenancy/createHostedSetup.js");
    let handler;
    server = http.createServer((request, response) => handler(request, response));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    const config = {
      secretKey: TEST_SECRET_KEY,
      authSecret: "test-secret-that-is-long-enough-for-better-auth",
      publicUrl: origin,
      trustedOrigins: [origin],
      useSecureCookies: false,
      isAuthRateLimited: false,
      signUpAllowlist: parseSignUpAllowlist("@example.test"),
    };
    const provider = fakeProvider();
    const serviceOptions = {
      providers: { anthropic: provider, openai: provider, gemini: provider, bedrock: provider },
      storyTemplates,
      embedder: fakeEmbedder(),
    };
    hosted = createHostedSetup({ config, lore, prisma, mailer, serviceOptions });
    otherInstance = createHostedSetup({ config, lore, prisma, mailer, serviceOptions });
    handler = createApp({ lore, tenancy: hosted.tenancy, logger: { error() {} } });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    server.close();
    await prisma.$disconnect();
  });

  async function authCall(path, body, cookie) {
    const headers = { "content-type": "application/json", origin };
    if (cookie) {
      headers.cookie = cookie;
    }
    return fetch(`${origin}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    });
  }

  async function signUp(name) {
    const email = `${uniqueId(name)}@example.test`;
    emails.push(email);
    const response = await authCall("/sign-up/email", { email, password: PASSWORD, name });
    assert.equal(response.status, 200);
    return email;
  }

  async function verify(email) {
    const response = await fetch(linkIn(lastEmailTo(mailer, email)), { redirect: "manual" });
    assert.equal(response.status, 302);
    return sessionCookieFrom(response);
  }

  async function signIn(email, password = PASSWORD) {
    return authCall("/sign-in/email", { email, password });
  }

  async function apiCall(cookie, method, path, body) {
    const headers = { origin, cookie };
    const options = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${origin}/api/v1${path}`, options);
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null };
  }

  async function newVerifiedUser(name) {
    const email = await signUp(name);
    const cookie = await verify(email);
    const user = await prisma.user.findUnique({ where: { email } });
    return { email, cookie, userId: user.id };
  }

  it("signs up, confirms the email, and starts the account with My story", async () => {
    const email = await signUp("ann");
    assert.match(lastEmailTo(mailer, email).subject, /Confirm your email/);

    const beforeVerifying = await signIn(email);
    assert.equal(beforeVerifying.status, 403);

    const cookie = await verify(email);
    const stories = await apiCall(cookie, "GET", "/stories");
    assert.equal(stories.status, 200);
    assert.equal(stories.json.stories[0].id, "my-story");
    assert.equal((await apiCall("", "GET", "/stories")).status, 401);
  });

  it("turns away sign-ups from addresses that aren't on the allowlist", async () => {
    const outsider = `${uniqueId("outsider")}@elsewhere.test`;
    const response = await authCall("/sign-up/email", {
      email: outsider,
      password: PASSWORD,
      name: "Outsider",
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /invite-only/);
    assert.equal(await prisma.user.findUnique({ where: { email: outsider } }), null);
    assert.equal(lastEmailTo(mailer, outsider), undefined);
  });

  it("resets a forgotten password by email", async () => {
    const { email } = await newVerifiedUser("reset");
    const request = await authCall("/request-password-reset", { email, redirectTo: "/" });
    assert.equal(request.status, 200);
    const resetEmail = lastEmailTo(mailer, email);
    assert.match(resetEmail.subject, /Reset your Oread password/);
    const token = new URL(linkIn(resetEmail)).pathname.split("/").pop();

    const reset = await authCall("/reset-password", { newPassword: NEW_PASSWORD, token });
    assert.equal(reset.status, 200);
    assert.equal((await signIn(email, PASSWORD)).status, 401);
    const signedIn = await signIn(email, NEW_PASSWORD);
    assert.equal(signedIn.status, 200);
    const cookie = sessionCookieFrom(signedIn);
    assert.equal((await apiCall(cookie, "GET", "/stories")).status, 200);
  });

  it("keeps every account's data to itself", async () => {
    const owner = await newVerifiedUser("owner");
    const stranger = await newVerifiedUser("stranger");
    const cookies = { owner: owner.cookie, stranger: stranger.cookie };
    const callAs = (user, method, path, body) => apiCall(cookies[user], method, path, body);
    await checkTenantIsolation({ callAs, owner: "owner", stranger: "stranger" });
  });

  it("encrypts provider keys, never returns them, and uses no server keys", async () => {
    const { cookie, userId } = await newVerifiedUser("keys");
    process.env.OPENAI_API_KEY = "sk-server-should-not-be-used";
    try {
      const saved = await apiCall(cookie, "PATCH", "/settings", {
        anthropic: { apiKey: "sk-ant-user-5678" },
      });
      assert.equal(saved.status, 200);
      assert.ok(!JSON.stringify(saved.json).includes("sk-ant-user-5678"));
      assert.deepEqual(saved.json.secrets.anthropic.apiKey, { source: "saved", hint: "…5678" });
      assert.deepEqual(saved.json.secrets.openai.apiKey, { source: "" });

      const rows = await prisma.providerSecret.findMany({ where: { userId } });
      assert.equal(rows.length, 1);
      assert.ok(!rows[0].ciphertext.includes("sk-ant"));
      const settingsRow = await prisma.userSettings.findUnique({ where: { userId } });
      assert.ok(!JSON.stringify(settingsRow.data).includes("sk-ant"));

      const services = hosted.servicesForUser(userId);
      assert.equal(
        (await services.settings.providerConfig("anthropic")).apiKey,
        "sk-ant-user-5678",
      );
      assert.equal((await services.settings.providerConfig("openai")).apiKey, "");
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("lets only one server instance write a reply in a chat at a time", async () => {
    const { cookie, userId } = await newVerifiedUser("streams");
    const chat = (await apiCall(cookie, "POST", "/stories/my-story/chats", {})).json;
    const here = hosted.servicesForUser(userId).storage.streamingGuard;
    const elsewhere = otherInstance.servicesForUser(userId).storage.streamingGuard;

    assert.equal(await here.claim(chat.id), true);
    assert.equal(await elsewhere.claim(chat.id), false);
    await here.release(chat.id);
    assert.equal(await elsewhere.claim(chat.id), true);
    await elsewhere.release(chat.id);
  });

  it("deleting the account deletes everything it owned", async () => {
    const { cookie, userId } = await newVerifiedUser("leaver");
    await apiCall(cookie, "PATCH", "/settings", { anthropic: { apiKey: "sk-ant-leaver-0000" } });
    await apiCall(cookie, "POST", "/stories/my-story/chats", {});
    assert.ok((await prisma.story.count({ where: { userId } })) > 0);

    const deleted = await authCall("/delete-user", { password: PASSWORD }, cookie);
    assert.equal(deleted.status, 200);
    assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
    assert.equal(await prisma.story.count({ where: { userId } }), 0);
    assert.equal(await prisma.chat.count({ where: { userId } }), 0);
    assert.equal(await prisma.providerSecret.count({ where: { userId } }), 0);
    assert.equal(await prisma.userSettings.count({ where: { userId } }), 0);
  });
});
