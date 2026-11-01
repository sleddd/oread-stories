// The key handling behind each user's encrypted data. A user has one random data key that
// seals all their rows (security/sealedJson.js). It is never stored as it is, only wrapped:
//   - by a key derived from their password,
//   - by a key derived from a recovery code they were shown once,
//   - per signed-in session, by a random key that lives only in that browser's cookie.
// So the database alone opens nothing; it takes the password, the recovery code or a live
// session's cookie. Everything here is pure: storing the wraps is up to the caller.
import { randomBytes } from "node:crypto";
import { createCipherWithKey, KEY_LENGTH_BYTES } from "./secretCipher.js";
import { DEFAULT_KDF_PARAMETERS, deriveKey, newSalt } from "./keyDerivation.js";

const KEY_ENCODING = "base64";
const SESSION_KEY_ENCODING = "base64url";
const RECOVERY_CODE_BYTES = 20;
const RECOVERY_CODE_GROUP_LENGTH = 4;
// Crockford's base32: no I, L, O or U, so the code survives being read aloud or copied by hand.
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BITS_PER_RECOVERY_CHARACTER = 5;
const BITS_PER_BYTE = 8;

function placeFor(userId, purpose) {
  return `${userId}:vault:${purpose}`;
}

export function newDataKey() {
  return randomBytes(KEY_LENGTH_BYTES);
}

function toBase32(bytes) {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(BITS_PER_BYTE, "0");
  }
  let encoded = "";
  for (let start = 0; start < bits.length; start += BITS_PER_RECOVERY_CHARACTER) {
    const chunk = bits.slice(start, start + BITS_PER_RECOVERY_CHARACTER).padEnd(
      BITS_PER_RECOVERY_CHARACTER,
      "0",
    );
    encoded += RECOVERY_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

function groupedForReading(code) {
  const groups = [];
  for (let start = 0; start < code.length; start += RECOVERY_CODE_GROUP_LENGTH) {
    groups.push(code.slice(start, start + RECOVERY_CODE_GROUP_LENGTH));
  }
  return groups.join("-");
}

// A recovery code as it is shown: 32 characters in groups of four.
export function newRecoveryCode() {
  return groupedForReading(toBase32(randomBytes(RECOVERY_CODE_BYTES)));
}

// What a person types back is matched however they spaced or cased it.
export function normalizeRecoveryCode(typedCode) {
  return String(typedCode ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

// A wrap is { salt, cost, blockSize, parallel, iv, authTag, ciphertext }: the data key sealed
// under a key derived from `secret`.
async function wrapDataKey({ dataKey, secret, place }) {
  const parameters = { ...DEFAULT_KDF_PARAMETERS, salt: newSalt() };
  const wrappingKey = await deriveKey(secret, parameters);
  const sealed = createCipherWithKey(wrappingKey).encrypt(dataKey.toString(KEY_ENCODING), place);
  return { ...parameters, ...sealed };
}

// Resolves to the data key, or null when `secret` isn't the one the wrap was made with.
async function unwrapDataKey({ wrap, secret, place }) {
  const wrappingKey = await deriveKey(secret, wrap);
  try {
    const encodedKey = createCipherWithKey(wrappingKey).decrypt(wrap, place);
    return Buffer.from(encodedKey, KEY_ENCODING);
  } catch {
    return null;
  }
}

export function wrapForPassword({ userId, dataKey, password }) {
  return wrapDataKey({ dataKey, secret: password, place: placeFor(userId, "password") });
}

export function unwrapWithPassword({ userId, wrap, password }) {
  return unwrapDataKey({ wrap, secret: password, place: placeFor(userId, "password") });
}

export function wrapForRecoveryCode({ userId, dataKey, recoveryCode }) {
  const secret = normalizeRecoveryCode(recoveryCode);
  return wrapDataKey({ dataKey, secret, place: placeFor(userId, "recovery") });
}

export function unwrapWithRecoveryCode({ userId, wrap, recoveryCode }) {
  const secret = normalizeRecoveryCode(recoveryCode);
  return unwrapDataKey({ wrap, secret, place: placeFor(userId, "recovery") });
}

function sessionPlace(userId, sessionId) {
  return placeFor(userId, `session:${sessionId}`);
}

// For a newly unlocked session: the cookie value (a random key, base64url) and the data key
// sealed under it, which is what the database keeps for that session.
export function sealForSession({ userId, sessionId, dataKey }) {
  const sessionKey = randomBytes(KEY_LENGTH_BYTES);
  const cipher = createCipherWithKey(sessionKey);
  const sealedDataKey = cipher.encrypt(
    dataKey.toString(KEY_ENCODING),
    sessionPlace(userId, sessionId),
  );
  return { cookieValue: sessionKey.toString(SESSION_KEY_ENCODING), sealedDataKey };
}

function sessionKeyFromCookie(cookieValue) {
  const sessionKey = Buffer.from(String(cookieValue ?? ""), SESSION_KEY_ENCODING);
  if (sessionKey.length !== KEY_LENGTH_BYTES) {
    return null;
  }
  return sessionKey;
}

// The data key for a request, or null when the cookie doesn't open this session's copy.
export function openForSession({ userId, sessionId, sealedDataKey, cookieValue }) {
  const sessionKey = sessionKeyFromCookie(cookieValue);
  if (!sessionKey) {
    return null;
  }
  try {
    const cipher = createCipherWithKey(sessionKey);
    const encodedKey = cipher.decrypt(sealedDataKey, sessionPlace(userId, sessionId));
    return Buffer.from(encodedKey, KEY_ENCODING);
  } catch {
    return null;
  }
}

// A value only this session can read (the recovery code waiting to be shown once).
export function sealWithSessionCookie({ userId, sessionId, cookieValue, text }) {
  const cipher = createCipherWithKey(sessionKeyFromCookie(cookieValue));
  return cipher.encrypt(text, sessionPlace(userId, `${sessionId}:note`));
}

export function openWithSessionCookie({ userId, sessionId, cookieValue, sealed }) {
  const sessionKey = sessionKeyFromCookie(cookieValue);
  if (!sessionKey || !sealed) {
    return null;
  }
  try {
    const cipher = createCipherWithKey(sessionKey);
    return cipher.decrypt(sealed, sessionPlace(userId, `${sessionId}:note`));
  } catch {
    return null;
  }
}
