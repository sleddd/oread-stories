// The shape of the settings document: defaults, which fields are secrets, and which environment
// variables can supply each provider field.
export const PROVIDER_IDS = ["anthropic", "openai", "gemini", "bedrock"];

export const DEFAULT_SETTINGS = Object.freeze({
  provider: "anthropic",
  anthropic: { apiKey: "", model: "claude-sonnet-5-5", baseUrl: "https://api.anthropic.com" },
  openai: { apiKey: "", model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1" },
  gemini: { apiKey: "", model: "gemini-2.5-flash" },
  bedrock: {
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    apiKey: "",
    model: "",
  },
  generation: { maxTokens: 2048, temperature: "" },
  memory: { historyWindow: 24 },
  user: { name: "You" },
  engine: { enabled: true },
});

// Fields that never leave the backend.
export const SECRET_FIELDS = {
  anthropic: ["apiKey"],
  openai: ["apiKey"],
  gemini: ["apiKey"],
  bedrock: ["accessKeyId", "secretAccessKey", "sessionToken", "apiKey"],
};

// Environment variables per provider field; a list means "the first one that is set".
export const ENVIRONMENT_VARIABLES = {
  anthropic: { apiKey: "ANTHROPIC_API_KEY" },
  openai: { apiKey: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL" },
  gemini: { apiKey: ["GEMINI_API_KEY", "GOOGLE_API_KEY"] },
  bedrock: {
    region: ["AWS_REGION", "AWS_DEFAULT_REGION"],
    accessKeyId: "AWS_ACCESS_KEY_ID",
    secretAccessKey: "AWS_SECRET_ACCESS_KEY",
    sessionToken: "AWS_SESSION_TOKEN",
    apiKey: "AWS_BEARER_TOKEN_BEDROCK",
  },
};
