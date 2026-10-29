import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAppStore } from "../src/store/index.js";
import {
  createFakeApi,
  createFakePlatform,
  sampleChat,
  sampleControls,
  sampleDerived,
  samplePersonality,
  sampleSettings,
} from "./helpers.jsx";

const PERSONALITY_SYNC_DELAY = 150;

function createReadyStore({ api = createFakeApi(), platform = createFakePlatform(), state = {} } = {}) {
  const store = createAppStore({ api, platform });
  store.setState({
    bootStatus: "ready",
    controls: sampleControls,
    personality: samplePersonality(),
    derived: sampleDerived(),
    settings: sampleSettings(),
    ...state,
  });
  return { store, api, platform };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("start-up", () => {
  it("loads everything the interface needs and opens the first chat", async () => {
    const api = createFakeApi({ listChats: vi.fn().mockResolvedValue([sampleChat()]) });
    const store = createAppStore({ api, platform: createFakePlatform() });

    await store.getState().boot();
    await vi.runAllTimersAsync();

    const state = store.getState();
    expect(state.bootStatus).toBe("ready");
    expect(state.controls).toEqual(sampleControls);
    expect(state.view).toBe("chat");
    expect(api.getChat).toHaveBeenCalledWith("chat-1");
    expect(state.activeChat.id).toBe("chat-1");
  });

  it("starts on Settings when no provider has credentials", async () => {
    const settings = sampleSettings();
    settings.secrets.anthropic.apiKey = { source: "" };
    const api = createFakeApi({ getSettings: vi.fn().mockResolvedValue(settings) });
    const store = createAppStore({ api, platform: createFakePlatform() });

    await store.getState().boot();
    await vi.advanceTimersByTimeAsync(300);

    expect(store.getState().view).toBe("settings");
    expect(store.getState().toast.message).toMatch(/Add a provider key/);
  });

  it("reports a failed start-up", async () => {
    const api = createFakeApi({ getLoreControls: vi.fn().mockRejectedValue(new Error("Can't reach the Oread API.")) });
    const store = createAppStore({ api, platform: createFakePlatform() });

    await store.getState().boot();

    expect(store.getState().bootStatus).toBe("failed");
    expect(store.getState().bootError).toBe("Can't reach the Oread API.");
  });
});

describe("personality", () => {
  it("shows a dial change at once and sends one batched update after a pause", async () => {
    const { store, api } = createReadyStore();

    store.getState().changePersonality({ values: { valence: 1 } });
    store.getState().changePersonality({ values: { agency: -1 } });

    expect(store.getState().personality.values).toEqual({ valence: 1, agency: -1 });
    expect(api.patchPersonality).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);

    expect(api.patchPersonality).toHaveBeenCalledTimes(1);
    expect(api.patchPersonality).toHaveBeenCalledWith({ values: { valence: 1, agency: -1 } });
  });

  it("applies the server's view, including its derived prompt", async () => {
    const serverView = { personality: samplePersonality({ values: { valence: 1, agency: 0 } }), derived: sampleDerived({ prompt: "New prompt" }) };
    const { store } = createReadyStore({ api: createFakeApi({ patchPersonality: vi.fn().mockResolvedValue(serverView) }) });

    store.getState().changePersonality({ values: { valence: 1 } });
    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);

    expect(store.getState().derived.prompt).toBe("New prompt");
  });

  it("leaves master-dial moves for the server to work out", async () => {
    const { store, api } = createReadyStore();

    store.getState().changePersonality({ metatraits: { stability: 1 } });

    expect(store.getState().personality.metatraits).toBeUndefined();
    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);
    expect(api.patchPersonality).toHaveBeenCalledWith({ metatraits: { stability: 1 } });
  });

  it("ignores a slow reply when a newer change is waiting, so dials don't jump back", async () => {
    let finishFirstRequest;
    const firstReply = new Promise((resolve) => {
      finishFirstRequest = resolve;
    });
    const staleView = { personality: samplePersonality({ values: { valence: 1, agency: 0 } }), derived: sampleDerived() };
    const api = createFakeApi({ patchPersonality: vi.fn().mockReturnValueOnce(firstReply) });
    const { store } = createReadyStore({ api });

    store.getState().changePersonality({ values: { valence: 1 } });
    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);
    store.getState().changePersonality({ values: { valence: 2 } });
    finishFirstRequest(staleView);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState().personality.values.valence).toBe(2);
  });

  it("shows the error and reloads the saved personality when an update fails", async () => {
    const api = createFakeApi({ patchPersonality: vi.fn().mockRejectedValue(new Error("values.valence must be between -2 and 2.")) });
    const { store } = createReadyStore({ api });

    store.getState().changePersonality({ values: { valence: 1 } });
    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);

    expect(store.getState().toast).toEqual({ message: "values.valence must be between -2 and 2.", kind: "error" });
    expect(api.getPersonality).toHaveBeenCalled();
    expect(store.getState().personality.values.valence).toBe(0);
  });

  it("drops pending dial changes when a whole-personality action runs", async () => {
    const { store, api } = createReadyStore();

    store.getState().changePersonality({ values: { valence: 1 } });
    await store.getState().applyPreset("0");
    await vi.advanceTimersByTimeAsync(PERSONALITY_SYNC_DELAY);

    expect(api.applyPreset).toHaveBeenCalledWith("0");
    expect(api.patchPersonality).not.toHaveBeenCalled();
  });
});

