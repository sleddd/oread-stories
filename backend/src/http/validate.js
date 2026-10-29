// Input checks for request bodies. Each throws a 400 naming the field that failed.
import { badRequest } from "./errors.js";

const DEFAULT_MAX_STRING_LENGTH = 10_000;

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function requireObject(value, field = "body") {
  if (!isObject(value)) {
    throw badRequest(`${field} must be an object.`, { field });
  }
  return value;
}

export function optionalString(
  value,
  field,
  { max = DEFAULT_MAX_STRING_LENGTH, allowEmpty = true } = {},
) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string.`, { field });
  }
  if (!allowEmpty && !value.trim()) {
    throw badRequest(`${field} can't be empty.`, { field });
  }
  if (value.length > max) {
    throw badRequest(`${field} must be at most ${max} characters.`, { field });
  }
  return value;
}

export function requireString(value, field, options) {
  if (value === undefined) {
    throw badRequest(`${field} is required.`, { field });
  }
  return optionalString(value, field, options);
}

export function optionalNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw badRequest(`${field} must be a number.`, { field });
  }
  if (value < min || value > max) {
    throw badRequest(`${field} must be between ${min} and ${max}.`, { field });
  }
  return value;
}

export function optionalInteger(value, field, options) {
  const number = optionalNumber(value, field, options);
  if (number !== undefined && !Number.isInteger(number)) {
    throw badRequest(`${field} must be a whole number.`, { field });
  }
  return number;
}

export function optionalBoolean(value, field) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw badRequest(`${field} must be true or false.`, { field });
  }
  return value;
}

// A list of short strings: each is trimmed, empty ones are dropped and duplicates removed.
export function optionalStringList(value, field, { maxItems, maxLength }) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be a list of strings.`, { field });
  }
  if (value.length > maxItems) {
    throw badRequest(`${field} can hold at most ${maxItems} items.`, { field });
  }
  const cleanedItems = value.map((item, index) => {
    const itemField = `${field}[${index}]`;
    return optionalString(item, itemField, { max: maxLength }) ?? "";
  });
  const trimmedItems = cleanedItems.map((item) => item.trim());
  return [...new Set(trimmedItems.filter(Boolean))];
}

export function rejectUnknownFields(body, knownFields) {
  for (const field of Object.keys(body)) {
    if (!knownFields.includes(field)) {
      throw badRequest(`Unknown field "${field}".`, { field });
    }
  }
}

// Throws unless at least one of the named fields is present.
export function requireSomeField(body, fields) {
  const hasAny = fields.some((field) => body[field] !== undefined);
  if (!hasAny) {
    throw badRequest(`Send at least one of: ${fields.join(", ")}.`);
  }
}

// Drops the fields an optional reader returned undefined for.
export function withoutMissingFields(fields) {
  const presentFields = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) {
      presentFields[field] = value;
    }
  }
  return presentFields;
}
