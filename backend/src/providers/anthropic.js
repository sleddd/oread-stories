// Anthropic Messages API adapter.
import { sseEvents } from "./sseEvents.js";
import { normalizeMessages } from "./normalizeMessages.js";
import {
  hasTemperature,
  providerFetch,
  throwResponseError,
  withoutTrailingSlashes,
} from "./providerHttp.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";
const MODEL_PAGE_SIZE = 1000;

function baseUrl(config) {
  return withoutTrailingSlashes(config.baseUrl, DEFAULT_BASE_URL);
}

function requestHeaders(config) {
  if (!config.apiKey) {
    throw new Error("Anthropic API key is not set. Add it in Settings.");
  }
  return {
    "x-api-key": config.apiKey,
    "anthropic-version": API_VERSION,
    "content-type": "application/json",
  };
}

const CACHE_CONTROL = { type: "ephemeral" };

// With a cache hint, the system prompt and the history before the newest message are marked for
// prompt caching; only the newest message (which carries the scene note) is new each turn.
function cachedSystem(system) {
  return [{ type: "text", text: system, cache_control: CACHE_CONTROL }];
}

function withCachedHistory(messages) {
  if (messages.length < 2) {
    return messages;
  }
  const historyEnd = messages.length - 2;
  return messages.map((message, index) => {
    if (index !== historyEnd) {
      return message;
    }
    const content = [{ type: "text", text: message.content, cache_control: CACHE_CONTROL }];
    return { role: message.role, content };
  });
}

export function requestBody(request) {
  const messages = normalizeMessages(request.messages);
  const body = {
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.system,
    messages,
    stream: true,
  };
  if (request.cache) {
    body.system = cachedSystem(request.system);
    body.messages = withCachedHistory(messages);
  }
  if (hasTemperature(request.temperature)) {
    body.temperature = Number(request.temperature);
  }
  return body;
}

// Applies one stream event: returns text to yield (if any) and records usage as it arrives.
function handleStreamEvent(data, usage) {
  if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
    return data.delta.text;
  }
  if (data.type === "message_start") {
    usage.input = data.message?.usage?.input_tokens;
  } else if (data.type === "message_delta") {
    usage.output = data.usage?.output_tokens;
    usage.stop = data.delta?.stop_reason;
  } else if (data.type === "error") {
    throw new Error(`Anthropic: ${data.error?.message || "stream error"}`);
  }
  return null;
}

async function* stream(config, request) {
  const response = await providerFetch(config, `${baseUrl(config)}/v1/messages`, {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(requestBody(request)),
    signal: request.signal,
  });
  if (!response.ok) {
    await throwResponseError(response, "Anthropic");
  }
  const usage = {};
  for await (const event of sseEvents(response.body)) {
    const text = handleStreamEvent(JSON.parse(event.data), usage);
    if (text !== null) {
      yield { text };
    }
  }
  yield { usage };
}

async function listModels(config) {
  const response = await providerFetch(
    config,
    `${baseUrl(config)}/v1/models?limit=${MODEL_PAGE_SIZE}`,
    {
      headers: requestHeaders(config),
    },
  );
  if (!response.ok) {
    await throwResponseError(response, "Anthropic");
  }
  const result = await response.json();
  const models = result.data || [];
  return models.map((model) => ({ id: model.id, label: model.display_name || model.id }));
}

export const anthropic = { stream, listModels };
