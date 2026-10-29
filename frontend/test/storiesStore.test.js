// The stories slice and the story-aware parts of the chat and reply slices: opening stories,
// the selected character, memory, world, present cast, scene, and the turn's stream events.
import { describe, it, expect, vi } from "vitest";
import { createAppStore } from "../src/store/index.js";
import { ApiError } from "../src/api/ApiError.js";
import {
  createFakeApi,
  createFakePlatform,
  sampleChat,
  sampleCharacter,
  sampleControls,
  sampleDerived,
  sampleMemoryEntry,
  samplePersonality,
  sampleSettings,
  sampleStory,
  sampleStoryState,
  sampleStorySummary,
  SAMPLE_CHARACTER,
} from "./helpers.jsx";

function createReadyStore({
  api = createFakeApi(),
  platform = createFakePlatform(),
  state = {},
} = {}) {
  const store = createAppStore({ api, platform });
  store.setState({
    bootStatus: "ready",
    controls: sampleControls,
    personality: samplePersonality(),
    derived: sampleDerived(),
    settings: sampleSettings(),
    ...sampleStoryState(),
    ...state,
  });
  return { store, api, platform };
}

const twoStories = [
  sampleStorySummary(),
  sampleStorySummary({ id: "harbor", title: "The harbor", characterCount: 2 }),
];

const harborStory = sampleStory({
  id: "harbor",
  title: "The harbor",
  characters: [
    sampleCharacter({ id: "jenny", name: "Jenny", role: "player" }),
    sampleCharacter({ id: "mara", name: "Mara" }),
  ],
});

describe("opening stories", () => {
  it("starts in the remembered story with its first AI character selected", async () => {
    const api = createFakeApi({
      listStories: vi.fn().mockResolvedValue(twoStories),
      getStory: vi.fn().mockResolvedValue(harborStory),
    });
    const platform = createFakePlatform();
    platform.storage.write("oread.story", "harbor");
    const store = createAppStore({ api, platform });

    await store.getState().boot();

    const state = store.getState();
    expect(api.getStory).toHaveBeenCalledWith("harbor");
    expect(state.selectedCharacterId).toBe("mara");
    expect(api.getPersonality).toHaveBeenCalledWith({ storyId: "harbor", characterId: "mara" });
    expect(api.listMemory).toHaveBeenCalledWith({ storyId: "harbor", characterId: "mara" });
    expect(api.listChats).toHaveBeenCalledWith("harbor");
  });

  it("falls back to My story when nothing is remembered", async () => {
    const api = createFakeApi({ listStories: vi.fn().mockResolvedValue(twoStories) });
    const store = createAppStore({ api, platform: createFakePlatform() });

    await store.getState().boot();

    expect(api.getStory).toHaveBeenCalledWith("my-story");
    expect(store.getState().bootStatus).toBe("ready");
  });

  it("closes the open chat and lists the new story's chats when switching", async () => {
    const api = createFakeApi({ getStory: vi.fn().mockResolvedValue(harborStory) });
    const { store } = createReadyStore({
      api,
      state: { view: "stories", activeChat: sampleChat() },
    });

    await store.getState().openStory("harbor");

    expect(store.getState().activeStoryId).toBe("harbor");
    expect(store.getState().activeChat).toBeNull();
    expect(api.listChats).toHaveBeenCalledWith("harbor");
  });

  it("starts a chat in the new story when switching from the Chat view", async () => {
    const api = createFakeApi({ getStory: vi.fn().mockResolvedValue(harborStory) });
    const { store } = createReadyStore({ api, state: { view: "chat", activeChat: sampleChat() } });

    await store.getState().openStory("harbor");

    expect(api.createChat).toHaveBeenCalledWith("harbor");
  });

  it("creates new chats inside the open story", async () => {
    const { store, api } = createReadyStore();

    await store.getState().startNewChat();

    expect(api.createChat).toHaveBeenCalledWith("my-story");
  });

  it("creates a story and opens it", async () => {
    const api = createFakeApi({
      getStory: vi.fn().mockResolvedValue(sampleStory({ id: "story-2", title: "New" })),
    });
    const { store } = createReadyStore({ api });

    await store.getState().createStory("  New  ");

    expect(api.createStory).toHaveBeenCalledWith({ title: "New" });
    expect(store.getState().activeStoryId).toBe("story-2");
  });

  it("asks before deleting a story", async () => {
    const platform = createFakePlatform({ confirmAction: vi.fn().mockReturnValue(false) });
    const { store, api } = createReadyStore({ platform });

    await store.getState().deleteStory(twoStories[1]);

    expect(api.deleteStory).not.toHaveBeenCalled();
  });
});

