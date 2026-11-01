// Seals a user's stored JSON (a story, a chat, settings, a memory vector) with their data key,
// and opens it again. A sealed value is { sealed: 1, iv, authTag, ciphertext }, and the place it
// is stored ("story:my-story") is bound in as authenticated data, so a sealed row moved onto
// another row, or another user's, fails to open. Rows written before encryption are plain JSON;
// open() hands those back as they are, so an account part-way through being sealed still reads.
import { createCipherWithKey } from "./secretCipher.js";

const SEALED_VERSION = 1;

export function isSealed(stored) {
  return stored !== null && typeof stored === "object" && stored.sealed === SEALED_VERSION;
}

// `dataKey` is the user's 32-byte data key; every context is prefixed with their id.
export function createSealer({ userId, dataKey }) {
  const cipher = createCipherWithKey(dataKey);

  function contextFor(place) {
    return `${userId}:${place}`;
  }

  function seal(value, place) {
    const sealedParts = cipher.encrypt(JSON.stringify(value), contextFor(place));
    return { sealed: SEALED_VERSION, ...sealedParts };
  }

  function open(stored, place) {
    if (!isSealed(stored)) {
      return stored;
    }
    return JSON.parse(cipher.decrypt(stored, contextFor(place)));
  }

  return { seal, open, cipher };
}
