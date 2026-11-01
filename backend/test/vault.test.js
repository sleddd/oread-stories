// Each user's encryption: the key wraps (password, recovery code, session cookie), sealed rows,
// and the vault service's unlock, recovery and starting over, with an in-memory vault store.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newDataKey,
  newRecoveryCode,
  normalizeRecoveryCode,
  wrapForPassword,
  unwrapWithPassword,
  wrapForRecoveryCode,
  unwrapWithRecoveryCode,
  sealForSession,
  openForSession,
} from "../src/security/userVault.js";
import { createSealer, isSealed } from "../src/security/sealedJson.js";
import {
  createVaultService,
  UNLOCKED,
  LOCKED,
  NEEDS_RECOVERY,
} from "../src/services/vaultService.js";
import { memoryVaultStore } from "./vaultHelpers.js";

const PASSWORD = "correct horse battery";

test("the data key opens only with the password or recovery code it was wrapped with", async () => {
  const dataKey = newDataKey();
  const passwordWrap = await wrapForPassword({ userId: "ada", dataKey, password: PASSWORD });
  const opened = await unwrapWithPassword({
    userId: "ada",
    wrap: passwordWrap,
    password: PASSWORD,
  });
  assert.ok(opened.equals(dataKey));
  assert.equal(
    await unwrapWithPassword({ userId: "ada", wrap: passwordWrap, password: "wrong password" }),
    null,
  );
  assert.equal(
    await unwrapWithPassword({ userId: "bea", wrap: passwordWrap, password: PASSWORD }),
    null,
    "a wrap copied to another account doesn't open",
  );

  const recoveryCode = newRecoveryCode();
  assert.match(recoveryCode, /^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
  const recoveryWrap = await wrapForRecoveryCode({ userId: "ada", dataKey, recoveryCode });
  const typedLoosely = ` ${recoveryCode.toLowerCase().replaceAll("-", " ")} `;
  const recovered = await unwrapWithRecoveryCode({
    userId: "ada",
    wrap: recoveryWrap,
    recoveryCode: typedLoosely,
  });
  assert.ok(recovered.equals(dataKey));
  assert.equal(normalizeRecoveryCode("ab-cd ef"), "ABCDEF");
});

test("a session's copy of the data key opens only with that session's cookie", () => {
  const dataKey = newDataKey();
  const sealedForSession = sealForSession({ userId: "ada", sessionId: "s1", dataKey });
  const { cookieValue, sealedDataKey } = sealedForSession;
  const opened = openForSession({ userId: "ada", sessionId: "s1", sealedDataKey, cookieValue });
  assert.ok(opened.equals(dataKey));
  const otherCookie = sealForSession({ userId: "ada", sessionId: "s1", dataKey }).cookieValue;
  assert.equal(
    openForSession({ userId: "ada", sessionId: "s1", sealedDataKey, cookieValue: otherCookie }),
    null,
  );
  assert.equal(
    openForSession({ userId: "ada", sessionId: "s2", sealedDataKey, cookieValue }),
    null,
    "a copy moved to another session doesn't open",
  );
  assert.equal(
    openForSession({ userId: "ada", sessionId: "s1", sealedDataKey, cookieValue: "junk" }),
    null,
  );
});

test("sealed rows open only in their own place, and plain rows pass through", () => {
  const sealer = createSealer({ userId: "ada", dataKey: newDataKey() });
  const story = { id: "s1", title: "The Flood", memory: ["Jenny calls me Opy."] };
  const sealed = sealer.seal(story, "story:s1");
  assert.ok(isSealed(sealed));
  assert.ok(!JSON.stringify(sealed).includes("Flood"), "no plain text in the sealed row");
  assert.deepEqual(sealer.open(sealed, "story:s1"), story);
  assert.throws(() => sealer.open(sealed, "story:s2"));
  const otherUser = createSealer({ userId: "bea", dataKey: newDataKey() });
  assert.throws(() => otherUser.open(sealed, "story:s1"));
  assert.deepEqual(sealer.open(story, "story:s1"), story, "rows from before sealing still read");
});

test("the first unlock makes a vault, seals the account, shows a recovery code once", async () => {
  const vaultStore = memoryVaultStore();
  const vault = createVaultService({ vaultStore });
  const who = { userId: "ada", sessionId: "s1" };

  assert.equal((await vault.status({ ...who, cookieValue: null })).state, LOCKED);
  const opened = await vault.openWithPassword({ ...who, password: PASSWORD });
  assert.equal(opened.state, UNLOCKED);
  assert.ok(vaultStore.record.sealedWith, "existing rows were sealed with the new key");

  const dataKey = await vault.dataKeyFor({ ...who, cookieValue: opened.cookieValue });
  assert.equal(dataKey.length, 32);
  const firstStatus = await vault.status({ ...who, cookieValue: opened.cookieValue });
  assert.match(firstStatus.recoveryCode, /^[0-9A-Z-]+$/);
  await vault.markRecoveryCodeSaved(who);
  const laterStatus = await vault.status({ ...who, cookieValue: opened.cookieValue });
  assert.deepEqual(laterStatus, { state: UNLOCKED, recoveryCode: null });

  const nextSession = await vault.openWithPassword({
    userId: "ada",
    sessionId: "s2",
    password: PASSWORD,
  });
  const sameKey = await vault.dataKeyFor({
    userId: "ada",
    sessionId: "s2",
    cookieValue: nextSession.cookieValue,
  });
  assert.ok(sameKey.equals(dataKey), "every session opens the same data key");
  assert.equal(
    await vault.dataKeyFor({ userId: "bea", sessionId: "s1", cookieValue: opened.cookieValue }),
    null,
    "another user can't use this session's copy",
  );
});

test("after a password reset the recovery code brings the data back", async () => {
  const vaultStore = memoryVaultStore();
  const vault = createVaultService({ vaultStore });
  const first = await vault.openWithPassword({
    userId: "ada",
    sessionId: "s1",
    password: PASSWORD,
  });
  const dataKey = await vault.dataKeyFor({
    userId: "ada",
    sessionId: "s1",
    cookieValue: first.cookieValue,
  });
  const { recoveryCode } = await vault.status({
    userId: "ada",
    sessionId: "s1",
    cookieValue: first.cookieValue,
  });

  const afterReset = { userId: "ada", sessionId: "s2" };
  const tried = await vault.openWithPassword({ ...afterReset, password: "a brand new password" });
  assert.equal(tried.state, NEEDS_RECOVERY);
  assert.equal(tried.cookieValue, null);

  await assert.rejects(
    vault.recover({ ...afterReset, password: "a brand new password", recoveryCode: "WRONG" }),
    { status: 400 },
  );
  const cookieValue = await vault.recover({
    ...afterReset,
    password: "a brand new password",
    recoveryCode,
  });
  const recoveredKey = await vault.dataKeyFor({ ...afterReset, cookieValue });
  assert.ok(recoveredKey.equals(dataKey));
  const newStatus = await vault.status({ ...afterReset, cookieValue });
  assert.notEqual(newStatus.recoveryCode, recoveryCode, "the used code is replaced");

  const again = await vault.openWithPassword({
    userId: "ada",
    sessionId: "s3",
    password: "a brand new password",
  });
  assert.equal(again.state, UNLOCKED, "the new password now opens the vault");
});

test("starting over erases the account's data and begins a new vault", async () => {
  const vaultStore = memoryVaultStore();
  const vault = createVaultService({ vaultStore });
  await vault.openWithPassword({ userId: "ada", sessionId: "s1", password: PASSWORD });
  const cookieValue = await vault.startOver({
    userId: "ada",
    sessionId: "s2",
    password: "new password here",
  });
  assert.deepEqual(vaultStore.record.erasedFor, ["ada"]);
  assert.ok(await vault.dataKeyFor({ userId: "ada", sessionId: "s2", cookieValue }));
});

test("a password change and a new recovery code keep the same data key", async () => {
  const vaultStore = memoryVaultStore();
  const vault = createVaultService({ vaultStore });
  const who = { userId: "ada", sessionId: "s1" };
  const { cookieValue } = await vault.openWithPassword({ ...who, password: PASSWORD });
  const dataKey = await vault.dataKeyFor({ ...who, cookieValue });

  await assert.rejects(
    vault.replaceRecoveryCode({ ...who, cookieValue, password: "not it" }),
    { status: 400 },
  );
  const recoveryCode = await vault.replaceRecoveryCode({ ...who, cookieValue, password: PASSWORD });
  const recovered = await unwrapWithRecoveryCode({
    userId: "ada",
    wrap: vaultStore.vaults.get("ada").recoveryWrap,
    recoveryCode,
  });
  assert.ok(recovered.equals(dataKey));

  const changed = await vault.changePassword({
    userId: "ada",
    currentPassword: PASSWORD,
    newPassword: "my changed password",
  });
  assert.equal(changed, true);
  const reopened = await vault.openWithPassword({
    userId: "ada",
    sessionId: "s2",
    password: "my changed password",
  });
  assert.equal(reopened.state, UNLOCKED);
  const carried = await vault.carryOverUnlock({
    userId: "ada",
    fromSessionId: "s1",
    toSessionId: "s3",
    cookieValue,
  });
  const carriedKey = await vault.dataKeyFor({
    userId: "ada",
    sessionId: "s3",
    cookieValue: carried,
  });
  assert.ok(carriedKey.equals(dataKey));
});