describe("the cast", () => {
  it("adds a character and selects it", async () => {
    const { store, api } = createReadyStore();

    await store.getState().addCharacter({ name: " Mara ", role: "ai" });

    expect(api.createCharacter).toHaveBeenCalledWith("my-story", { name: "Mara", role: "ai" });
    expect(store.getState().selectedCharacterId).toBe("mara");
  });

  it("saves character fields and shows the server's version", async () => {
    const updated = sampleCharacter({ backstory: "Grew up by the sea." });
    const api = createFakeApi({ updateCharacter: vi.fn().mockResolvedValue(updated) });
    const { store } = createReadyStore({ api });

    await store.getState().saveCharacter({ backstory: "Grew up by the sea." });

    expect(api.updateCharacter).toHaveBeenCalledWith(SAMPLE_CHARACTER, {
      backstory: "Grew up by the sea.",
    });
    expect(store.getState().activeStory.characters[0].backstory).toBe("Grew up by the sea.");
  });

  it("sends waiting dial changes for the old character before switching", async () => {
    vi.useFakeTimers();
    const { store, api } = createReadyStore({
      state: { activeStory: harborStory, activeStoryId: "harbor", selectedCharacterId: "mara" },
    });

    store.getState().changePersonality({ values: { valence: 1 } });
    await store.getState().selectCharacter("jenny");

    expect(api.patchPersonality).toHaveBeenCalledWith(
      { storyId: "harbor", characterId: "mara" },
      { values: { valence: 1 } },
    );
    vi.useRealTimers();
  });
});

describe("memory", () => {
  it("adds a memory for the selected character and reloads the list", async () => {
    const entry = sampleMemoryEntry();
    const api = createFakeApi({ listMemory: vi.fn().mockResolvedValue([entry]) });
    const { store } = createReadyStore({ api });

    await store.getState().addMemoryEntry({ kind: "person", text: entry.text });

    expect(api.addMemory).toHaveBeenCalledWith(SAMPLE_CHARACTER, {
      kind: "person",
      text: entry.text,
    });
    expect(store.getState().memoryEntries).toEqual([entry]);
  });

  it("shows search results", async () => {
    const results = [{ entry: sampleMemoryEntry(), score: 0.8 }];
    const api = createFakeApi({ searchMemory: vi.fn().mockResolvedValue(results) });
    const { store } = createReadyStore({ api });

    await store.getState().searchMemory("the night of the fire");

    expect(api.searchMemory).toHaveBeenCalledWith(SAMPLE_CHARACTER, "the night of the fire");
    expect(store.getState().memorySearch).toEqual({
      query: "the night of the fire",
      status: "done",
      results,
    });
  });

  it("says search isn't ready instead of showing an error when the model is missing", async () => {
    const unavailable = new ApiError({ status: 503, code: "search_unavailable", message: "x" });
    const api = createFakeApi({ searchMemory: vi.fn().mockRejectedValue(unavailable) });
    const { store } = createReadyStore({ api });

    await store.getState().searchMemory("fire");

    expect(store.getState().memorySearch.status).toBe("unavailable");
    expect(store.getState().toast).toBeNull();
  });
});

describe("the world", () => {
  it("adds a world note and reloads the story", async () => {
    const { store, api } = createReadyStore();

    await store.getState().addWorldNote({ title: "The harbor", category: "setting" });

    expect(api.addWorldNote).toHaveBeenCalledWith("my-story", {
      title: "The harbor",
      category: "setting",
    });
    expect(api.getStory).toHaveBeenCalledWith("my-story");
  });

  it("sets a world fact", async () => {
    const { store, api } = createReadyStore();

    await store.getState().setWorldFact({ subject: "kitchen window", fact: "broken" });

    expect(api.setWorldFact).toHaveBeenCalledWith("my-story", {
      subject: "kitchen window",
      fact: "broken",
    });
  });
});

