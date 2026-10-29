// Clearing a conversation to start the story over.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { ChatHeader } from "../src/components/organisms/index.js";
import {
  renderWithTheme,
  createFakeApi,
  createFakePlatform,
  sampleChat,
  samplePersonality,
  sampleDerived,
  sampleSettings,
  sampleStoryState,
} from "./helpers.jsx";

function createStore({ api = createFakeApi(), platform = createFakePlatform(), state = {} } = {}) {
  const store = createAppStore({ api, platform });
  store.setState({
    bootStatus: "ready",
    personality: samplePersonality(),
    derived: sampleDerived(),
    settings: sampleSettings(),
    activeChat: sampleChat(),
    ...sampleStoryState(),
    ...state,
  });
  return { store, api, platform };
}

describe("clearing the active chat", () => {
  it("asks first, then empties the chat and clears the draft", async () => {
    const emptied = sampleChat({ title: "New chat", messages: [] });
    const api = createFakeApi({ clearChat: vi.fn().mockResolvedValue(emptied) });
    const { store, platform } = createStore({ api, state: { draft: "half-written" } });

    await store.getState().clearActiveChat();

    expect(platform.confirmAction).toHaveBeenCalledWith(
      expect.stringMatching(/Clear “First chat”/),
    );
    expect(api.clearChat).toHaveBeenCalledWith("chat-1");
    expect(store.getState().activeChat.messages).toEqual([]);
    expect(store.getState().draft).toBe("");
    expect(api.listChats).toHaveBeenCalled();
  });

  it("does nothing when the person cancels", async () => {
    const platform = createFakePlatform({ confirmAction: vi.fn().mockReturnValue(false) });
    const api = createFakeApi({ clearChat: vi.fn() });
    const { store } = createStore({ api, platform });

    await store.getState().clearActiveChat();

    expect(api.clearChat).not.toHaveBeenCalled();
    expect(store.getState().activeChat.messages).toHaveLength(2);
  });

  it("won't clear while a reply is being written", async () => {
    const api = createFakeApi({ clearChat: vi.fn() });
    const { store, platform } = createStore({
      api,
      state: { streamingReply: { messageId: "m", text: "", phase: "writing" } },
    });

    await store.getState().clearActiveChat();

    expect(platform.confirmAction).not.toHaveBeenCalled();
    expect(api.clearChat).not.toHaveBeenCalled();
  });
});

describe("ChatHeader clear button", () => {
  function renderHeader(overrides = {}) {
    const props = {
      title: "First chat",
      isEditable: true,
      characterName: "Rowan",
      mood: { label: "calm", intensity: "" },
      onRename: vi.fn(),
      onToggleChats: vi.fn(),
      onToggleInspector: vi.fn(),
      onClear: vi.fn(),
      ...overrides,
    };
    renderWithTheme(<ChatHeader {...props} />);
    return props;
  }

  it("clears the conversation when pressed", async () => {
    const props = renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(props.onClear).toHaveBeenCalled();
  });

  it("is disabled when no chat is open", () => {
    renderHeader({ isEditable: false });
    expect(screen.getByRole("button", { name: "Clear chat" })).toBeDisabled();
  });
});
