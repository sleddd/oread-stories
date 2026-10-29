// AWS Bedrock adapter using the Converse API. Authenticates with a Bedrock API key or a signed
// (SigV4) access key pair.
import { awsEvents } from "./awsEvents.js";
import { signAws } from "./signAws.js";
import { normalizeMessages } from "./normalizeMessages.js";
import { hasTemperature, throwResponseError } from "./providerHttp.js";

const DEFAULT_REGION = "us-east-1";
const SIGNING_SERVICE = "bedrock";
const MAX_LIST_RESULTS = 1000;

// Control-plane calls go to bedrock.<region>, inference to bedrock-runtime.<region>;
// both sign with service name "bedrock".
function endpointUrl(region, isRuntime, path) {
  let hostPrefix = "bedrock";
  if (isRuntime) {
    hostPrefix = "bedrock-runtime";
  }
  return `https://${hostPrefix}.${region}.amazonaws.com${path}`;
}

function baseHeaders(isRuntime) {
  let accept = "application/json";
  if (isRuntime) {
    accept = "application/vnd.amazon.eventstream";
  }
  return { "content-type": "application/json", accept };
}

function authorizedHeaders(config, { method, url, headers, body, region }) {
  if (config.apiKey) {
    return { ...headers, authorization: `Bearer ${config.apiKey}` };
  }
  if (config.accessKeyId && config.secretAccessKey) {
    return signAws({
      method,
      url,
      headers,
      body,
      service: SIGNING_SERVICE,
      region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    });
  }
  throw new Error(
    "AWS credentials are not set. Add an access key pair or a Bedrock API key in Settings.",
  );
}

async function bedrockRequest(
  config,
  { runtime = false, path, method = "GET", body = "", signal },
) {
  const region = config.region || DEFAULT_REGION;
  const url = endpointUrl(region, runtime, path);
  const headers = authorizedHeaders(config, {
    method,
    url,
    headers: baseHeaders(runtime),
    body,
    region,
  });
  let requestBody = body;
  if (method === "GET") {
    requestBody = undefined;
  }
  const response = await fetch(url, { method, headers, body: requestBody, signal });
  if (!response.ok) {
    await throwResponseError(response, "Bedrock");
  }
  return response;
}

function converseBody(request) {
  const inferenceConfig = { maxTokens: request.maxTokens };
  if (hasTemperature(request.temperature)) {
    inferenceConfig.temperature = Number(request.temperature);
  }
  const messages = normalizeMessages(request.messages).map((message) => ({
    role: message.role,
    content: [{ text: message.content }],
  }));
  return JSON.stringify({ system: [{ text: request.system }], messages, inferenceConfig });
}

function throwIfException(event) {
  if (event.headers[":message-type"] !== "exception") {
    return;
  }
  const message = event.payload.message || event.payload.Message || "";
  throw new Error(`Bedrock ${event.headers[":exception-type"]}: ${message}`);
}

// Applies one stream event: returns text to yield (if any) and records usage as it arrives.
function handleStreamEvent(event, usage) {
  const eventType = event.headers[":event-type"];
  const payload = event.payload;
  if (eventType === "contentBlockDelta" && payload.delta?.text) {
    return payload.delta.text;
  }
  if (eventType === "messageStop") {
    usage.stop = payload.stopReason;
  } else if (eventType === "metadata" && payload.usage) {
    usage.input = payload.usage.inputTokens;
    usage.output = payload.usage.outputTokens;
  }
  return null;
}

async function* stream(config, request) {
  if (!request.model) {
    throw new Error("Pick a Bedrock model ID in Settings.");
  }
  const response = await bedrockRequest(config, {
    runtime: true,
    method: "POST",
    body: converseBody(request),
    signal: request.signal,
    path: `/model/${encodeURIComponent(request.model)}/converse-stream`,
  });
  const usage = {};
  for await (const event of awsEvents(response.body)) {
    throwIfException(event);
    const text = handleStreamEvent(event, usage);
    if (text) {
      yield { text };
    }
  }
  yield { usage };
}

async function listInferenceProfiles(config) {
  const response = await bedrockRequest(config, {
    path: `/inference-profiles?maxResults=${MAX_LIST_RESULTS}`,
  });
  const profiles = (await response.json()).inferenceProfileSummaries || [];
  return profiles.map((profile) => {
    const name = profile.inferenceProfileName || profile.inferenceProfileId;
    return { id: profile.inferenceProfileId, label: `${name} (profile)` };
  });
}

function supportsOnDemand(model) {
  const inferenceTypes = model.inferenceTypesSupported || [];
  return inferenceTypes.includes("ON_DEMAND");
}

async function listFoundationModels(config) {
  const response = await bedrockRequest(config, {
    path: "/foundation-models?byOutputModality=TEXT",
  });
  const models = (await response.json()).modelSummaries || [];
  const onDemandModels = models.filter(supportsOnDemand);
  return onDemandModels.map((model) => ({
    id: model.modelId,
    label: `${model.providerName} ${model.modelName}`,
  }));
}

// Lists inference profiles and on-demand models. Either source may fail (e.g. missing
// permissions); only fail overall when nothing could be listed.
async function listModels(config) {
  const found = [];
  const errors = [];
  for (const listSource of [listInferenceProfiles, listFoundationModels]) {
    try {
      found.push(...(await listSource(config)));
    } catch (error) {
      errors.push(error);
    }
  }
  if (!found.length && errors.length) {
    throw errors[0];
  }
  return found;
}

export const bedrock = { stream, listModels };
