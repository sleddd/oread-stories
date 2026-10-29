// Google Gemini (Generative Language API) adapter.
import { sseEvents } from "./sseEvents.js";
import { normalizeMessages } from "./normalizeMessages.js";
import { hasTemperature, throwResponseError } from "./providerHttp.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_PAGE_SIZE = 1000;
const MODEL_NAME_PREFIX = /^models\//;

function requestHeaders(config) {
  if (!config.apiKey) {
    throw new Error("Gemini API key is not set. Add it in Settings.");
  }
  return { "x-goog-api-key": config.apiKey, "content-type": "application/json" };
}

// Gemini calls the assistant role "model".
function toGeminiContent(message) {
  let role = "user";
  if (message.role === "assistant") {
    role = "model";
  }
  return { role, parts: [{ text: message.content }] };
}

function requestBody(request) {
  const generationConfig = { maxOutputTokens: request.maxTokens };
  if (hasTemperature(request.temperature)) {
    generationConfig.temperature = Number(request.temperature);
  }
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: normalizeMessages(request.messages).map(toGeminiContent),
    generationConfig,
  };
}

function throwIfFailed(data) {
  if (data.error) {
    throw new Error(`Gemini: ${data.error.message}`);
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt (${data.promptFeedback.blockReason}).`);
  }
}

// Visible text parts of a chunk; "thought" parts are the model's hidden reasoning.
function visibleTexts(candidate) {
  const parts = candidate?.content?.parts || [];
  const visibleParts = parts.filter((part) => part.text && !part.thought);
  return visibleParts.map((part) => part.text);
}

function recordUsage(data, candidate, usage) {
  if (candidate?.finishReason) {
    usage.stop = candidate.finishReason;
  }
  if (data.usageMetadata) {
    usage.input = data.usageMetadata.promptTokenCount;
    usage.output = data.usageMetadata.candidatesTokenCount;
  }
}

async function* stream(config, request) {
  const model = request.model.replace(MODEL_NAME_PREFIX, "");
  const url = `${BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: "POST",
    headers: requestHeaders(config),
    body: JSON.stringify(requestBody(request)),
    signal: request.signal,
  });
  if (!response.ok) {
    await throwResponseError(response, "Gemini");
  }
  const usage = {};
  for await (const event of sseEvents(response.body)) {
    const data = JSON.parse(event.data);
    throwIfFailed(data);
    const candidate = data.candidates?.[0];
    for (const text of visibleTexts(candidate)) {
      yield { text };
    }
    recordUsage(data, candidate, usage);
  }
  yield { usage };
}

function supportsChat(model) {
  const methods = model.supportedGenerationMethods || [];
  return methods.includes("generateContent");
}

async function listModels(config) {
  const response = await fetch(`${BASE_URL}/models?pageSize=${MODEL_PAGE_SIZE}`, {
    headers: requestHeaders(config),
  });
  if (!response.ok) {
    await throwResponseError(response, "Gemini");
  }
  const result = await response.json();
  const chatModels = (result.models || []).filter(supportsChat);
  return chatModels.map((model) => ({
    id: model.name.replace(MODEL_NAME_PREFIX, ""),
    label: model.displayName || model.name,
  }));
}

export const gemini = { stream, listModels };