describe("the scene", () => {
  const scene = {
    location: "the kitchen",
    present: [],
    withinReach: [],
    timeOfDay: "",
    lastSaid: "",
    inMotion: "",
  };

  it("holds edits to the scene and the cast without saving them", () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });

    store.getState().setPresentCharacters(["rowan"]);
    store.getState().saveScene(scene);

    expect(api.updateChatScene).not.toHaveBeenCalled();
    expect(store.getState().pendingPresentCharacterIds).toEqual(["rowan"]);
    expect(store.getState().pendingScene).toEqual(scene);
    expect(store.getState().hasPendingSceneChanges()).toBe(true);
  });

  it("saves the waiting edits together, then sends the message", async () => {
    const api = createFakeApi();
    const callOrder = [];
    api.updateChatScene = vi.fn(async () => {
      callOrder.push("scene");
      return sampleChat();
    });
    api.sendMessage = vi.fn(async () => {
      callOrder.push("send");
    });
    const { store } = createReadyStore({ api, state: { activeChat: sampleChat() } });
    store.getState().setPresentCharacters(["rowan"]);
    store.getState().saveScene(scene);

    await store.getState().sendMessage("Hello");

    expect(api.updateChatScene).toHaveBeenCalledWith("chat-1", {
      scene,
      presentCharacterIds: ["rowan"],
    });
    expect(callOrder).toEqual(["scene", "send"]);
    expect(store.getState().hasPendingSceneChanges()).toBe(false);
  });

  it("saves the waiting edits before asking for a reply too", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });
    store.getState().saveScene(scene);

    await store.getState().requestReply();

    expect(api.updateChatScene).toHaveBeenCalledWith("chat-1", { scene });
    expect(api.requestReply).toHaveBeenCalled();
  });

  it("keeps the edits and the draft, and doesn't send, when saving them fails", async () => {
    const failure = new ApiError({ status: 500, code: "server_error", message: "Boom" });
    const api = createFakeApi({ updateChatScene: vi.fn().mockRejectedValue(failure) });
    const { store } = createReadyStore({ api, state: { activeChat: sampleChat() } });
    store.getState().saveScene(scene);
    store.getState().setDraft("Hello");

    await store.getState().sendMessage("Hello");

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(store.getState().pendingScene).toEqual(scene);
    expect(store.getState().draft).toBe("Hello");
    expect(store.getState().toast).not.toBeNull();
  });

  it("discards waiting edits, and drops them when another chat opens", async () => {
    const { store, api } = createReadyStore({ state: { activeChat: sampleChat() } });
    store.getState().saveScene(scene);
    store.getState().discardPendingSceneChanges();
    expect(store.getState().hasPendingSceneChanges()).toBe(false);

    store.getState().setPresentCharacters(["rowan"]);
    await store.getState().openChat("chat-2");
    expect(store.getState().hasPendingSceneChanges()).toBe(false);
    expect(api.updateChatScene).not.toHaveBeenCalled();
  });
});

describe("a turn's stream events", () => {
  function storeStreaming(events, api = createFakeApi()) {
    api.sendMessage = vi.fn(async (_chatId, _content, { onEvent }) => {
      for (const event of events) {
        onEvent(event);
      }
    });
    const streamingChat = sampleChat({ streaming: true });
    api.getChat = vi.fn().mockResolvedValue(sampleChat());
    return createReadyStore({ api, state: { activeChat: streamingChat } });
  }

  it("records the speaker and restarts the text when the reply is started again", async () => {
    const { store } = storeStreaming([
      { type: "chat", chat: sampleChat({ streaming: true }) },
      { type: "speaker", characterId: "rowan", name: "Rowan", switched: false },
      { type: "start", provider: "anthropic", model: "m", request: { system: "", messages: [] } },
      { type: "delta", text: "Wrong voice" },
      { type: "speaker", characterId: "mara", name: "Mara", switched: true },
      { type: "start", provider: "anthropic", model: "m", request: { system: "", messages: [] } },
      { type: "delta", text: "Right voice" },
    ]);
    const seen = [];
    store.subscribe((state) => {
      if (state.streamingReply) {
        seen.push({ ...state.streamingReply });
      }
    });

    await store.getState().sendMessage("Hello");

    const last = seen.at(-1);
    expect(last.speakerId).toBe("mara");
    expect(last.text).toBe("Right voice");
  });

  it("shows 'remembering' while the speaker recalls", async () => {
    const { store } = storeStreaming([
      { type: "recall", characterId: "rowan", name: "Rowan", query: "the fire", found: 2 },
    ]);
    const phases = [];
    store.subscribe((state) => {
      if (state.streamingReply?.phase) {
        phases.push(state.streamingReply.phase);
      }
    });

    await store.getState().sendMessage("Hello");

    expect(phases).toContain("recalling");
  });

  it("keeps the hidden notes' changes for the reply they belong to", async () => {
    const memoryChange = {
      characterId: "rowan",
      characterName: "Rowan",
      op: "add",
      before: null,
      after: { id: "m1", text: "Jenny calls me Opy." },
    };
    const { store } = storeStreaming([
      { type: "done", usage: {} },
      { type: "memory", changes: [memoryChange] },
    ]);

    await store.getState().sendMessage("Hello");

    expect(store.getState().turnChangesByMessageId["message-2"]).toEqual({
      memory: [memoryChange],
    });
  });

  it("shows the story the turn changed", async () => {
    const changedStory = sampleStory({ title: "Changed" });
    const api = createFakeApi({ getStory: vi.fn().mockResolvedValue(changedStory) });
    const { store } = storeStreaming([{ type: "story", story: changedStory }], api);

    await store.getState().sendMessage("Hello");

    expect(store.getState().activeStory.title).toBe("Changed");
  });
});
