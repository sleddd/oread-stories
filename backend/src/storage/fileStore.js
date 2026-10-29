// Named JSON documents on disk, one <name>.json per document. Writes are atomic
// (temp file + rename), and update() runs read-modify-write under a lock so concurrent
// requests can't lose each other's changes.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { createWriteLock } from "./writeLock.js";

const JSON_INDENT = 2;

export function createFileStore(directory) {
  // Parsed documents by name; undefined marks a document known not to exist on disk.
  const cache = new Map();
  const runExclusively = createWriteLock();

  function filePathFor(name) {
    return path.join(directory, `${name}.json`);
  }

  async function readFromDisk(name) {
    try {
      return JSON.parse(await readFile(filePathFor(name), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      return undefined;
    }
  }

  async function load(name) {
    if (!cache.has(name)) {
      cache.set(name, await readFromDisk(name));
    }
    return cache.get(name);
  }

  async function save(name, value) {
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${filePathFor(name)}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(value, null, JSON_INDENT));
    await rename(temporaryPath, filePathFor(name));
    cache.set(name, structuredClone(value));
  }

  async function read(name, fallback = null) {
    const value = await load(name);
    if (value === undefined) {
      return fallback;
    }
    return structuredClone(value);
  }

  function write(name, value) {
    return runExclusively(() => save(name, value));
  }

  function update(name, fallback, applyChange) {
    return runExclusively(async () => {
      const current = await load(name);
      let startingValue = structuredClone(current);
      if (current === undefined) {
        startingValue = structuredClone(fallback);
      }
      const nextValue = await applyChange(startingValue);
      await save(name, nextValue);
      return structuredClone(nextValue);
    });
  }

  return { read, write, update };
}
