// Calls to the AI providers, using the saved settings and credentials.
import { badRequest, notFound, upstream } from "../http/errors.js";

const CONNECTION_TEST_MAX_TOKENS = 32;
const CONNECTION_TEST_SYSTEM = "Reply with exactly one word: ready";
const CONNECTION_TEST_QUESTION = "Are you there?";

// Client-side problems (bad settings) pass through; anything else is the provider's fault.
function isClientHttpError(error) {
  return Boolean(error.status && error.status < 500 && error.code);
}

export function createModelService({ settings, providers }) {
  function findProvider(providerName) {
    const provider = providers[providerName];
    if (!provider) {
      throw notFound(`Unknown provider "${providerName}".`);
    }
    return provider;
  }

  // Starts a streamed completion. Returns {provider, model, events}, where events yields
  // {text} and {usage}.
  async function stream({ provider: requestedProvider, system, messages, maxTokens, signal }) {
    const savedSettings = await settings.load();
    const providerName = requestedProvider || savedSettings.provider;
    const provider = findProvider(providerName);
    const providerConfig = await settings.providerConfig(providerName);
    if (!providerConfig.model) {
      throw badRequest(`No model is set for ${providerName}. Choose one in Settings.`);
    }
    const events = provider.stream(providerConfig, {
      model: providerConfig.model,
      system,
      messages,
      maxTokens: maxTokens || savedSettings.generation.maxTokens,
      temperature: savedSettings.generation.temperature,
      signal,
    });
    return { provider: providerName, model: providerConfig.model, events };
  }

  async function listModels(providerName) {
    const provider = findProvider(providerName);
    try {
      return await provider.listModels(await settings.providerConfig(providerName));
    } catch (error) {
      throw upstream(error.message);
    }
  }

  async function collectText(events) {
    let text = "";
    for await (const event of events) {
      if (event.text) {
        text += event.text;
      }
    }
    return text;
  }

  // A tiny round trip to prove the credentials and model work.
  async function test(providerName, { now = () => performance.now() } = {}) {
    findProvider(providerName);
    const startedAt = now();
    try {
      const run = await stream({
        provider: providerName,
        system: CONNECTION_TEST_SYSTEM,
        messages: [{ role: "user", content: CONNECTION_TEST_QUESTION }],
        maxTokens: CONNECTION_TEST_MAX_TOKENS,
      });
      const text = await collectText(run.events);
      return {
        provider: providerName,
        model: run.model,
        reply: text.trim(),
        ms: Math.round(now() - startedAt),
      };
    } catch (error) {
      if (isClientHttpError(error)) {
        throw error;
      }
      throw upstream(error.message);
    }
  }

  return { stream, listModels, test };
}
