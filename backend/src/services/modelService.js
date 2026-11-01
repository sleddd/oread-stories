// Calls to the AI providers, using the saved settings and credentials.
import { badRequest, notFound, upstream } from "../http/errors.js";

const CONNECTION_TEST_MAX_TOKENS = 32;
const CONNECTION_TEST_SYSTEM = "Reply with exactly one word: ready";
const CONNECTION_TEST_QUESTION = "Are you there?";

// Client-side problems (bad settings) pass through; anything else is the provider's fault.
function isClientHttpError(error) {
  return Boolean(error.status && error.status < 500 && error.code);
}

function modelsMatching(models, search) {
  if (!search) {
    return models;
  }
  const searchText = search.toLowerCase();
  return models.filter((model) => {
    const searchable = `${model.id} ${model.label}`.toLowerCase();
    return searchable.includes(searchText);
  });
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
  // {text} and {usage}. `cache` asks providers that support it to cache the system prompt and
  // the history before the newest message. `model` overrides the provider's saved model (the
  // automatic memory model uses another model on the same provider); `chatTemplateOptions`
  // goes to open-weight servers as is (e.g. turning a model's thinking off).
  async function stream({
    provider: requestedProvider,
    model: requestedModel,
    system,
    messages,
    maxTokens,
    cache = false,
    chatTemplateOptions,
    signal,
  }) {
    const savedSettings = await settings.load();
    const providerName = requestedProvider || savedSettings.provider;
    const provider = findProvider(providerName);
    const providerConfig = await settings.providerConfig(providerName);
    const model = requestedModel || providerConfig.model;
    if (!model) {
      throw badRequest(`No model is set for ${providerName}. Choose one in Settings.`);
    }
    const events = provider.stream(providerConfig, {
      model,
      chatTemplateOptions,
      system,
      messages,
      maxTokens: maxTokens || savedSettings.generation.maxTokens,
      temperature: savedSettings.generation.temperature,
      cache,
      signal,
    });
    return { provider: providerName, model, events };
  }

  // `search` narrows the list to models whose id or name contains it. Providers that can search
  // on their side (Featherless) get it too; everyone's list is filtered here the same way.
  async function listModels(providerName, { search = "" } = {}) {
    const provider = findProvider(providerName);
    let models;
    try {
      const config = await settings.providerConfig(providerName);
      models = await provider.listModels(config, { search });
    } catch (error) {
      throw upstream(error.message);
    }
    return modelsMatching(models, search);
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
