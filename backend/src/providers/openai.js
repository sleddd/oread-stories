// OpenAI Chat Completions adapter. Also works with OpenAI-compatible servers via a base URL.
import { createOpenAiCompatibleAdapter } from "./openAiCompatible.js";
import { withoutTrailingSlashes } from "./providerHttp.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OFFICIAL_HOST = "api.openai.com";

function baseUrlOf(config) {
  return withoutTrailingSlashes(config.baseUrl, DEFAULT_BASE_URL);
}

function isOfficialApi(config) {
  return baseUrlOf(config).includes(OFFICIAL_HOST);
}

// Compatible servers (e.g. local ones) often need no key; OpenAI itself always does.
export const openai = createOpenAiCompatibleAdapter({
  label: "OpenAI",
  baseUrlOf,
  isKeyRequired: isOfficialApi,
  usesNewTokenLimit: isOfficialApi,
});
