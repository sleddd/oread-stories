// Featherless (featherless.ai): open-weight models from Hugging Face behind an OpenAI-compatible
// API. The base URL is fixed and a key is always needed. The catalogue runs to tens of thousands
// of models, so the list asks for one page of the most-downloaded chat models the account's plan
// can run, with enough context for a story turn. A search goes to Featherless itself, so it
// reaches the whole catalogue rather than only that first page, and drops the chat and context
// filters: someone searching by name means that model, even an older one with a short context.
import { createOpenAiCompatibleAdapter } from "./openAiCompatible.js";

const FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1";
// Featherless asks integrations to name themselves.
const APP_TITLE = "Oread";
// Featherless answers "404 Gone" to every request carrying Node's default user agent ("node"),
// signed in or not, so calls name the app instead.
const USER_AGENT = "Oread/0.2";
const TOKENS_PER_THOUSAND = 1000;
const MODEL_LIST_FILTERS = {
  available_on_current_plan: "true",
  sort: "-downloads",
  per_page: "1000",
  page: "1",
};
// Only for the list shown before any search.
const BROWSING_FILTERS = {
  conversational: "true",
  // The system prompt, the scene note and the recent turns need room.
  context_length_min: "16384",
};

// "available_on_current_plan" only comes back when the call is signed in; without it, keep all.
function canRunOnPlan(model) {
  return model.available_on_current_plan !== false;
}

function labelOf(model) {
  if (!model.context_length) {
    return model.id;
  }
  const contextInThousands = Math.round(model.context_length / TOKENS_PER_THOUSAND);
  return `${model.id} (${contextInThousands}k context)`;
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
  return runnableModels.map((model) => ({ id: model.id, label: labelOf(model) }));
}

export const featherless = createOpenAiCompatibleAdapter({
  label: "Featherless",
  baseUrlOf: () => FEATHERLESS_BASE_URL,
  isKeyRequired: () => true,
  extraHeaders: { "X-Title": APP_TITLE, "user-agent": USER_AGENT },
  endsAtChatMarkers: true,
  listModelsWith: listPlanModels,
});
