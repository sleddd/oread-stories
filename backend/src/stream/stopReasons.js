// Tells whether a provider stopped a reply because it reached the reply length limit. Each
// provider names that differently, and a reply cut off there loses the hidden notes at its end.

const LENGTH_LIMIT_STOP_REASONS = new Set([
  "max_tokens", // Anthropic and Bedrock
  "length", // OpenAI and OpenAI-compatible servers
  "MAX_TOKENS", // Gemini
]);

export const LENGTH_LIMIT_STOP = "max_tokens";

export function isLengthLimitStop(stopReason) {
  return LENGTH_LIMIT_STOP_REASONS.has(stopReason);
}
