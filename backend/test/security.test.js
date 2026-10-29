// Keeping provider keys safe: encryption at rest, keys never sent to the browser, no server keys
// shared with hosted users, and no provider base URLs that point inside the server's network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSecretCipher } from "../src/security/secretCipher.js";
import { createOutboundUrlGuard, isPrivateAddress } from "../src/security/outboundUrlGuard.js";
import { createSettingsService } from "../src/services/settingsService.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { storageModeFor, LOCAL_MODE, HOSTED_MODE } from "../src/tenancy/storageMode.js";
import { loadConfig } from "../src/config.js";
import { TEST_SECRET_KEY } from "./databaseHelpers.js";

test("the cipher round-trips a key, and refuses a wrong context or a tampered value", () => {
  const cipher = createSecretCipher(TEST_SECRET_KEY);
  const sealed = cipher.encrypt("sk-ant-secret", "user-1:anthropic:apiKey");
  assert.ok(!sealed.ciphertext.includes("secret"));
  assert.equal(cipher.decrypt(sealed, "user-1:anthropic:apiKey"), "sk-ant-secret");
  assert.throws(() => cipher.decrypt(sealed, "user-2:anthropic:apiKey"));
  const tampered = { ...sealed, ciphertext: Buffer.from("other").toString("base64") };
  assert.throws(() => cipher.decrypt(tampered, "user-1:anthropic:apiKey"));
  const sealedAgain = cipher.encrypt("sk-ant-secret", "user-1:anthropic:apiKey");
  assert.notEqual(sealedAgain.ciphertext + sealedAgain.iv, sealed.ciphertext + sealed.iv);
});

test("the cipher needs a 32-byte key", () => {
  assert.throws(() => createSecretCipher(""), /OREAD_SECRET_KEY/);
  assert.throws(() => createSecretCipher(Buffer.alloc(16).toString("base64")), /32/);
});

test("saved keys are never returned, only a hint", async () => {
  const settings = createSettingsService({ store: createMemoryStore(), env: {} });
  const view = await settings.patch({ anthropic: { apiKey: "sk-ant-abcdef1234" } });
  assert.equal(view.anthropic.apiKey, undefined);
  assert.deepEqual(view.secrets.anthropic.apiKey, { source: "saved", hint: "…1234" });
  assert.ok(!JSON.stringify(view).includes("sk-ant-abcdef1234"));
});

test("without server keys (hosted mode) nothing falls back to the environment", async () => {
  const serverEnvironment = { ANTHROPIC_API_KEY: "sk-server-key" };
  const local = createSettingsService({ store: createMemoryStore(), env: serverEnvironment });
  assert.equal((await local.providerConfig("anthropic")).apiKey, "sk-server-key");

  const hosted = createSettingsService({ store: createMemoryStore(), env: {} });
  assert.equal((await hosted.providerConfig("anthropic")).apiKey, "");
  assert.deepEqual((await hosted.get()).secrets.anthropic.apiKey, { source: "" });
});

test("private, loopback and link-local addresses are recognised", () => {
  const privateAddresses = [
    "127.0.0.1",
    "10.2.3.4",
    "172.16.0.9",
    "192.168.1.1",
    "169.254.169.254",
  ];
  for (const address of [...privateAddresses, "0.0.0.0", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("::ffff:10.0.0.1"), true);
  for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});

function guardResolvingTo(addressesByHost) {
  const resolveHost = async (hostname) => {
    const addresses = addressesByHost[hostname] ?? [];
    return addresses.map((address) => ({ address }));
  };
  return createOutboundUrlGuard({ resolveHost });
}

test("base URLs must be https and resolve only to public addresses", async () => {
  const guard = guardResolvingTo({
    "api.example.com": ["93.184.216.34"],
    "sneaky.example.com": ["93.184.216.34", "10.0.0.5"],
    "metadata.example.com": ["169.254.169.254"],
  });
  const check = (baseUrl) => guard.checkProviderConfig("openai", { baseUrl });

  assert.deepEqual(await check("https://api.example.com/v1"), {
    baseUrl: "https://api.example.com/v1",
  });
  await assert.rejects(check("http://api.example.com"), { status: 400, message: /https/ });
  await assert.rejects(check("https://sneaky.example.com"), { status: 400, message: /public/ });
  await assert.rejects(check("https://metadata.example.com"), { status: 400 });
  await assert.rejects(check("https://127.0.0.1:4317"), { status: 400 });
  await assert.rejects(check("https://[::1]/"), { status: 400 });
  await assert.rejects(check("https://unknown.example.com"), { status: 400 });
  await assert.rejects(check("not a url"), { status: 400 });
});

test("the Bedrock region must look like an AWS region", async () => {
  const guard = guardResolvingTo({});
  const check = (region) => guard.checkProviderConfig("bedrock", { region });
  await check("us-east-1");
  await check("ap-southeast-2");
  await assert.rejects(check("evil.example.com/x"), { status: 400 });
  await assert.rejects(check("us-east-1.attacker"), { status: 400 });
});

test("the settings service runs the check before a provider config is used", async () => {
  const guard = guardResolvingTo({});
  const settings = createSettingsService({
    store: createMemoryStore(),
    env: {},
    checkProviderConfig: guard.checkProviderConfig,
  });
  await settings.patch({ openai: { baseUrl: "https://169.254.169.254/latest" } });
  await assert.rejects(settings.providerConfig("openai"), { status: 400 });
});

test("hosted mode needs a database, the flag and every hosted setting", () => {
  assert.equal(storageModeFor(loadConfig({})), LOCAL_MODE);
  assert.equal(storageModeFor(loadConfig({ DATABASE_URL: "postgres://x" })), LOCAL_MODE);
  const partial = { DATABASE_URL: "postgres://x", OREAD_MULTI_TENANT: "true" };
  assert.throws(() => storageModeFor(loadConfig(partial)), /OREAD_SECRET_KEY/);
  const complete = {
    ...partial,
    OREAD_SECRET_KEY: TEST_SECRET_KEY,
    BETTER_AUTH_SECRET: "secret",
    RESEND_API_KEY: "re_test",
    OREAD_MAIL_FROM: "Oread <hello@example.com>",
  };
  assert.equal(storageModeFor(loadConfig(complete)), HOSTED_MODE);
});
