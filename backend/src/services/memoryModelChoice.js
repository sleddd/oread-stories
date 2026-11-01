// Which model keeps the records when the story is told by a Featherless model. Roleplay-tuned
// models write the story well but skip the hidden notes, so for Featherless chats a model that
// follows formats reliably writes them first, each turn (services/memoryPass.js). It is chosen
// here, from the person's own Featherless catalogue: the first candidate that the learning
// record (modelMemoryRecord.js) hasn't seen missing its notes. No setting is needed.
import { MISSES_MEMORIES, memoryVerdict, recordKey } from "./modelMemoryRecord.js";

export const MEMORY_PROVIDER = "featherless";

// In order of preference. The first is confirmed to write correct notes; the rest are large,
// general-purpose instruct models that follow formats well, tried only if one before them fails.
export const MEMORY_MODEL_CANDIDATES = [
  "Qwen/Qwen3.8-27B",
  "Qwen/Qwen3.6-35B-A3B",
  "google/gemma-4-31B-it",
  "deepseek-ai/DeepSeek-V3.2",
];

// Qwen-style models reason at length before answering; the notes need no reasoning, so it is
// turned off. Chat templates that don't know the option ignore it.
export const MEMORY_CHAT_TEMPLATE_OPTIONS = { enable_thinking: false };

export function usesMemoryPass(chatProvider) {
  return chatProvider === MEMORY_PROVIDER;
}

// { provider, model, chatTemplateOptions } for the next memory call, or null when every
// candidate has been seen missing its notes.
export function chooseMemoryModel(records) {
  const model = MEMORY_MODEL_CANDIDATES.find((candidate) => {
    const record = records[recordKey(MEMORY_PROVIDER, candidate)];
    return memoryVerdict(record) !== MISSES_MEMORIES;
  });
  if (!model) {
    return null;
  }
  return { provider: MEMORY_PROVIDER, model, chatTemplateOptions: MEMORY_CHAT_TEMPLATE_OPTIONS };
}
