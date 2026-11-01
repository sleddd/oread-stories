// AES-256-GCM encryption for values at rest. Each value is bound to where it is stored (the
// "context", e.g. "user-1:anthropic:apiKey") as additional authenticated data, so a ciphertext
// copied into another user's row or another field fails to decrypt. The server's own key
// (OREAD_SECRET_KEY) and each user's data key (security/userVault.js) both use it.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
export const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const ENCODING = "base64";

function keyFromBase64(base64Key) {
  const key = Buffer.from(base64Key ?? "", ENCODING);
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `OREAD_SECRET_KEY must be ${KEY_LENGTH_BYTES} random bytes, base64-encoded ` +
        "(for example: openssl rand -base64 32).",
    );
  }
  return key;
}

// Returns { encrypt(plaintext, context), decrypt(sealed, context) }, where sealed is
// { ciphertext, iv, authTag }, all base64.
export function createSecretCipher(base64Key) {
  return createCipherWithKey(keyFromBase64(base64Key));
}

// The same cipher for a key that is already 32 raw bytes, such as a user's data key.
export function createCipherWithKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`A cipher key must be ${KEY_LENGTH_BYTES} bytes.`);
  }

  function encrypt(plaintext, context) {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      ciphertext: ciphertext.toString(ENCODING),
      iv: iv.toString(ENCODING),
      authTag: cipher.getAuthTag().toString(ENCODING),
    };
  }

  function decrypt(sealed, context) {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, ENCODING));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(sealed.authTag, ENCODING));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, ENCODING)),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  return { encrypt, decrypt };
}
