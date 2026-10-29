// An in-memory store with the same interface as the file store, used by tests.
import { createWriteLock } from "./writeLock.js";

export function createMemoryStore(initialDocuments = {}) {
  const documents = new Map(Object.entries(structuredClone(initialDocuments)));
  const runExclusively = createWriteLock();

  function currentOrFallback(name, fallback) {
    if (documents.has(name)) {
      return documents.get(name);
    }
    return fallback;
  }

  async function read(name, fallback = null) {
    if (documents.has(name)) {
      return structuredClone(documents.get(name));
    }
    return fallback;
  }

  function write(name, value) {
    return runExclusively(async () => {
      documents.set(name, structuredClone(value));
    });
  }

  function update(name, fallback, applyChange) {
    return runExclusively(async () => {
      const nextValue = await applyChange(structuredClone(currentOrFallback(name, fallback)));
      documents.set(name, structuredClone(nextValue));
      return structuredClone(nextValue);
    });
  }

  function snapshot() {
    return structuredClone(Object.fromEntries(documents));
  }

  return { read, write, update, snapshot };
}
