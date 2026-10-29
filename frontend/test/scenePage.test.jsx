// The scene lives in the chat's side panel now, under its own Scene tab, and Settings warns when
// replies are too short for a story turn's hidden notes.
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "../src/store/index.js";
import { ChatPage } from "../src/pages/ChatPage.jsx";
import { SettingsPage } from "../src/pages/SettingsPage.jsx";
import {
  renderWithTheme,
  sampleChat,
  sampleControls,
  sampleDerived,
  samplePersonality,
  sampleSettings,
  sampleStoryState,
} from "./helpers.jsx";

const initialState = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initialState, true);
});

function openChatPage(chatOverrides = {}) {
  useAppStore.setState({
    bootStatus: "ready",
    controls: sampleControls,
    personality: samplePersonality(),
    derived: sampleDerived(),
    settings: sampleSettings(),
    activeChat: sampleChat(chatOverrides),
    ...sampleStoryState(),
  });
  renderWithTheme(<ChatPage />);
}

describe("the Scene tab", () => {
  it("keeps the scene out of the chat header and shows it under its own tab", async () => {
    openChatPage({
      scene: { location: "the bakery", present: [], withinReach: [] },
      turnLog: [{ messageId: "m2", turn: 2, isSceneReplaced: true, memory: [], worldState: [] }],
    });
    // The Steer tab is open, so nothing else on the page may show the scene bar.
    expect(screen.queryByRole("group", { name: "In the scene" })).toBeNull();
    expect(screen.queryByText("No scene set yet.")).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Scene" }));

    expect(screen.getByRole("group", { name: "In the scene" })).toBeInTheDocument();
    expect(screen.getByText("the bakery")).toBeInTheDocument();
    expect(screen.getByText("Updated on turn 2")).toBeInTheDocument();
  });
});

describe("the reply length warning", () => {
  function openSettings(maxTokens) {
    useAppStore.setState({
      bootStatus: "ready",
      settings: sampleSettings({ generation: { maxTokens, temperature: "" } }),
    });
    renderWithTheme(<SettingsPage />);
  }

  it("warns when replies are too short for a story turn's notes", () => {
    openSettings(1024);
    expect(
      screen.getByText("Story turns need about 2048 so the hidden notes fit."),
    ).toBeInTheDocument();
  });

  it("stays quiet at 2048 and above", () => {
    openSettings(2048);
    expect(screen.queryByText(/Story turns need about 2048/)).toBeNull();
  });
});
