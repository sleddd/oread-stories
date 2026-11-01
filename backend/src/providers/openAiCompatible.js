// The Chat Completions protocol shared by OpenAI and the servers that copy it (Featherless,
// OpenRouter, Ollama, vLLM…). Each adapter built here says where it points, whether it needs a
// key, and how to read its model list; streaming and errors work the same for all of them.
import { sseEvents } from "./sseEvents.js";
import { normalizeMessages } from "./normalizeMessages.js";
import { hasTemperature, providerFetch, throwResponseError } from "./providerHttp.js";
import { CHAT_TEMPLATE_STOP_MARKERS, createStopMarkerFilter } from "./stopMarkers.js";

const STREAM_END_MARKER = "[DONE]";
// The Chat Completions API takes at most four stop sequences; the stream filter catches the rest.
const MAX_STOP_SEQUENCES = 4;
const STOPPED_AT_MARKER = "stop";

function byId(first, second) {
  return first.id.localeCompare(second.id);
}

// The default model list: every model the server names, labelled by its id, in id order.
async function listEveryModel(config, fetchListing) {
  const listing = await fetchListing("");
  const models = (listing.data || []).map((model) => ({ id: model.id, label: model.id }));
  return models.sort(byId);
}

// options:
//   label              the provider's name in errors, e.g. "OpenAI"
//   baseUrlOf(config)  the API root, without a trailing slash
//   isKeyRequired(config)
//   usesNewTokenLimit(config)  true where the server wants max_completion_tokens
//   extraHeaders       sent with every call
//   endsAtChatMarkers  true for servers running open-weight models, which can write past their
//                      own end-of-turn marker (see stopMarkers.js)
//   samplingSettings   extra sampling settings sent with every reply, e.g. a repetition penalty
//   listModelsWith(config, fetchListing, { search })  optional; resolves to [{ id, label }]
//                      in the order they should be offered
export function createOpenAiCompatibleAdapter({
  label,
  baseUrlOf,
  isKeyRequired,
  usesNewTokenLimit = () => false,
  extraHeaders = {},
  endsAtChatMarkers = false,
  samplingSettings = {},
  listModelsWith = listEveryModel,
}) {
  function requestHeaders(config) {
    const headers = { "content-type": "application/json", ...extraHeaders };
    if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    } else if (isKeyRequired(config)) {
      throw new Error(`${label} API key is not set. Add it in Settings.`);
    }
    return headers;
  }

  function requestBody(config, request) {
    const body = {
      ...samplingSettings,
      model: request.model,
      messages: [
        { role: "system", content: request.system },
        ...normalizeMessages(request.messages),
      ],
      stream: true,
    };
    // OpenAI's own API renamed the limit; most compatible servers still read max_tokens.
    if (usesNewTokenLimit(config)) {
      body.max_completion_tokens = request.maxTokens;
      body.stream_options = { include_usage: true };
    } else {
      body.max_tokens = request.maxTokens;
    }
    if (hasTemperature(request.temperature)) {
      body.temperature = Number(request.temperature);
    }
    if (endsAtChatMarkers) {
      body.stop = CHAT_TEMPLATE_STOP_MARKERS.slice(0, MAX_STOP_SEQUENCES);
    }
    // Passed to the model's chat template by open-weight servers, e.g. { enable_thinking: false }.
    if (request.chatTemplateOptions) {
      body.chat_template_kwargs = request.chatTemplateOptions;
    }
    return body;
  }

  // Applies one stream chunk: returns text to yield (if any) and records usage as it arrives.
  function handleStreamChunk(data, usage) {
    if (data.error) {
      throw new Error(`${label}: ${data.error.message || "stream error"}`);
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
    const response = await providerFetch(config, `${baseUrlOf(config)}/chat/completions`, {
      method: "POST",
      headers: requestHeaders(config),
      body: JSON.stringify(requestBody(config, request)),
      signal: request.signal,
    });
    if (!response.ok) {
      await throwResponseError(response, label);
    }
    const usage = {};
    const markerFilter = endsAtChatMarkers ? createStopMarkerFilter() : null;
    for await (const event of sseEvents(response.body)) {
      if (event.data === STREAM_END_MARKER) {
        break;
      }
      const text = handleStreamChunk(JSON.parse(event.data), usage);
      if (!text) {
        continue;
      }
      if (!markerFilter) {
        yield { text };
        continue;
      }
      const filtered = markerFilter.push(text);
      if (filtered.text) {
        yield { text: filtered.text };
      }
      if (filtered.hasStopped) {
        usage.stop = STOPPED_AT_MARKER;
        break;
      }
    }
    const heldText = markerFilter?.finish();
    if (heldText) {
      yield { text: heldText };
    }
    yield { usage };
  }

  // `query` is appended to /models as it is, e.g. "?page=2".
  async function fetchListing(config, query) {
    const response = await providerFetch(config, `${baseUrlOf(config)}/models${query}`, {
      headers: requestHeaders(config),
    });
    if (!response.ok) {
      await throwResponseError(response, label);
    }
    return response.json();
  }

  function listModels(config, options = {}) {
    return listModelsWith(config, (query) => fetchListing(config, query), options);
  }

  return { stream, listModels };
}
