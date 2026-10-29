// The chat page's side panels: collapsing them on a wide window (remembered on this device),
// sliding them in on a narrow one, and the header buttons that do it.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { ChatHeader } from "../src/components/organisms/index.js";
import { renderWithTheme, createFakeApi, createFakePlatform } from "./helpers.jsx";

function createStore(platform = createFakePlatform()) {
  return { store: createAppStore({ api: createFakeApi(), platform }), platform };
}

describe("side panels on a wide window", () => {
  it("collapse and expand, and are remembered", () => {
    const { store, platform } = createStore();
    expect(store.getState().isChatsPanelCollapsed).toBe(false);

    store.getState().toggleChatsPanel();
    store.getState().toggleSteeringPanel();
    expect(store.getState().isChatsPanelCollapsed).toBe(true);
    expect(store.getState().isSteeringPanelCollapsed).toBe(true);

    const reopened = createAppStore({ api: createFakeApi(), platform });
    expect(reopened.getState().isChatsPanelCollapsed).toBe(true);
    expect(reopened.getState().isSteeringPanelCollapsed).toBe(true);

    store.getState().toggleChatsPanel();
    expect(store.getState().isChatsPanelCollapsed).toBe(false);
    const reopenedAgain = createAppStore({ api: createFakeApi(), platform });
    expect(reopenedAgain.getState().isChatsPanelCollapsed).toBe(false);
  });
});

describe("side panels on a narrow window", () => {
  it("slide in instead of collapsing, and put away together", () => {
    const platform = createFakePlatform({ isScreenAtMost: vi.fn().mockReturnValue(true) });
    const { store } = createStore(platform);

    store.getState().toggleChatsPanel();
    store.getState().toggleSteeringPanel();
    expect(store.getState().isChatsPanelSlidIn).toBe(true);
    expect(store.getState().isSteeringPanelSlidIn).toBe(true);
    expect(store.getState().isChatsPanelCollapsed).toBe(false);

    store.getState().closeSlidInPanels();
    expect(store.getState().isChatsPanelSlidIn).toBe(false);
    expect(store.getState().isSteeringPanelSlidIn).toBe(false);
  });

  it("uses each panel's own width: steering slides in on medium windows too", () => {
    const isScreenAtMost = vi.fn((width) => width >= 1180);
    const { store } = createStore(createFakePlatform({ isScreenAtMost }));

    store.getState().toggleChatsPanel();
    store.getState().toggleSteeringPanel();
    expect(store.getState().isChatsPanelCollapsed).toBe(true);
    expect(store.getState().isSteeringPanelSlidIn).toBe(true);
  });
});

describe("ChatHeader panel buttons", () => {
  it("toggle the chats and steering panels", async () => {
    const props = {
      title: "First chat",
      isEditable: true,
      onRename: vi.fn(),
      onClear: vi.fn(),
      onToggleChats: vi.fn(),
      onToggleInspector: vi.fn(),
    };
    renderWithTheme(<ChatHeader {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Show or hide chats" }));
    await userEvent.click(screen.getByRole("button", { name: "Show or hide steering" }));
    expect(props.onToggleChats).toHaveBeenCalledTimes(1);
    expect(props.onToggleInspector).toHaveBeenCalledTimes(1);
  });
});
