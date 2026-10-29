// The client for the Oread API. Every method resolves to parsed JSON or throws an ApiError.
// Sign-in calls go to the account routes (authBaseUrl); everything else to the API (baseUrl).
import { networkError, errorFromResponse } from "./ApiError.js";
import { readEventStream } from "./readEventStream.js";

const NO_CONTENT_STATUS = 204;
const UNAUTHENTICATED_STATUS = 401;
// Where the confirmation email's link lands once the address is confirmed.
const AFTER_EMAIL_CONFIRMED_PATH = "/";

export function createApiClient({
  baseUrl,
  authBaseUrl = "/api/auth",
  fetchFunction = (...args) => globalThis.fetch(...args),
}) {
  const unauthenticatedListeners = new Set();

  async function send(method, url, { body, signal } = {}) {
    const hasBody = body !== undefined;
    try {
      return await fetchFunction(url, {
        method,
        headers: hasBody ? { "content-type": "application/json" } : {},
        body: hasBody ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
        signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      throw networkError();
    }
  }

  // A 401 from the API means the session ended; whoever listens shows the sign-in screen.
  function noticeSignedOut(response) {
    if (response.status !== UNAUTHENTICATED_STATUS) {
      return;
    }
    for (const listener of unauthenticatedListeners) {
      listener();
    }
  }

  async function readResult(response) {
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    if (response.status === NO_CONTENT_STATUS) {
      return null;
    }
    return response.json();
  }

  async function request(method, path, body) {
    const response = await send(method, baseUrl + path, { body });
    noticeSignedOut(response);
    return readResult(response);
  }

  // Account routes answer 401 for a wrong password too, so they never count as signing out.
  async function authRequest(method, path, body) {
    const response = await send(method, authBaseUrl + path, { body });
    return readResult(response);
  }

  // POSTs, then reads the reply as a stream of events until it ends.
  async function stream(path, body, { signal, onEvent }) {
    const response = await send("POST", baseUrl + path, { body, signal });
    noticeSignedOut(response);
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    await readEventStream(response, onEvent);
  }

  const segment = encodeURIComponent;
  const storyPath = (storyId) => `/stories/${segment(storyId)}`;
  const characterPath = ({ storyId, characterId }) => {
    return `${storyPath(storyId)}/characters/${segment(characterId)}`;
  };
  const personalityPath = (character) => `${characterPath(character)}/personality`;

  return {
    // Calls `listener` whenever the API says the session has ended. Returns a way to stop.
    onUnauthenticated: (listener) => {
      unauthenticatedListeners.add(listener);
      return () => unauthenticatedListeners.delete(listener);
    },

    // { requiresSignIn }: false when Oread runs locally for one person.
    getHealth: () => request("GET", "/health"),
    // The signed-in { user, session }, or null.
    getSession: () => authRequest("GET", "/get-session"),
    signIn: ({ email, password }) => authRequest("POST", "/sign-in/email", { email, password }),
    signUp: ({ name, email, password }) => {
      const callbackURL = AFTER_EMAIL_CONFIRMED_PATH;
      return authRequest("POST", "/sign-up/email", { name, email, password, callbackURL });
    },
    signOut: () => authRequest("POST", "/sign-out", {}),
    // Emails a link that opens `redirectTo` with ?token=… (or ?error=INVALID_TOKEN if expired).
    requestPasswordReset: ({ email, redirectTo }) => {
      return authRequest("POST", "/request-password-reset", { email, redirectTo });
    },
    resetPassword: ({ token, newPassword }) => {
      return authRequest("POST", "/reset-password", { token, newPassword });
    },

    getLoreControls: () => request("GET", "/lore"),

    // `character` is { storyId, characterId }: whose personality to read or change.
    getPersonality: (character) => request("GET", personalityPath(character)),
    patchPersonality: (character, change) => {
      return request("PATCH", personalityPath(character), change);
    },
    randomizePersonality: (character) => {
      return request("POST", `${personalityPath(character)}/randomize`);
    },
    resetPersonality: (character) => request("POST", `${personalityPath(character)}/reset`),
    applyPreset: (character, presetId) => {
      return request("POST", `${personalityPath(character)}/presets/${segment(presetId)}`);
    },

    listStories: async () => (await request("GET", "/stories")).stories,
    createStory: (fields) => request("POST", "/stories", fields),
    getStory: (storyId) => request("GET", storyPath(storyId)),
    updateStory: (storyId, changes) => request("PATCH", storyPath(storyId), changes),
    deleteStory: (storyId) => request("DELETE", storyPath(storyId)),

    listStoryTemplates: async () => (await request("GET", "/story-templates")).templates,
    createStoryFromTemplate: (templateId) => {
      return request("POST", `/story-templates/${segment(templateId)}/stories`);
    },

    createCharacter: (storyId, fields) => {
      return request("POST", `${storyPath(storyId)}/characters`, fields);
    },
    updateCharacter: (character, changes) => request("PATCH", characterPath(character), changes),
    deleteCharacter: (character) => request("DELETE", characterPath(character)),

    listMemory: async (character) => {
      return (await request("GET", `${characterPath(character)}/memory`)).memory;
    },
    addMemory: (character, entry) => request("POST", `${characterPath(character)}/memory`, entry),
    updateMemory: (character, entryId, changes) => {
      return request("PATCH", `${characterPath(character)}/memory/${segment(entryId)}`, changes);
    },
    deleteMemory: (character, entryId) => {
      return request("DELETE", `${characterPath(character)}/memory/${segment(entryId)}`);
    },
    searchMemory: async (character, query) => {
      const search = `?query=${encodeURIComponent(query)}`;
      return (await request("GET", `${characterPath(character)}/memory/search${search}`)).results;
    },

    addWorldNote: (storyId, note) => request("POST", `${storyPath(storyId)}/world-notes`, note),
    updateWorldNote: (storyId, noteId, changes) => {
      return request("PATCH", `${storyPath(storyId)}/world-notes/${segment(noteId)}`, changes);
    },
    deleteWorldNote: (storyId, noteId) => {
      return request("DELETE", `${storyPath(storyId)}/world-notes/${segment(noteId)}`);
    },
    setWorldFact: (storyId, fact) => request("POST", `${storyPath(storyId)}/world-state`, fact),
    updateWorldFact: (storyId, factId, changes) => {
      return request("PATCH", `${storyPath(storyId)}/world-state/${segment(factId)}`, changes);
    },
    deleteWorldFact: (storyId, factId) => {
      return request("DELETE", `${storyPath(storyId)}/world-state/${segment(factId)}`);
    },

    listChats: async (storyId) => (await request("GET", `${storyPath(storyId)}/chats`)).chats,
    createChat: (storyId) => request("POST", `${storyPath(storyId)}/chats`, {}),
    getChat: (chatId) => request("GET", `/chats/${segment(chatId)}`),
    clearChat: (chatId) => request("POST", `/chats/${segment(chatId)}/clear`),
    renameChat: (chatId, title) => request("PATCH", `/chats/${segment(chatId)}`, { title }),
    // changes: { scene?, presentCharacterIds? }, sent together just before a turn.
    updateChatScene: (chatId, changes) => request("PATCH", `/chats/${segment(chatId)}`, changes),
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
    resetStoryEngine: (chatId) => request("POST", `/chats/${segment(chatId)}/engine/reset`),
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
