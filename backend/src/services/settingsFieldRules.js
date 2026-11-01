// Checks for settings fields that aren't plain strings. Each returns the cleaned value or
// throws a 400 naming the field.
import { badRequest } from "../http/errors.js";

const MIN_MAX_TOKENS = 16;
const MAX_MAX_TOKENS = 64000;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_HISTORY_WINDOW = 2;
const MAX_HISTORY_WINDOW = 1000;
const MAX_USER_NAME_LENGTH = 60;
const DEFAULT_USER_NAME = "You";
const MAX_BANNED_PHRASES = 50;
const MAX_BANNED_PHRASE_LENGTH = 120;

function isWholeNumberBetween(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function checkMaxTokens(value) {
  if (!isWholeNumberBetween(value, MIN_MAX_TOKENS, MAX_MAX_TOKENS)) {
    throw badRequest(
      `generation.maxTokens must be a whole number from ${MIN_MAX_TOKENS} to ${MAX_MAX_TOKENS}.`,
      { field: "generation.maxTokens" },
    );
  }
  return value;
}

// Blank (or null) means "use the model's default".
function checkTemperature(value) {
  if (value === "" || value === null) {
    return "";
  }
  const temperature = Number(value);
  const isInRange = temperature >= MIN_TEMPERATURE && temperature <= MAX_TEMPERATURE;
  if (!Number.isFinite(temperature) || !isInRange) {
    throw badRequest(
      "generation.temperature must be blank or a number from " +
        `${MIN_TEMPERATURE} to ${MAX_TEMPERATURE}.`,
      { field: "generation.temperature" },
    );
  }
  return temperature;
}

function checkHistoryWindow(value) {
  if (!isWholeNumberBetween(value, MIN_HISTORY_WINDOW, MAX_HISTORY_WINDOW)) {
    throw badRequest(
      "memory.historyWindow must be a whole number from " +
        `${MIN_HISTORY_WINDOW} to ${MAX_HISTORY_WINDOW}.`,
      { field: "memory.historyWindow" },
    );
  }
  return value;
}

function checkUserName(value) {
  if (typeof value !== "string" || value.length > MAX_USER_NAME_LENGTH) {
    throw badRequest(`user.name must be a string of at most ${MAX_USER_NAME_LENGTH} characters.`, {
      field: "user.name",
    });
  }
  return value.trim() || DEFAULT_USER_NAME;
}

function checkEngineEnabled(value) {
  if (typeof value !== "boolean") {
    throw badRequest("engine.enabled must be true or false.", { field: "engine.enabled" });
  }
  return value;
}

function isTextList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Words and phrases characters must never write. Blank lines are dropped and repeats ignored.
function isAcceptablePhraseList(value) {
  if (!isTextList(value) || value.length > MAX_BANNED_PHRASES) {
    return false;
  }
  return value.every((phrase) => phrase.length <= MAX_BANNED_PHRASE_LENGTH);
}

function checkBannedPhrases(value) {
  if (!isAcceptablePhraseList(value)) {
    throw badRequest(
      `writing.bannedPhrases must be a list of at most ${MAX_BANNED_PHRASES} phrases, ` +
        `each at most ${MAX_BANNED_PHRASE_LENGTH} characters.`,
      { field: "writing.bannedPhrases" },
    );
  }
  const trimmedPhrases = value.map((phrase) => phrase.trim()).filter(Boolean);
  return [...new Set(trimmedPhrases)];
}

export const FIELD_RULES = {
  "generation.maxTokens": checkMaxTokens,
  "generation.temperature": checkTemperature,
  "memory.historyWindow": checkHistoryWindow,
  "user.name": checkUserName,
  "engine.enabled": checkEngineEnabled,
  "writing.bannedPhrases": checkBannedPhrases,
};