describe("chats", () => {
  it("opens a chat and remembers it for next time", async () => {
    const { store, platform } = createReadyStore();

    await store.getState().openChat("chat-1");

    expect(store.getState().activeChat.id).toBe("chat-1");
    expect(platform.storage.read("oread.chat")).toBe("chat-1");
  });

  it("won't switch chats while a reply is being written", async () => {
    const { store, api } = createReadyStore({ state: { streamingReply: { messageId: "m", text: "" } } });

    await store.getState().openChat("chat-2");

    expect(api.getChat).not.toHaveBeenCalled();
    expect(store.getState().toast.message).toMatch(/Wait for the reply/);
  });

  it("only deletes a chat after confirmation", async () => {
    const platform = createFakePlatform({ confirmAction: vi.fn().mockReturnValue(false) });
    const { store, api } = createReadyStore({ platform });

    await store.getState().deleteChat(sampleChat());
    expect(api.deleteChat).not.toHaveBeenCalled();

    platform.confirmAction.mockReturnValue(true);
    await store.getState().deleteChat(sampleChat());
    expect(api.deleteChat).toHaveBeenCalledWith("chat-1");
  });

  it("opens the next chat after deleting the active one", async () => {
    const api = createFakeApi({ listChats: vi.fn().mockResolvedValue([sampleChat({ id: "chat-2" })]) });
    const { store } = createReadyStore({ api, state: { activeChat: sampleChat() } });

    await store.getState().deleteChat(sampleChat());

    expect(api.getChat).toHaveBeenCalledWith("chat-2");
  });

  it("renames with a trimmed title and skips unchanged titles", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });

    await store.getState().renameActiveChat("First chat");
    expect(api.renameChat).not.toHaveBeenCalled();

    await store.getState().renameActiveChat("  A new name ");
    expect(api.renameChat).toHaveBeenCalledWith("chat-1", "A new name");
  });

  it("saves an edited message and leaves edit mode", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat(), editingMessageId: "message-2" } });

    await store.getState().saveMessageEdit({ id: "message-2" }, "Edited.");

    expect(api.editMessage).toHaveBeenCalledWith("chat-1", "message-2", { content: "Edited." });
    expect(store.getState().editingMessageId).toBeNull();
  });

  it("updates the request preview after the draft changes", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });

    store.getState().setDraft("  next line ");
    await vi.advanceTimersByTimeAsync(300);

    expect(api.getContext).toHaveBeenCalledWith("chat-1", "next line");
    expect(store.getState().context.estimate.total).toBe(1);
  });
});

