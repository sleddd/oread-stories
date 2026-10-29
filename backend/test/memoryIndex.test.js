// Meaning search over memory entries, with a fake embedder standing in for the local model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../src/storage/memoryStore.js";
import { createMemoryIndex, hashText } from "../src/memory/memoryIndex.js";
import { cosineSimilarity } from "../src/memory/vectorMath.js";
import { fakeEmbedder } from "./storyHelpers.js";

function entry(id, text) {
  return { id, kind: "event", text };
}

test("cosine similarity is 1 for the same direction and 0 for unrelated or empty vectors", () => {
  assert.equal(cosineSimilarity([1, 2], [2, 4]).toFixed(6), "1.000000");
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test("search ranks entries by meaning and saves their embeddings", async () => {
  const store = createMemoryStore();
  const embedder = fakeEmbedder();
  const index = createMemoryIndex({ store, embedder });
  const entries = [
    entry("m1", "The barn burned down in the fire"),
    entry("m2", "Jenny calls me Opy"),
  ];

  const results = await index.search({ entries, query: "the night of the fire", limit: 5 });

  assert.equal(results[0].entry.id, "m1");
  assert.ok(results[0].score > results[1].score);
  const saved = store.snapshot().memoryIndex;
  assert.equal(saved.m1.textHash, hashText("The barn burned down in the fire"));
  assert.equal(saved.m2.vector.length, embedder.dimensions);
});

test("unchanged entries are not embedded again; edited entries are", async () => {
  const store = createMemoryStore();
  const embedder = fakeEmbedder();
  const index = createMemoryIndex({ store, embedder });
  const entries = [entry("m1", "The barn burned down"), entry("m2", "Jenny calls me Opy")];

  await index.search({ entries, query: "fire", limit: 1 });
  embedder.embeddedTexts.length = 0;
  await index.search({ entries, query: "fire", limit: 1 });
  assert.deepEqual(embedder.embeddedTexts, ["fire"]);

  embedder.embeddedTexts.length = 0;
  const edited = [entry("m1", "The barn burned to the ground"), entries[1]];
  await index.search({ entries: edited, query: "fire", limit: 1 });
  assert.deepEqual(embedder.embeddedTexts, ["The barn burned to the ground", "fire"]);
});

test("forget drops embeddings, and the limit is respected", async () => {
  const store = createMemoryStore();
  const index = createMemoryIndex({ store, embedder: fakeEmbedder() });
  const entries = [entry("m1", "one"), entry("m2", "two"), entry("m3", "three")];
  assert.equal((await index.search({ entries, query: "two", limit: 2 })).length, 2);

  await index.forget(["m2"]);
  assert.deepEqual(Object.keys(store.snapshot().memoryIndex).sort(), ["m1", "m3"]);
});

test("without an embedder the index reports itself unavailable", () => {
  const index = createMemoryIndex({ store: createMemoryStore() });
  assert.equal(index.isAvailable(), false);
});
