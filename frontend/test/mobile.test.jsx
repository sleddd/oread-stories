// The phone layout: the top bar's menu button, the menu sheet (sections, model, theme, sign out),
// the compact chat header with its "…" menu, and the store behind them.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { ChatHeader, MobileAppBar, MobileMenu } from "../src/components/organisms/index.js";
import { renderWithTheme, createFakeApi, createFakePlatform } from "./helpers.jsx";

const VIEWS = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "stories", label: "Stories", icon: "book" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const MODEL = {
  label: "AWS Bedrock · global.anthropic.model",
  providerName: "AWS Bedrock",
  modelName: "global.anthropic.model",
  isReady: true,
};

function renderMenu(overrides = {}) {
  const props = {
    views: VIEWS,
    currentView: "chat",
    model: MODEL,
    colorSchemePreference: "light",
    onNavigate: vi.fn(),
    onOpenSettings: vi.fn(),
    onChooseColorScheme: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithTheme(<MobileMenu {...props} />);
  return props;
}

describe("MobileAppBar", () => {
  it("opens the menu", async () => {
    const onOpenMenu = vi.fn();
    renderWithTheme(<MobileAppBar onOpenMenu={onOpenMenu} />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(onOpenMenu).toHaveBeenCalled();
  });
});

describe("MobileMenu", () => {
  it("lists the sections with the current one selected, and moves between them", async () => {
    const props = renderMenu();
    const sections = screen.getByRole("tablist", { name: "Sections" });
    expect(sections).toHaveTextContent("ChatStoriesSettings");
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Stories" }));
    expect(props.onNavigate).toHaveBeenCalledWith("stories");
  });

  it("shows the model, which opens Settings", async () => {
    const props = renderMenu();
    expect(screen.getByText("AWS Bedrock")).toBeInTheDocument();
    expect(screen.getByText("global.anthropic.model")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Model: AWS Bedrock/ }));
    expect(props.onOpenSettings).toHaveBeenCalled();
  });

  it("chooses light, dark or system", async () => {
    const props = renderMenu();
    expect(screen.getByRole("tab", { name: "Light" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "System" }));
    expect(props.onChooseColorScheme).toHaveBeenCalledWith("auto");
  });

  it("closes, and offers Sign out only when signed in", async () => {
    const props = renderMenu();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("signs out", async () => {
    const onSignOut = vi.fn();
    renderMenu({ onSignOut, signedInAs: "Signed in as ana@example.com" });
    expect(screen.getByText("Signed in as ana@example.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe("compact ChatHeader", () => {
  function renderHeader(overrides = {}) {
    const props = {
      title: "Echo!!",
      isEditable: true,
      isCompact: true,
      onRename: vi.fn(),
      onClear: vi.fn(),
      onToggleChats: vi.fn(),
      onToggleInspector: vi.fn(),
      ...overrides,
    };
    renderWithTheme(<ChatHeader {...props} />);
    return props;
  }

  it("keeps Clear chat in the … menu, and steering behind the sliders", async () => {
    const props = renderHeader();
    expect(screen.queryByRole("button", { name: "Clear chat" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show or hide steering" }));
    expect(props.onToggleInspector).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "More chat actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Clear chat" }));
    expect(props.onClear).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the … menu when pressing elsewhere", async () => {
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "More chat actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("the menu and colour scheme in the store", () => {
  it("opens and closes the menu, and going to a section closes it", () => {
    const store = createAppStore({ api: createFakeApi(), platform: createFakePlatform() });
    store.getState().openMenu();
    expect(store.getState().isMenuOpen).toBe(true);
    store.getState().navigate("settings");
    expect(store.getState().isMenuOpen).toBe(false);
    expect(store.getState().view).toBe("settings");
  });

  it("chooses a colour scheme and remembers it", () => {
    const platform = createFakePlatform();
    const store = createAppStore({ api: createFakeApi(), platform });
    store.getState().chooseColorScheme("dark");
    expect(store.getState().colorSchemePreference).toBe("dark");
    store.getState().chooseColorScheme("sepia");
    expect(store.getState().colorSchemePreference).toBe("dark");
    const reopened = createAppStore({ api: createFakeApi(), platform });
    expect(reopened.getState().colorSchemePreference).toBe("dark");
  });
});