describe("replies", () => {
  function streamingApi(events) {
    return createFakeApi({
      sendMessage: vi.fn(async (_chatId, _content, { onEvent }) => {
        for (const event of events) {
          onEvent(event);
        }
      }),
    });
  }

  const chatWhileStreaming = sampleChat({
    streaming: true,
    messages: [
      { id: "message-1", role: "user", content: "Hello", ts: 1 },
      { id: "reply-1", role: "assistant", content: "", ts: 2 },
    ],
  });

  it("follows the streamed reply and logs the full exchange", async () => {
    const api = streamingApi([
      { type: "chat", chat: chatWhileStreaming },
      { type: "start", provider: "anthropic", model: "claude", request: { system: "SYSTEM PROMPT", messages: [{ role: "user", content: "Hello" }] } },
      { type: "delta", text: "Hi" },
      { type: "delta", text: " there." },
      { type: "done", usage: { input: 10, output: 2 } },
    ]);
    const { store, platform } = createReadyStore({ api, state: { activeChat: sampleChat() } });
    const streamedTexts = [];
    store.subscribe((state, previousState) => {
      const text = state.streamingReply?.text;
      if (text && text !== previousState.streamingReply?.text) {
        streamedTexts.push(text);
      }
    });

    await store.getState().sendMessage("Hello");

    expect(api.sendMessage).toHaveBeenCalledWith("chat-1", "Hello", expect.any(Object));
    expect(streamedTexts).toEqual(["Hi", "Hi there."]);
    expect(store.getState().streamingReply).toBeNull();
    expect(store.getState().lastExchange).toEqual({ model: "anthropic · claude", usage: { input: 10, output: 2 } });
    const loggedText = platform.logToConsole.mock.calls[0].join(" ");
    expect(loggedText).toContain("SYSTEM PROMPT");
    expect(loggedText).toContain("Hi there.");
  });

  it("shows provider errors from the stream", async () => {
    const api = streamingApi([{ type: "chat", chat: chatWhileStreaming }, { type: "error", message: "Anthropic 401: invalid key" }]);
    const { store } = createReadyStore({ api, state: { activeChat: sampleChat() } });

    await store.getState().sendMessage("Hello");

    expect(store.getState().toast).toEqual({ message: "Anthropic 401: invalid key", kind: "error" });
  });

  it("starts a chat first when none is open, and clears the draft", async () => {
    const api = streamingApi([]);
    const { store } = createReadyStore({ api, state: { draft: "Hello" } });

    await store.getState().sendMessage("Hello");

    expect(api.createChat).toHaveBeenCalled();
    expect(api.sendMessage).toHaveBeenCalledWith("new-chat", "Hello", expect.any(Object));
    expect(store.getState().draft).toBe("");
  });

  it("asks for a reply to the last turn without sending new text", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });

    await store.getState().requestReply();

    expect(api.requestReply).toHaveBeenCalledWith("chat-1", expect.any(Object));
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("stops a reply and then fetches the saved chat", async () => {
    const api = createFakeApi({
      sendMessage: vi.fn((_chatId, _content, { signal }) => {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        });
      }),
    });
    const { store } = createReadyStore({ api, state: { activeChat: sampleChat() } });

    const sending = store.getState().sendMessage("Hello");
    expect(store.getState().isReplyStreaming()).toBe(true);
    store.getState().stopReply();
    await vi.runAllTimersAsync();
    await sending;

    expect(store.getState().isReplyStreaming()).toBe(false);
    expect(store.getState().toast).toBeNull();
    expect(api.getChat).toHaveBeenCalledWith("chat-1");
  });
});

describe("settings", () => {
  it("saves a change and confirms it", async () => {
    const { store, api } = createReadyStore();

    await store.getState().patchSettings({ provider: "gemini" });

    expect(api.patchSettings).toHaveBeenCalledWith({ provider: "gemini" });
    expect(store.getState().toast.message).toBe("Saved");
  });

  it("explains why a change couldn't be saved", async () => {
    const api = createFakeApi({ patchSettings: vi.fn().mockRejectedValue(new Error("provider must be one of …")) });
    const { store } = createReadyStore({ api });

    const saved = await store.getState().patchSettings({ provider: "skynet" });

    expect(saved).toBe(false);
    expect(store.getState().toast).toEqual({ message: "Couldn't save: provider must be one of …", kind: "error" });
  });

  it("exports to a dated file and imports a chosen file", async () => {
    const platform = createFakePlatform({ pickTextFile: vi.fn().mockResolvedValue('{"app":"oread","chats":[]}') });
    const { store, api } = createReadyStore({ platform });

    await store.getState().exportData();
    expect(platform.saveTextFile).toHaveBeenCalledWith(expect.stringMatching(/^oread-\d{4}-\d{2}-\d{2}\.json$/), expect.any(String));

    await store.getState().importData();
    expect(api.importData).toHaveBeenCalledWith({ app: "oread", chats: [] });
    expect(store.getState().toast.message).toBe("Imported 1 chat and the personality.");
  });

  it("rejects an import that isn't JSON", async () => {
    const platform = createFakePlatform({ pickTextFile: vi.fn().mockResolvedValue("not json") });
    const { store, api } = createReadyStore({ platform });

    await store.getState().importData();

    expect(api.importData).not.toHaveBeenCalled();
    expect(store.getState().toast.message).toBe("That file isn't valid JSON.");
  });
});

describe("interface state", () => {
  it("cycles the colour scheme and remembers it", () => {
    const { store, platform } = createReadyStore();

    store.getState().cycleColorScheme();
    expect(store.getState().colorSchemePreference).toBe("light");
    store.getState().cycleColorScheme();
    expect(store.getState().colorSchemePreference).toBe("dark");
    expect(platform.storage.read("oread.colorScheme")).toBe("dark");
  });

  it("hides a toast after a few seconds, errors after longer", () => {
    const { store } = createReadyStore();

    store.getState().showToast("Saved");
    vi.advanceTimersByTime(3200);
    expect(store.getState().toast).toBeNull();

    store.getState().showToast("Broken", "error");
    vi.advanceTimersByTime(3200);
    expect(store.getState().toast).not.toBeNull();
    vi.advanceTimersByTime(2800);
    expect(store.getState().toast).toBeNull();
  });
});
