// The sign-up allowlist: exact addresses and whole domains, capitals and spaces ignored, and an
// empty or missing list letting nobody in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSignUpAllowlist, isAllowedToSignUp } from "../src/auth/signUpAllowlist.js";
import { loadConfig } from "../src/config.js";

test("lets in listed addresses and whole domains, ignoring capitals and spaces", () => {
  const allowlist = parseSignUpAllowlist(" Ana@Example.com , @MinnowPress.com,, ");
  assert.equal(isAllowedToSignUp(allowlist, "ana@example.com"), true);
  assert.equal(isAllowedToSignUp(allowlist, "  ANA@EXAMPLE.COM "), true);
  assert.equal(isAllowedToSignUp(allowlist, "anyone@minnowpress.com"), true);
});

test("turns away everyone else", () => {
  const allowlist = parseSignUpAllowlist("ana@example.com, @minnowpress.com");
  assert.equal(isAllowedToSignUp(allowlist, "bo@example.com"), false);
  assert.equal(isAllowedToSignUp(allowlist, "ana@example.com.evil.test"), false);
  assert.equal(isAllowedToSignUp(allowlist, "someone@notminnowpress.com"), false);
  assert.equal(isAllowedToSignUp(allowlist, "@minnowpress.com"), false);
  assert.equal(isAllowedToSignUp(allowlist, ""), false);
  assert.equal(isAllowedToSignUp(allowlist, undefined), false);
});

test("an empty or missing list lets nobody sign up", () => {
  for (const setting of ["", "  ,  ", undefined]) {
    const allowlist = parseSignUpAllowlist(setting);
    assert.equal(isAllowedToSignUp(allowlist, "ana@example.com"), false);
  }
  const config = loadConfig({});
  assert.equal(isAllowedToSignUp(config.signUpAllowlist, "ana@example.com"), false);
});

test("the list comes from OREAD_SIGNUP_ALLOWLIST", () => {
  const config = loadConfig({ OREAD_SIGNUP_ALLOWLIST: "ana@example.com" });
  assert.equal(isAllowedToSignUp(config.signUpAllowlist, "ana@example.com"), true);
});
