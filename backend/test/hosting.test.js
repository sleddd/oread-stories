// Hosting: the server handing out the built interface (one address for the app and its API), and
// the heartbeat that keeps a slow reply's stream open behind a proxy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { makeApp, listen } from "./helpers.js";
import { createStaticFileHandler } from "../src/http/staticFiles.js";
import { runEventStream, streamResult, HEARTBEAT_EVENT } from "../src/http/eventStream.js";

const INDEX_HTML = "<!doctype html><title>Oread</title>";
const ASSET_JS = "console.log('oread');";

let builtInterface;
let server;
let origin;

before(async () => {
  builtInterface = await mkdtemp(path.join(tmpdir(), "oread-dist-"));
  await mkdir(path.join(builtInterface, "assets"));
  await writeFile(path.join(builtInterface, "index.html"), INDEX_HTML);
  await writeFile(path.join(builtInterface, "assets", "index-abc123.js"), ASSET_JS);
  await writeFile(path.join(builtInterface, "favicon-64.png"), "png");
  const { app } = makeApp({ staticFiles: createStaticFileHandler(builtInterface) });
  server = await listen(app);
  origin = server.base.replace("/api/v1", "");
});

after(async () => {
  server.close();
  await rm(builtInterface, { recursive: true, force: true });
});

test("the app's pages, including ones that aren't files, get the interface", async () => {
  for (const pagePath of ["/", "/reset-password"]) {
    const response = await fetch(origin + pagePath);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), INDEX_HTML);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  }
});

test("built assets are served with a type and cached for good", async () => {
  const response = await fetch(origin + "/assets/index-abc123.js");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), ASSET_JS);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.match(response.headers.get("cache-control"), /immutable/);
  const icon = await fetch(origin + "/favicon-64.png");
  assert.equal(icon.headers.get("content-type"), "image/png");
});

test("a missing file is a 404, and nothing outside the folder can be reached", async () => {
  assert.equal((await fetch(origin + "/assets/missing.js")).status, 404);
  const escape = await fetch(origin + "/..%2f..%2fpackage.json");
  assert.notEqual(
    await escape.text(),
    await import("node:fs").then((fs) => fs.readFileSync("package.json", "utf8")),
  );
});

test("the API still answers under /api/v1", async () => {
  const response = await fetch(server.base + "/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

function fakeResponse() {
  const written = [];
  return {
    written,
    writableEnded: false,
    destroyed: false,
    writeHead() {},
    write(chunk) {
      written.push(JSON.parse(chunk));
    },
    end() {
      this.writableEnded = true;
    },
    on() {},
  };
}

test("a slow reply's stream sends heartbeats while it waits, and stops when it ends", async () => {
  const response = fakeResponse();
  const slowReply = streamResult(async function* () {
    yield { type: "start" };
    await new Promise((resolve) => setTimeout(resolve, 60));
    yield { type: "done" };
  });
  await runEventStream(response, slowReply, console, 15);
  const types = response.written.map((event) => event.type);
  assert.equal(types[0], "start");
  assert.equal(types.at(-1), "done");
  assert.ok(types.filter((type) => type === HEARTBEAT_EVENT.type).length >= 2);
  const countAtEnd = response.written.length;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(response.written.length, countAtEnd);
});
