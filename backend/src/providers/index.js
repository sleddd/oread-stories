// The provider registry. Each adapter exposes:
//   stream(config, request)  async generator yielding {text} chunks and finally {usage}
//   listModels(config)       resolves to [{id, label}]
// request = {model, system, messages: [{role: "user" | "assistant", content}], maxTokens,
//            temperature, cache, signal}
// `cache` is a hint: Anthropic and Bedrock mark the system prompt and earlier history for prompt
// caching; OpenAI and Gemini cache stable prefixes on their own and ignore it.
import { anthropic } from "./anthropic.js";
import { openai } from "./openai.js";
import { gemini } from "./gemini.js";
import { bedrock } from "./bedrock.js";

export const PROVIDERS = { anthropic, openai, gemini, bedrock };
