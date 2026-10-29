// Provider credentials and generation settings. Secrets never leave the backend: the public
// view replaces each one with where it came from (saved or environment) and its last four
// characters. Where settings are kept is up to `settingsStore` ({ read, write }): a JSON
// document locally, or a database row plus encrypted secrets when hosted.
import { badRequest } from "../http/errors.js";
import { isObject } from "../http/validate.js";
import {
  DEFAULT_SETTINGS,
  ENVIRONMENT_VARIABLES,
  PROVIDER_IDS,
  SECRET_FIELDS,
} from "./settingsDefaults.js";
import { FIELD_RULES } from "./settingsFieldRules.js";

export { DEFAULT_SETTINGS, PROVIDER_IDS };

const SETTINGS_DOCUMENT = "settings";
const SECRET_HINT_LENGTH = 4;

// Keeps settings in the "settings" document of a JSON store.
export function createDocumentSettingsStore(store) {
  return {
    read: () => store.read(SETTINGS_DOCUMENT),
    write: (settings) => store.write(SETTINGS_DOCUMENT, settings),
  };
}

function acceptProviderConfig(providerName, config) {
  return config;
}

function secretHint(secret) {
  return "…" + secret.slice(-SECRET_HINT_LENGTH);
}

// Saved values for a section, keeping only fields this version still knows.
function knownSavedFields(defaults, savedSection) {
  const knownFields = {};
  for (const [field, value] of Object.entries(savedSection || {})) {
    if (field in defaults) {
      knownFields[field] = value;
    }
  }
  return knownFields;
}

// Secrets: an empty string means "unchanged" and null clears the saved value.
function applySecretField(section, field, fieldPath, value) {
  if (value === null) {
    section[field] = "";
    return;
  }
  if (typeof value !== "string") {
    throw badRequest(`${fieldPath} must be a string, or null to clear it.`, { field: fieldPath });
  }
  if (value.trim()) {
    section[field] = value.trim();
  }
}

function applyField(settings, sectionName, field, value) {
  const fieldPath = `${sectionName}.${field}`;
  if (!(field in DEFAULT_SETTINGS[sectionName])) {
    throw badRequest(`Unknown setting "${fieldPath}".`, { field: fieldPath });
  }
  const section = settings[sectionName];
  if (SECRET_FIELDS[sectionName]?.includes(field)) {
    applySecretField(section, field, fieldPath, value);
    return;
  }
  if (FIELD_RULES[fieldPath]) {
    section[field] = FIELD_RULES[fieldPath](value);
    return;
  }
  if (typeof value !== "string") {
    throw badRequest(`${fieldPath} must be a string.`, { field: fieldPath });
  }
  section[field] = value.trim();
}

function applyProvider(settings, provider) {
  if (!PROVIDER_IDS.includes(provider)) {
    throw badRequest(`provider must be one of ${PROVIDER_IDS.join(", ")}.`, { field: "provider" });
  }
  settings.provider = provider;
}

// Applies a partial update in place, validating every field.
function applyPatch(settings, patch) {
  if (!isObject(patch)) {
    throw badRequest("The settings patch must be an object.");
  }
  for (const [sectionName, sectionPatch] of Object.entries(patch)) {
    if (!(sectionName in DEFAULT_SETTINGS)) {
      throw badRequest(`Unknown setting "${sectionName}".`, { field: sectionName });
    }
    if (sectionName === "provider") {
      applyProvider(settings, sectionPatch);
      continue;
    }
    if (!isObject(sectionPatch)) {
      throw badRequest(`${sectionName} must be an object.`, { field: sectionName });
    }
    for (const [field, value] of Object.entries(sectionPatch)) {
      applyField(settings, sectionName, field, value);
    }
  }
  return settings;
}

// `checkProviderConfig(providerName, config)` may reject a config before it is used for a call
// (hosted mode checks base URLs); by default every config is accepted.
export function createSettingsService({
  store,
  settingsStore = createDocumentSettingsStore(store),
  env = process.env,
  checkProviderConfig = acceptProviderConfig,
}) {
  // The first set environment variable among the given names, or "".
  function environmentValue(variableNames) {
    const values = [].concat(variableNames).map((name) => env[name]);
    return values.find(Boolean) || "";
  }

  // Saved settings over the defaults. Unknown fields from older versions are dropped.
  async function load() {
    const saved = (await settingsStore.read()) || {};
    const settings = {};
    for (const [sectionName, defaults] of Object.entries(DEFAULT_SETTINGS)) {
      if (isObject(defaults)) {
        settings[sectionName] = { ...defaults, ...knownSavedFields(defaults, saved[sectionName]) };
      } else {
        settings[sectionName] = saved[sectionName] ?? defaults;
      }
    }
    if (!PROVIDER_IDS.includes(settings.provider)) {
      settings.provider = DEFAULT_SETTINGS.provider;
    }
    return settings;
  }

  function describeSecret(savedValue, providerName, field) {
    if (savedValue) {
      return { source: "saved", hint: secretHint(savedValue) };
    }
    const variableNames = ENVIRONMENT_VARIABLES[providerName]?.[field] || [];
    const valueFromEnvironment = environmentValue(variableNames);
    if (valueFromEnvironment) {
      return { source: "env", hint: secretHint(valueFromEnvironment) };
    }
    return { source: "" };
  }

  function publicView(settings) {
    const view = structuredClone(settings);
    view.secrets = {};
    for (const [providerName, secretFields] of Object.entries(SECRET_FIELDS)) {
      view.secrets[providerName] = {};
      for (const field of secretFields) {
        const savedValue = settings[providerName][field];
        view.secrets[providerName][field] = describeSecret(savedValue, providerName, field);
        delete view[providerName][field];
      }
    }
    return view;
  }

  async function get() {
    return publicView(await load());
  }

  async function patch(changes) {
    const nextSettings = applyPatch(await load(), changes);
    await settingsStore.write(nextSettings);
    return publicView(nextSettings);
  }

  // Effective config for a provider call: saved values win, environment variables fill the gaps.
  async function providerConfig(providerName) {
    const settings = await load();
    const config = { ...settings[providerName] };
    const variablesByField = ENVIRONMENT_VARIABLES[providerName] || {};
    for (const [field, variableNames] of Object.entries(variablesByField)) {
      if (!config[field]) {
        config[field] = environmentValue(variableNames);
      }
    }
    return checkProviderConfig(providerName, config);
  }

  return { load, get, patch, providerConfig };
}
