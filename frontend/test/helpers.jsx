// Shared test helpers: rendering inside the theme, sample data, and fake API and platform services.
import { render } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { vi } from "vitest";
import { createTheme } from "../src/theme/index.js";

function withTheme(element) {
  return <ThemeProvider theme={createTheme("light")}>{element}</ThemeProvider>;
}

// Renders inside the theme; rerender keeps the theme too.
export function renderWithTheme(element) {
  const result = render(withTheme(element));
  return { ...result, rerender: (nextElement) => result.rerender(withTheme(nextElement)) };
}

export const sampleControls = {
  version: "1.0",
  groups: ["Temperament", "Social"],
  axes: [
    { id: "valence", group: "Temperament", name: "Baseline mood", low: "Gloomy", high: "Sunny" },
    { id: "agency", group: "Social", name: "Agency", low: "Yielding", high: "Commanding" },
  ],
  metatraits: [{ id: "stability", name: "Stability", low: "Labile", high: "Stable", note: "Moves several traits." }],
  tags: [
    { group: "Humor", items: [{ id: "dry", label: "Dry wit", description: "Understated." }] },
    { group: "Register", items: [{ id: "plain", label: "Plain-spoken", description: "Short sentences." }] },
  ],
  situations: [{ id: "upset", text: "the person is upset" }],
  shifts: [
    { id: "slight", word: "somewhat" },
    { id: "strong", word: "noticeably" },
  ],
  presets: [{ id: "0", name: "The Steady Mentor" }],
};

export function samplePersonality(overrides = {}) {
  return {
    name: "Rowan",
    values: { valence: 0, agency: 0 },
    mood: { p: 0, a: 0, d: 0 },
    tags: [],
    rules: [],
    ...overrides,
  };
}

export function sampleDerived(overrides = {}) {
  return {
    mood: { label: "neutral", intensity: "" },
    metatraits: { stability: 0 },
    bands: {
      valence: { band: "mid", pole: "Centered", text: "Your outlook is even." },
      agency: { band: "mid", pole: "Centered", text: "You take the lead when it helps." },
    },
    warnings: [],
    prompt: "Use the following rules…",
    steering: { name: "Rowan" },
    ...overrides,
  };
}

export function sampleChat(overrides = {}) {
  return {
    id: "chat-1",
    title: "First chat",
    created: 1,
    updated: 2,
    messageCount: 2,
    windowStart: 0,
    pendingShift: null,
    streaming: false,
    messages: [
      { id: "message-1", role: "user", content: "Hello", ts: 1 },
      { id: "message-2", role: "assistant", content: "Hi there.", ts: 2 },
    ],
    ...overrides,
  };
}

export function sampleSettings(overrides = {}) {
  return {
    provider: "anthropic",
    anthropic: { model: "claude-sonnet-5-5", baseUrl: "https://api.anthropic.com" },
    openai: { model: "gpt-5-mini", baseUrl: "https://api.openai.com/v1" },
    gemini: { model: "gemini-2.5-flash" },
    bedrock: { region: "us-east-1", model: "" },
    generation: { maxTokens: 1024, temperature: "" },
    memory: { historyWindow: 24 },
    user: { name: "You" },
    secrets: {
      anthropic: { apiKey: { source: "saved", hint: "…1234" } },
      openai: { apiKey: { source: "" } },
      gemini: { apiKey: { source: "" } },
      bedrock: {
        accessKeyId: { source: "" },
        secretAccessKey: { source: "" },
        sessionToken: { source: "" },
        apiKey: { source: "" },
      },
    },
    ...overrides,
  };
}

// Every API method as a mock, resolving to sensible sample data unless a test overrides it.
export function createFakeApi(overrides = {}) {
  const personalityView = { personality: samplePersonality(), derived: sampleDerived() };
  return {
    getLoreControls: vi.fn().mockResolvedValue(sampleControls),
    getPersonality: vi.fn().mockResolvedValue(personalityView),
    patchPersonality: vi.fn().mockResolvedValue(personalityView),
    randomizePersonality: vi.fn().mockResolvedValue(personalityView),
    resetPersonality: vi.fn().mockResolvedValue(personalityView),
    applyPreset: vi.fn().mockResolvedValue(personalityView),
    listChats: vi.fn().mockResolvedValue([]),
    createChat: vi.fn().mockResolvedValue(sampleChat({ id: "new-chat", messages: [] })),
    getChat: vi.fn().mockResolvedValue(sampleChat()),
    renameChat: vi.fn().mockResolvedValue(sampleChat()),
    deleteChat: vi.fn().mockResolvedValue(null),
    editMessage: vi.fn().mockResolvedValue(sampleChat()),
    deleteMessage: vi.fn().mockResolvedValue(sampleChat()),
    getContext: vi.fn().mockResolvedValue({ provider: "anthropic", model: "m", system: "S", messages: [], estimate: { system: 1, messages: 0, total: 1 } }),
    undoShift: vi.fn().mockResolvedValue(personalityView),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    requestReply: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue(sampleSettings()),
    patchSettings: vi.fn().mockResolvedValue(sampleSettings()),
    listModels: vi.fn().mockResolvedValue([]),
    testProvider: vi.fn().mockResolvedValue({ model: "m", reply: "ready", ms: 100 }),
    exportData: vi.fn().mockResolvedValue({ app: "oread" }),
    importData: vi.fn().mockResolvedValue({ imported: { chats: 1, personality: true } }),
    ...overrides,
  };
}

export function createFakePlatform(overrides = {}) {
  const stored = new Map();
  return {
    copyText: vi.fn().mockResolvedValue(true),
    saveTextFile: vi.fn(),
    pickTextFile: vi.fn().mockResolvedValue(null),
    confirmAction: vi.fn().mockReturnValue(true),
    logToConsole: vi.fn(),
    storage: {
      read: (key, fallback = null) => (stored.has(key) ? stored.get(key) : fallback),
      write: (key, value) => stored.set(key, value),
    },
    ...overrides,
  };
}
