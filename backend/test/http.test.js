// The HTTP building blocks: router, JSON body reading, error bodies and validators.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { Router } from "../src/http/router.js";
import { readJson } from "../src/http/request.js";
import { HttpError, errorBody, badRequest } from "../src/http/errors.js";
import { requireString, optionalNumber, optionalInteger } from "../src/http/validate.js";

// A readable stream that looks enough like an incoming request for readJson.
function fakeRequest(body, contentType = "application/json") {
  let chunks = [];
  if (body) {
    chunks = [Buffer.from(body)];
  }
  const request = Readable.from(chunks);
  request.headers = { "content-type": contentType };
  return request;
}

function hasStatus(status) {
  return (error) => error.status === status;
}

test("router matches methods and decodes path params", () => {
  const router = new Router()
    .get("/chats/:chatId", () => "get")
    .delete("/chats/:chatId", () => "del");
  const match = router.match("GET", "/chats/a%20b");
  assert.equal(match.handler(), "get");
  assert.deepEqual(match.params, { chatId: "a b" });
  assert.equal(router.match("DELETE", "/chats/x/").handler(), "del");
});

test("router reports allowed methods for a known path with the wrong method", () => {
  const router = new Router().get("/lore", () => 1);
  assert.deepEqual(router.match("POST", "/lore"), { allowed: ["GET"] });
  assert.deepEqual(router.match("GET", "/nope"), { allowed: [] });
});

test("readJson parses JSON and treats an empty body as {}", async () => {
  assert.deepEqual(await readJson(fakeRequest('{"a":1}')), { a: 1 });
  assert.deepEqual(await readJson(fakeRequest("")), {});
});

test("readJson rejects bad JSON, the wrong content type and oversized bodies", async () => {
  await assert.rejects(readJson(fakeRequest("{nope")), hasStatus(400));
  await assert.rejects(readJson(fakeRequest('{"a":1}', "text/plain")), hasStatus(415));
  const oversizedBody = '{"a":"' + "x".repeat(50) + '"}';
  await assert.rejects(readJson(fakeRequest(oversizedBody), { limit: 10 }), hasStatus(413));
});

test("errorBody exposes HttpErrors and hides unexpected errors", () => {
  assert.deepEqual(errorBody(badRequest("Nope.", { field: "x" })), {
    error: { code: "bad_request", message: "Nope.", details: { field: "x" } },
  });
  assert.deepEqual(errorBody(new Error("secret stack detail")), {
    error: { code: "internal_error", message: "Something went wrong on the server." },
  });
  assert.ok(new HttpError(418, "teapot", "x") instanceof Error);
});

test("validators name the failing field", () => {
  const namesTitle = (error) => error.details.field === "title";
  assert.throws(() => requireString(undefined, "title"), namesTitle);
  assert.throws(() => requireString("  ", "content", { allowEmpty: false }), /can't be empty/);
  assert.throws(() => optionalNumber("3", "n"), /must be a number/);
  assert.throws(() => optionalInteger(1.5, "alt"), /whole number/);
  assert.equal(optionalNumber(undefined, "n"), undefined);
});
