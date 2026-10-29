// Shared test fixtures: the real lorebook, an in-memory store and a scripted fake provider.
import http from "node:http";
import { loadLore } from "../src/lore/loadLore.js";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createApp } from "../src/app.js";

export const lore = loadLore();

const CLOCK_STEP_MILLISECONDS = 1000;

function abortError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

// A provider whose replies are scripted per test. Each call records the request it received.
// A chunk can be a function, which runs (and is awaited) instead of yielding text.
export function fakeProvider({
  chunks = ["Hello", " there."],
  usage = { input: 12, output: 3, stop: "end_turn" },
  fail,
  models = [{ id: "fake-1", label: "Fake 1" }],
} = {}) {
  const calls = [];
  return {
    calls,
    async *stream(config, request) {
      calls.push({ config, request });
      if (fail) {
        throw new Error(fail);
      }
      for (const chunk of chunks) {
        if (request.signal?.aborted) {
          throw abortError();
        }
        if (typeof chunk === "function") {
          await chunk(request);
        } else {
          yield { text: chunk };
        }
      }
      yield { usage };
    },
    async listModels() {
      return models;
    },
  };
}

// Returns a function producing "<prefix>1", "<prefix>2", ...
export function sequence(prefix = "id") {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${counter}`;
  };
}

// Returns a clock that moves forward one second each time it is read.
export function clock(start = 1_000_000) {
  let currentTime = start;
  return () => {
    currentTime += CLOCK_STEP_MILLISECONDS;
    return currentTime;
  };
}

export function makeApp({
  provider = fakeProvider(),
  store = createMemoryStore(),
  env = {},
  ...rest
} = {}) {
  const app = createApp({
    lore,
    store,
    providers: { anthropic: provider, openai: provider, gemini: provider, bedrock: provider },
    env,
    corsOrigins: ["http://127.0.0.1:5173"],
    logger: { error() {} },
    newId: sequence(),
    now: clock(),
    ...rest,
  });
  return { app, store, provider, services: app.services };
}

// Starts the app on a free port; returns the API base URL and a close function.
export async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  function close() {
    return new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    });
  }
  return { base, close };
}

export async function readNdjson(response) {
  const text = await response.text();
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

// Collects every event from an async iterable into an array.
export async function drain(events) {
  const collected = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}
