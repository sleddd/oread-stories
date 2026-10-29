// The client for the Oread API. Every method resolves to parsed JSON or throws an ApiError.
import { networkError, errorFromResponse } from "./ApiError.js";
import { readEventStream } from "./readEventStream.js";

const NO_CONTENT_STATUS = 204;

export function createApiClient({ baseUrl, fetchFunction = (...args) => globalThis.fetch(...args) }) {
  async function send(method, path, { body, signal } = {}) {
    const hasBody = body !== undefined;
    try {
      return await fetchFunction(baseUrl + path, {
        method,
        headers: hasBody ? { "content-type": "application/json" } : {},
        body: hasBody ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      throw networkError();
    }
  }

  async function request(method, path, body) {
    const response = await send(method, path, { body });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    if (response.status === NO_CONTENT_STATUS) {
      return null;
    }
    return response.json();
  }

  // POSTs, then reads the reply as a stream of events until it ends.
  async function stream(path, body, { signal, onEvent }) {
    const response = await send("POST", path, { body, signal });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    await readEventStream(response, onEvent);
  }

  const segment = encodeURIComponent;

  return {
    getLoreControls: () => request("GET", "/lore"),

    getPersonality: () => request("GET", "/personality"),
    patchPersonality: (change) => request("PATCH", "/personality", change),
    randomizePersonality: () => request("POST", "/personality/randomize"),
    resetPersonality: () => request("POST", "/personality/reset"),
    applyPreset: (presetId) => request("POST", `/personality/presets/${segment(presetId)}`),

    listChats: async () => (await request("GET", "/chats")).chats,
    createChat: () => request("POST", "/chats", {}),
    getChat: (chatId) => request("GET", `/chats/${segment(chatId)}`),
    renameChat: (chatId, title) => request("PATCH", `/chats/${segment(chatId)}`, { title }),
    deleteChat: (chatId) => request("DELETE", `/chats/${segment(chatId)}`),
    editMessage: (chatId, messageId, change) => {
      return request("PATCH", `/chats/${segment(chatId)}/messages/${segment(messageId)}`, change);
    },
    deleteMessage: (chatId, messageId) => {
      return request("DELETE", `/chats/${segment(chatId)}/messages/${segment(messageId)}`);
    },
    getContext: (chatId, draft) => {
      const query = draft ? `?draft=${encodeURIComponent(draft)}` : "";
      return request("GET", `/chats/${segment(chatId)}/context${query}`);
    },
    undoShift: (chatId) => request("POST", `/chats/${segment(chatId)}/shift/undo`),
    sendMessage: (chatId, content, options) => {
      return stream(`/chats/${segment(chatId)}/messages`, { content }, options);
    },
    requestReply: (chatId, options) => stream(`/chats/${segment(chatId)}/reply`, {}, options),

    getSettings: () => request("GET", "/settings"),
    patchSettings: (change) => request("PATCH", "/settings", change),
    listModels: async (providerId) => {
      return (await request("GET", `/providers/${segment(providerId)}/models`)).models;
    },
    testProvider: (providerId) => request("POST", `/providers/${segment(providerId)}/test`),

    exportData: () => request("GET", "/export"),
    importData: (data) => request("POST", "/import", data),
  };
}
