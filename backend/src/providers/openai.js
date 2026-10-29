// OpenAI Chat Completions adapter. Also works with OpenAI-compatible servers via a base URL.
import { sseEvents } from "./sseEvents.js";
import { normalizeMessages } from "./normalizeMessages.js";
import { hasTemperature, throwResponseError, withoutTrailingSlashes } from "./providerHttp.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OFFICIAL_HOST = "api.openai.com";
const STREAM_END_MARKER = "[DONE]";

function baseUrl(config) {
  return withoutTrailingSlashes(config.baseUrl, DEFAULT_BASE_URL);
}

function isOfficialApi(config) {
  return baseUrl(config).includes(OFFICIAL_HOST);
}

// Compatible servers (e.g. local ones) often need no key; OpenAI itself always does.
function requestHeaders(config) {
  const headers = { "content-type": "application/json" };
  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  } else if (isOfficialApi(config)) {
    throw new Error("OpenAI API key is not set. Add it in Settings.");
  }
  return headers;
}

function requestBody(config, request) {
  const isOfficial = isOfficialApi(config);
  const body = {
    model: request.model,
    messages: [{ role: "system", content: request.system }, ...normalizeMessages(request.messages)],
    stream: true,
  };
  // OpenAI's own API renamed the limit; most compatible servers still read max_tokens.
  if (isOfficial) {
    body.max_completion_tokens = request.maxTokens;
    body.stream_options = { include_usage: true };
  } else {
    body.max_tokens = request.maxTokens;
  }
  if (hasTemperature(request.temperature)) {
    body.temperature = Number(request.temperature);
  }
  return body;
}

// Applies one stream chunk: returns text to yield (if any) and records usage as it arrives.
function handleStreamChunk(data, usage) {
  if (data.error) {
    throw new Error(`OpenAI: ${data.error.message || "stream error"}`);
  }
  const choice = data.choices?.[0];
  if (choice?.finish_reason) {
    usage.stop = choice.finish_reason;
  }
  if (data.usage) {
    usage.input = data.usage.prompt_tokens;
    usage.output = data.usage.completion_tokens;
  }
  return choice?.delta?.content || null;
}

async function* stream(config, request) {
  const response = await fetch(`${baseUrl(config)}/chat/completions`, {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(requestBody(config, request)),
    signal: request.signal,
  });
  if (!response.ok) {
    await throwResponseError(response, "OpenAI");
  }
  const usage = {};
  for await (const event of sseEvents(response.body)) {
    if (event.data === STREAM_END_MARKER) {
      break;
    }
    const text = handleStreamChunk(JSON.parse(event.data), usage);
    if (text) {
      yield { text };
    }
  }
  yield { usage };
}

function byId(first, second) {
  return first.id.localeCompare(second.id);
}

async function listModels(config) {
  const response = await fetch(`${baseUrl(config)}/models`, { headers: requestHeaders(config) });
  if (!response.ok) {
    await throwResponseError(response, "OpenAI");
  }
  const result = await response.json();
  const models = (result.data || []).map((model) => ({ id: model.id, label: model.id }));
  return models.sort(byId);
}

export const openai = { stream, listModels };
