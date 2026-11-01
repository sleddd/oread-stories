// Turns a password or recovery code into a 32-byte key with scrypt. The parameters are stored
// next to whatever the key wraps, so they can be raised later without locking anyone out: an
// old wrap still opens with the parameters it was made with.
import { randomBytes, scrypt } from "node:crypto";
import { KEY_LENGTH_BYTES } from "./secretCipher.js";

const SALT_LENGTH_BYTES = 16;
const ENCODING = "base64";

// About 32 MB and a few tenths of a second per derivation: slow for someone guessing, fine for
// a person signing in.
export const DEFAULT_KDF_PARAMETERS = Object.freeze({ cost: 2 ** 15, blockSize: 8, parallel: 1 });
const MEMORY_HEADROOM_FACTOR = 2;

function scryptMemoryLimit({ cost, blockSize }) {
  return 128 * cost * blockSize * MEMORY_HEADROOM_FACTOR;
}

export function newSalt() {
  return randomBytes(SALT_LENGTH_BYTES).toString(ENCODING);
}

// parameters: { salt (base64), cost, blockSize, parallel }. Resolves to a Buffer.
export function deriveKey(secret, parameters) {
  const options = {
    N: parameters.cost,
    r: parameters.blockSize,
    p: parameters.parallel,
    maxmem: scryptMemoryLimit(parameters),
  };
  const salt = Buffer.from(parameters.salt, ENCODING);
  return new Promise((resolve, reject) => {
    scrypt(String(secret).normalize("NFKC"), salt, KEY_LENGTH_BYTES, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}
