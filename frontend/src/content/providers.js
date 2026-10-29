// The settings form for each model provider, and how to tell whether one is ready to use.

export const SECRET_FIELD_KEYS = ["apiKey", "accessKeyId", "secretAccessKey", "sessionToken"];

export const PROVIDERS = [
  {
    id: "anthropic",
    name: "Claude",
    description: "Anthropic's API directly.",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        hint: "From console.anthropic.com, or set ANTHROPIC_API_KEY before starting the backend.",
      },
      {
        key: "model",
        label: "Model",
        kind: "model",
        hint: "For example claude-sonnet-5-5, claude-opus-5-5 or claude-haiku-5-5.",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        kind: "text",
        hint: "Change only if you route through a proxy.",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "OpenAI, or any OpenAI-compatible server such as OpenRouter, Ollama, LM Studio or vLLM.",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        hint: "Optional for local servers. Or set OPENAI_API_KEY.",
      },
      { key: "model", label: "Model", kind: "model" },
      {
        key: "baseUrl",
        label: "Base URL",
        kind: "text",
        hint: "https://api.openai.com/v1 · Ollama: http://localhost:11434/v1 · OpenRouter: https://openrouter.ai/api/v1",
      },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Google's Gemini API (AI Studio key).",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        hint: "From aistudio.google.com, or set GEMINI_API_KEY.",
      },
      { key: "model", label: "Model", kind: "model" },
    ],
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    description: "Claude, Llama, Mistral, Nova and others through the Bedrock Converse API.",
    fields: [
      {
        key: "region",
        label: "Region",
        kind: "text",
        hint: "The region where you have model access, e.g. us-east-1 or us-west-2.",
      },
      { key: "accessKeyId", label: "Access key ID", kind: "secret" },
      { key: "secretAccessKey", label: "Secret access key", kind: "secret" },
      {
        key: "sessionToken",
        label: "Session token",
        kind: "secret",
        hint: "Only for temporary (STS/SSO) credentials.",
      },
      {
        key: "apiKey",
        label: "Bedrock API key",
        kind: "secret",
        hint: "Alternative to the key pair. If set, it's used instead. Env: AWS_BEARER_TOKEN_BEDROCK.",
      },
      {
        key: "model",
        label: "Model or inference profile ID",
        kind: "model",
        hint: "Newer models usually need a cross-region profile ID such as us.anthropic.… — use Fetch to list what your account can call.",
      },
    ],
  },
];

export function providerName(providerId) {
  const provider = PROVIDERS.find((candidate) => candidate.id === providerId);
  return provider ? provider.name : providerId;
}

function isSecretSet(secrets, key) {
  return Boolean(secrets?.[key]?.source);
}

function hasCredentials(settings, providerId) {
  const secrets = settings.secrets?.[providerId] ?? {};
  if (providerId === "bedrock") {
    const hasKeyPair =
      isSecretSet(secrets, "accessKeyId") && isSecretSet(secrets, "secretAccessKey");
    return isSecretSet(secrets, "apiKey") || hasKeyPair;
  }
  if (providerId === "openai") {
    // Local OpenAI-compatible servers often need no key.
    const usesOfficialApi = String(settings.openai?.baseUrl ?? "").includes("api.openai.com");
    return isSecretSet(secrets, "apiKey") || !usesOfficialApi;
  }
  return isSecretSet(secrets, "apiKey");
}

export function providerReadiness(settings, providerId = settings.provider) {
  const hasKey = hasCredentials(settings, providerId);
  const hasModel = Boolean(settings[providerId]?.model);
  return { hasCredentials: hasKey, isReady: hasKey && hasModel };
}
