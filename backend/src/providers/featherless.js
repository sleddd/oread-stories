// Featherless (featherless.ai): open-weight models from Hugging Face behind an OpenAI-compatible
// API. The base URL is fixed and a key is always needed. The catalogue runs to tens of thousands
// of models, so the list asks for one page of the most-downloaded chat models the account's plan
// can run. A search goes to Featherless itself, so it reaches the whole catalogue rather than
// only that first page, and drops the chat filter (some good story models aren't tagged).
//
// Only models big enough for Oread are listed or used (featherlessModelSize.js): before each
// reply the chosen model's real size is checked, so a model ID typed by hand can't get past it.
import { createOpenAiCompatibleAdapter } from "./openAiCompatible.js";
import { providerFetch } from "./providerHttp.js";
import {
  MIN_CONTEXT_TOKENS,
  MIN_PARAMETERS_IN_BILLIONS,
  billionsInModelClass,
  isListedModelBigEnough,
  reasonModelIsTooSmall,
} from "./featherlessModelSize.js";

const FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1";
// Featherless asks integrations to name themselves.
const APP_TITLE = "Oread";
// Featherless answers "404 Gone" to every request carrying Node's default user agent ("node"),
// signed in or not, so calls name the app instead.
const USER_AGENT = "Oread/0.2";
const TOKENS_PER_THOUSAND = 1000;
const MODEL_LIST_FILTERS = {
  available_on_current_plan: "true",
  // The system prompt, the scene note and the recent turns need room.
  context_length_min: String(MIN_CONTEXT_TOKENS),
  sort: "-downloads",
  per_page: "1000",
  page: "1",
};
// Only for the list shown before any search.
const BROWSING_FILTERS = { conversational: "true" };
const APP_HEADERS = { "X-Title": APP_TITLE, "user-agent": USER_AGENT };
// Open-weight models fall into loops (the same reply, or the same lines, turn after turn)
// without a nudge away from repeating themselves. Mild values, as the roleplay models'
// own authors suggest; min_p trims the unlikely tail that a penalty would otherwise promote.
const SAMPLING_SETTINGS = { repetition_penalty: 1.05, min_p: 0.025 };

// "available_on_current_plan" only comes back when the call is signed in; without it, keep all.
function canRunOnPlan(model) {
  return model.available_on_current_plan !== false;
}

// "Qwen/Qwen3-32B (32B, 33k context)".
function labelOf(model) {
  const details = [];
  const billions = billionsInModelClass(model.model_class);
  if (billions !== null) {
    details.push(`${billions}B`);
  }
  if (model.context_length) {
    details.push(`${Math.round(model.context_length / TOKENS_PER_THOUSAND)}k context`);
  }
  if (details.length === 0) {
    return model.id;
  }
  return `${model.id} (${details.join(", ")})`;
}

function listingQuery(search) {
  if (search) {
    return `?${new URLSearchParams({ ...MODEL_LIST_FILTERS, q: search })}`;
  }
  return `?${new URLSearchParams({ ...MODEL_LIST_FILTERS, ...BROWSING_FILTERS })}`;
}

// Most-downloaded first, the order Featherless gives them in.
async function listPlanModels(config, fetchListing, { search = "" } = {}) {
  const listing = await fetchListing(listingQuery(search));
  const runnableModels = (listing.data || []).filter(canRunOnPlan);
  const bigEnoughModels = runnableModels.filter(isListedModelBigEnough);
  return bigEnoughModels.map((model) => ({ id: model.id, label: labelOf(model) }));
}

const chatAdapter = createOpenAiCompatibleAdapter({
  label: "Featherless",
  baseUrlOf: () => FEATHERLESS_BASE_URL,
  isKeyRequired: () => true,
  extraHeaders: APP_HEADERS,
  endsAtChatMarkers: true,
  samplingSettings: SAMPLING_SETTINGS,
  listModelsWith: listPlanModels,
});

function tooSmallMessage(reason) {
  return (
    `${reason}, too small for Oread's story turns. In Settings, pick a Featherless model of ` +
    `${MIN_PARAMETERS_IN_BILLIONS}B or more with at least ${MIN_CONTEXT_TOKENS / 1024}k context.`
  );
}

// The reason each model checked won't do (or null), kept for as long as the server runs.
const sizeCheckByModel = new Map();

async function fetchReasonTooSmall(config, modelId) {
  try {
    const url = `${FEATHERLESS_BASE_URL}/models/${encodeURIComponent(modelId)}`;
    const response = await providerFetch(config, url, { headers: APP_HEADERS });
    if (!response.ok) {
      return null;
    }
    return reasonModelIsTooSmall(await response.json());
  } catch {
    // If the details can't be had, the reply call itself says what's wrong.
    return null;
  }
}

async function refuseModelsTooSmall(config, modelId) {
  if (!sizeCheckByModel.has(modelId)) {
    sizeCheckByModel.set(modelId, await fetchReasonTooSmall(config, modelId));
  }
  const reason = sizeCheckByModel.get(modelId);
  if (reason) {
    throw new Error(tooSmallMessage(reason));
  }
}

async function* stream(config, request) {
  await refuseModelsTooSmall(config, request.model);
  yield* chatAdapter.stream(config, request);
}

export const featherless = { stream, listModels: chatAdapter.listModels };
