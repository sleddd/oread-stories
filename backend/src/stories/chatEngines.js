// A chat keeps one story-engine state per character. Until replies pick their own speaker, the
// speaking character is the chat's last speaker, or else the first character present.
import { initialEngineState } from "../story/engineState.js";

export function speakingCharacterId(chat) {
  return chat.lastSpeakerId ?? chat.presentCharacterIds?.[0] ?? null;
}

export function engineStateOf(chat, characterId) {
  return chat.engines?.[characterId] ?? initialEngineState();
}

export function setEngineState(chat, characterId, engineState) {
  chat.engines = { ...(chat.engines ?? {}), [characterId]: engineState };
}
