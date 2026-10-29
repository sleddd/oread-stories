import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme, sampleControls, samplePersonality, sampleDerived, sampleChat, sampleSettings } from "./helpers.jsx";
import {
  AppBar,
  ChatSidebar,
  ChatHeader,
  MessageList,
  Composer,
  SteerPanel,
  ContextPanel,
  Inspector,
  TraitMixer,
  OutputPanel,
  ProviderCard,
} from "../src/components/organisms/index.js";
import { PROVIDERS } from "../src/content/providers.js";

const noMessageHandlers = {
  onSwitchVersion: vi.fn(),
  onRequestReply: vi.fn(),
  onEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onCopy: vi.fn(),
  onDelete: vi.fn(),
};

describe("AppBar", () => {
  it("marks the current section and navigates", async () => {
    const onNavigate = vi.fn();
    renderWithTheme(
      <AppBar
        views={[{ id: "chat", label: "Chat" }, { id: "lore", label: "Lorebook" }]}
        currentView="chat"
        badge={{ label: "Claude · model", isReady: true, title: "" }}
        colorSchemePreference="auto"
        onNavigate={onNavigate}
        onBadgePress={vi.fn()}
        onCycleColorScheme={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Lorebook" }));
    expect(onNavigate).toHaveBeenCalledWith("lore");
  });
});

describe("ChatSidebar", () => {
  it("shows the character, the chats, and an empty state", async () => {
    const onNewChat = vi.fn();
    const { rerender } = renderWithTheme(
      <ChatSidebar characterName="Rowan" mood={{ label: "calm", intensity: "" }} chats={[]} onNewChat={onNewChat} onOpenChat={vi.fn()} onDeleteChat={vi.fn()} onOpenLorebook={vi.fn()} />,
    );
    expect(screen.getByText("Rowan")).toBeInTheDocument();
    expect(screen.getByText("No chats yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(onNewChat).toHaveBeenCalled();

    rerender(
      <ChatSidebar characterName="Rowan" mood={{ label: "calm" }} chats={[{ id: "c", title: "Story", messageCount: 2, updated: Date.now() }]} onNewChat={onNewChat} onOpenChat={vi.fn()} onDeleteChat={vi.fn()} onOpenLorebook={vi.fn()} />,
    );
    expect(screen.getByText("Story")).toBeInTheDocument();
  });
});

describe("ChatHeader", () => {
  it("renames on Enter and shows the mood", async () => {
    const onRename = vi.fn();
    renderWithTheme(<ChatHeader title="Old" isEditable characterName="Rowan" mood={{ label: "sad", intensity: "" }} onRename={onRename} onToggleChats={vi.fn()} onToggleInspector={vi.fn()} />);

    expect(screen.getByText(/Rowan feels/)).toHaveTextContent("Rowan feels sad");
    const title = screen.getByRole("textbox", { name: "Chat title" });
    await userEvent.clear(title);
    await userEvent.type(title, "New title{Enter}");
    expect(onRename).toHaveBeenCalledWith("New title");
  });
});

describe("MessageList", () => {
  it("shows messages, shift markers and the context-window boundary", () => {
    const chat = sampleChat({
      windowStart: 2,
      messages: [
        { id: "a", role: "user", content: "Old question" },
        { id: "b", role: "assistant", content: "Old answer" },
        { id: "c", role: "shift", content: "much more warm" },
        { id: "d", role: "user", content: "New question" },
      ],
    });
    renderWithTheme(<MessageList chat={chat} characterName="Rowan" userName="Kit" handlers={noMessageHandlers} />);

    expect(screen.getByText("Old answer")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Rowan shifts — much more warm");
    expect(screen.getByText(/outside the context window/)).toBeInTheDocument();
    expect(screen.getAllByText("Kit")).toHaveLength(2);
  });

  it("shows the streaming text in place of the saved content", () => {
    const chat = sampleChat({ messages: [{ id: "reply", role: "assistant", content: "" }] });
    renderWithTheme(<MessageList chat={chat} characterName="Rowan" streamingReply={{ messageId: "reply", text: "Writing this" }} isBusy handlers={noMessageHandlers} />);
    expect(screen.getByText("Writing this")).toBeInTheDocument();
  });

  it("invites the first message in an empty chat", () => {
    renderWithTheme(<MessageList chat={sampleChat({ messages: [] })} characterName="Rowan" handlers={noMessageHandlers} />);
    expect(screen.getByText("Rowan is waiting.")).toBeInTheDocument();
  });
});

describe("Composer", () => {
  function renderComposer(overrides = {}) {
    const props = { draft: "Hello", isBusy: false, tokenEstimate: "~12 tokens", pendingShift: null, onDraftChange: vi.fn(), onSend: vi.fn(), onStop: vi.fn(), onUndoShift: vi.fn(), ...overrides };
    renderWithTheme(<Composer {...props} />);
    return props;
  }

  it("sends the trimmed draft on Enter but not on Shift+Enter", () => {
    const props = renderComposer({ draft: "  Hello  " });
    const input = screen.getByRole("textbox", { name: "Message" });

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledWith("Hello");
  });

  it("won't send an empty draft", async () => {
    const props = renderComposer({ draft: "   " });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("turns Send into Stop while a reply is written and hides the pending shift", async () => {
    const props = renderComposer({ isBusy: true, pendingShift: { summary: "far more warm" } });
    expect(screen.getByText("Writing…")).toBeInTheDocument();
    expect(screen.queryByText("far more warm")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(props.onStop).toHaveBeenCalled();
  });

  it("shows the pending shift and token estimate when idle", () => {
    renderComposer({ pendingShift: { summary: "far more warm" } });
    expect(screen.getByText("far more warm")).toBeInTheDocument();
    expect(screen.getByText("~12 tokens")).toBeInTheDocument();
  });
});

describe("SteerPanel", () => {
  it("reports mood, trait and tag changes as personality patches", async () => {
    const onChange = vi.fn();
    renderWithTheme(<SteerPanel controls={sampleControls} personality={samplePersonality()} derived={sampleDerived()} onChange={onChange} onOpenLorebook={vi.fn()} />);

    fireEvent.change(screen.getByRole("slider", { name: "Pleasure" }), { target: { value: "1" } });
    expect(onChange).toHaveBeenLastCalledWith({ mood: { p: 1 } });
    fireEvent.change(screen.getByRole("slider", { name: "Agency" }), { target: { value: "-1.5" } });
    expect(onChange).toHaveBeenLastCalledWith({ values: { agency: -1.5 } });
    await userEvent.click(screen.getByRole("button", { name: "Dry wit" }));
    expect(onChange).toHaveBeenLastCalledWith({ tags: ["dry"] });
  });
});

describe("ContextPanel", () => {
  it("shows the request and copies it as JSON", async () => {
    const onCopy = vi.fn();
    const context = { provider: "anthropic", model: "claude", system: "SYSTEM TEXT", messages: [{ role: "user", content: "Hi" }], estimate: { system: 3, messages: 1, total: 4 } };
    renderWithTheme(<ContextPanel context={context} lastExchange={{ model: "anthropic · claude", usage: { input: 10, output: 5 } }} onCopy={onCopy} />);

    expect(screen.getByText("SYSTEM TEXT")).toBeInTheDocument();
    expect(screen.getByText("~4")).toBeInTheDocument();
    expect(screen.getByText(/10 tokens in, 5 out/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy as JSON" }));
    expect(JSON.parse(onCopy.mock.calls[0][0])).toEqual({ system: "SYSTEM TEXT", messages: [{ role: "user", content: "Hi" }] });
  });

  it("says when no chat is open", () => {
    renderWithTheme(<ContextPanel context={null} onCopy={vi.fn()} />);
    expect(screen.getByText("No chat open.")).toBeInTheDocument();
  });
});

describe("Inspector", () => {
  it("shows only the selected pane", async () => {
    const onSelectTab = vi.fn();
    renderWithTheme(
      <Inspector tabs={[{ id: "steer", label: "Steer" }, { id: "context", label: "Context" }]} selectedTabId="steer" onSelectTab={onSelectTab} panes={{ steer: "Steer pane", context: "Context pane" }} />,
    );
    expect(screen.getByText("Steer pane")).toBeInTheDocument();
    expect(screen.queryByText("Context pane")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(onSelectTab).toHaveBeenCalledWith("context");
  });
});

describe("TraitMixer", () => {
  it("shows band descriptions and warnings, and reports every kind of change", async () => {
    const onChange = vi.fn();
    const derived = sampleDerived({ warnings: ["Sycophancy risk: be careful."] });
    renderWithTheme(<TraitMixer controls={sampleControls} personality={samplePersonality()} derived={derived} onChange={onChange} />);

    expect(screen.getByText("Centered. Your outlook is even.")).toBeInTheDocument();
    expect(screen.getByText("Sycophancy risk: be careful.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Stability" }), { target: { value: "1" } });
    expect(onChange).toHaveBeenLastCalledWith({ metatraits: { stability: 1 } });
    fireEvent.change(screen.getByRole("slider", { name: "Baseline mood" }), { target: { value: "-2" } });
    expect(onChange).toHaveBeenLastCalledWith({ values: { valence: -2 } });
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(onChange).toHaveBeenLastCalledWith({ rules: [{ situation: "upset", axis: "valence", dir: "high", amount: "slight" }] });
  });

  it("describes and removes existing rules", async () => {
    const onChange = vi.fn();
    const personality = samplePersonality({ rules: [{ situation: "upset", axis: "agency", dir: "low", amount: "strong" }] });
    renderWithTheme(<TraitMixer controls={sampleControls} personality={personality} derived={sampleDerived()} onChange={onChange} />);

    expect(screen.getByText("When the person is upset: noticeably more yielding")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith({ rules: [] });
  });
});

describe("OutputPanel", () => {
  it("switches between the prompt and the steering JSON and copies the visible one", async () => {
    const onCopy = vi.fn();
    renderWithTheme(<OutputPanel prompt="THE PROMPT" steering={{ name: "Rowan" }} onCopy={onCopy} />);

    expect(screen.getByText("THE PROMPT")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenLastCalledWith("THE PROMPT");

    await userEvent.click(screen.getByRole("tab", { name: "Steering JSON" }));
    expect(screen.getByText(/"name": "Rowan"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(JSON.parse(onCopy.mock.lastCall[0])).toEqual({ name: "Rowan" });
  });
});

describe("ProviderCard", () => {
  const anthropic = PROVIDERS.find((provider) => provider.id === "anthropic");

  function renderCard(overrides = {}) {
    const props = { provider: anthropic, settings: sampleSettings(), onUse: vi.fn(), onSaveField: vi.fn(), onFetchModels: vi.fn(), onFetched: vi.fn(), onTest: vi.fn(), ...overrides };
    renderWithTheme(<ProviderCard {...props} />);
    return props;
  }

  it("shows the provider's fields with the saved secret masked", () => {
    renderCard();
    const card = screen.getByRole("heading", { name: "Claude" }).closest("section");
    expect(within(card).getByText("Saved …1234")).toBeInTheDocument();
    expect(within(card).getByLabelText("Model")).toHaveValue("claude-sonnet-5-5");
    expect(within(card).getByRole("radio", { name: "Use for chat" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a plain field when it loses focus", async () => {
    const props = renderCard();
    const baseUrl = screen.getByLabelText("Base URL");
    await userEvent.clear(baseUrl);
    await userEvent.type(baseUrl, "https://proxy.example");
    fireEvent.blur(baseUrl);
    expect(props.onSaveField).toHaveBeenCalledWith("anthropic", "baseUrl", "https://proxy.example");
  });

  it("reports a successful connection test and a failed one", async () => {
    const props = renderCard({ onTest: vi.fn().mockResolvedValue({ model: "claude", reply: "ready", ms: 1500 }) });
    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Connected to claude in 1.5s — “ready”")).toBeInTheDocument();

    props.onTest.mockRejectedValue(new Error("Anthropic 401: invalid key"));
    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Anthropic 401: invalid key")).toBeInTheDocument();
  });
});
