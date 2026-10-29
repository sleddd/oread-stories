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
