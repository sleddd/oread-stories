// Connecting a model provider: the provider cards, the first-run setup's three steps, and
// Settings showing only the chosen provider's fields.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore, useAppStore } from "../src/store/index.js";
import { SetupPage } from "../src/pages/SetupPage.jsx";
import { SettingsPage } from "../src/pages/SettingsPage.jsx";
import { ProviderChooser } from "../src/components/organisms/index.js";
import { PROVIDERS } from "../src/content/providers.js";
import {
  renderWithTheme,
  createFakeApi,
  createFakePlatform,
  sampleSettings,
} from "./helpers.jsx";

const initialState = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initialState, true);
});

describe("ProviderChooser", () => {
  it("offers every provider as a choice, marks the chosen one and the one in use", async () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <ProviderChooser
        providers={PROVIDERS}
        selectedId="featherless"
        activeId="anthropic"
        onSelect={onSelect}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(PROVIDERS.length);
    expect(screen.getByRole("radio", { name: "Featherless" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Claude" })).toHaveTextContent("In use");
    await userEvent.click(screen.getByRole("radio", { name: "Gemini" }));
    expect(onSelect).toHaveBeenCalledWith("gemini");
  });
});

describe("the first-run setup", () => {
  function storeWithSettings(settings = sampleSettings()) {
    const api = createFakeApi({
      patchSettings: vi.fn().mockImplementation(async (change) => ({ ...settings, ...change })),
    });
    const platform = createFakePlatform();
    const store = createAppStore({ api, platform });
    store.setState({ settings, isSetupOpen: true, setupStep: "provider" });
    return { store, api, platform };
  }

  it("moves from choosing a provider to connecting it, and back", async () => {
    const { store, api } = storeWithSettings();
    await store.getState().chooseSetupProvider("featherless");
    expect(api.patchSettings).toHaveBeenCalledWith({ provider: "featherless" });
    expect(store.getState().setupStep).toBe("connect");
    expect(store.getState().setupProviderId).toBe("featherless");
    store.getState().goBackInSetup();
    expect(store.getState().setupStep).toBe("provider");
  });

  it("remembers being skipped on this device, and closes when finished", () => {
    const { store, platform } = storeWithSettings();
    store.getState().skipSetup();
    expect(store.getState().isSetupOpen).toBe(false);
    expect(platform.storage.read("oread.setupSkipped")).toBe("1");

    store.setState({ isSetupOpen: true });
    store.getState().finishSetup();
    expect(store.getState().isSetupOpen).toBe(false);
  });

  it("asks for the key and model, and carries on only once the provider is ready", async () => {
    const settings = sampleSettings({ provider: "openai" });
    const goToSetupStep = vi.fn();
    useAppStore.setState({
      settings,
      isSetupOpen: true,
      setupStep: "connect",
      setupProviderId: "gemini",
      goToSetupStep,
    });
    renderWithTheme(<SetupPage />);
    expect(screen.getByRole("heading", { name: "Connect Gemini" })).toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    settings.secrets.gemini.apiKey = { source: "saved", hint: "…9999" };
    useAppStore.setState({ settings: { ...settings } });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(goToSetupStep).toHaveBeenCalledWith("test");
  });

  it("starts on the provider cards, with a way to skip", async () => {
    const skipSetup = vi.fn();
    useAppStore.setState({
      settings: sampleSettings(),
      isSetupOpen: true,
      setupStep: "provider",
      skipSetup,
    });
    renderWithTheme(<SetupPage />);
    expect(screen.getByRole("heading", { name: "Choose a model provider" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(skipSetup).toHaveBeenCalled();
  });
});

describe("Settings' providers", () => {
  it("shows only the chosen provider's fields, starting with the one in use", async () => {
    useAppStore.setState({ bootStatus: "ready", settings: sampleSettings() });
    renderWithTheme(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Claude" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Featherless" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Featherless" }));
    expect(screen.getByRole("heading", { name: "Featherless" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Claude" })).not.toBeInTheDocument();
  });
});
