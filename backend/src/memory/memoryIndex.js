// Meaning search over memory entries. Each entry's embedding is kept with a hash of the text it
// was made from; when the text changes (a rewrite by the character or an edit by the user) the
// hash no longer matches and the entry is embedded again.
//
// Where vectors live is up to `vectorStore`: { read(entryIds), save(vectorsById),
// remove(entryIds) }, with vectorsById = { [entryId]: { textHash, vector } }. Locally that is
// the "memoryIndex" document; hosted, one database row per entry.
import { createHash } from "node:crypto";
import { cosineSimilarity } from "./vectorMath.js";

const MEMORY_INDEX_DOCUMENT = "memoryIndex";

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

// Keeps every vector in the "memoryIndex" document of a JSON store.
export function createDocumentVectorStore(store) {
  async function read(entryIds) {
    const index = (await store.read(MEMORY_INDEX_DOCUMENT, {})) || {};
    const vectorsById = {};
    for (const entryId of entryIds) {
      if (index[entryId]) {
        vectorsById[entryId] = index[entryId];
      }
    }
    return vectorsById;
  }

  async function save(vectorsById) {
    await store.update(MEMORY_INDEX_DOCUMENT, {}, (index) => ({ ...index, ...vectorsById }));
  }

  async function remove(entryIds) {
    await store.update(MEMORY_INDEX_DOCUMENT, {}, (index) => {
      for (const entryId of entryIds) {
        delete index[entryId];
      }
      return index;
    });
  }

  return { read, save, remove };
}

function entriesNeedingEmbedding(index, entries) {
  return entries.filter((entry) => index[entry.id]?.textHash !== hashText(entry.text));
}

function rankByScore(first, second) {
  return second.score - first.score;
}

// `embedder` has embed(texts) → vectors. Without one, search is unavailable.
export function createMemoryIndex({
  store,
  vectorStore = createDocumentVectorStore(store),
  embedder,
}) {
  function isAvailable() {
    return Boolean(embedder);
  }

  // Embeds any entries that are new or changed and saves them. Returns the vectors of the
  // given entries, by entry id.
  async function refresh(entries) {
    const index = await vectorStore.read(entries.map((entry) => entry.id));
    const staleEntries = entriesNeedingEmbedding(index, entries);
    if (staleEntries.length === 0) {
      return index;
    }
    const vectors = await embedder.embed(staleEntries.map((entry) => entry.text));
    const freshVectors = {};
    staleEntries.forEach((entry, position) => {
      freshVectors[entry.id] = { textHash: hashText(entry.text), vector: vectors[position] };
    });
    await vectorStore.save(freshVectors);
    return { ...index, ...freshVectors };
  }

  // Returns [{ entry, score }], most similar first.
  async function search({ entries, query, limit }) {
    if (entries.length === 0) {
      return [];
    }
    const index = await refresh(entries);
    const [queryVector] = await embedder.embed([query]);
    const scored = entries.map((entry) => ({
      entry,
      score: cosineSimilarity(queryVector, index[entry.id].vector),
    }));
    return scored.sort(rankByScore).slice(0, limit);
  }

  // Drops the embeddings of entries that no longer exist.
  async function forget(entryIds) {
    if (entryIds.length === 0) {
      return;
    }
    await vectorStore.remove(entryIds);
  }

  return { isAvailable, refresh, search, forget };
}
