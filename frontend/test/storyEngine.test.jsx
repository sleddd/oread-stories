// The story engine in the interface: meters, the switch, the Story panel, and how the store
// handles the engine's stream events.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { Meter, Switch } from "../src/components/atoms/index.js";
import { MeterRow } from "../src/components/molecules/index.js";
import { StoryPanel } from "../src/components/organisms/index.js";
import {
  renderWithTheme,
  createFakeApi,
  createFakePlatform,
  sampleChat,
  sampleControls,
  sampleDerived,
  samplePersonality,
  sampleSettings,
  sampleStoryState,
  SAMPLE_CHARACTER_ID,
} from "./helpers.jsx";

function sampleEngine(overrides = {}) {
  return {
    scene: 3,
    stress: 0.8,
    stressMaximum: 2,
    masterDials: {
      stability: { base: 0.4, effective: -0.4 },
      plasticity: { base: 0, effective: -0.6 },
    },
    baselineMood: { p: 0, a: 0, d: 0 },
    lastAppraisal: {
      goal_impact: -0.6,
      novelty: 0.1,
      control: -0.3,
      social: "rejection",
      threat: 0.5,
      safety: 0.1,
      emotions: [{ label: "disapproval", score: 0.6 }],
    },
    patterns: [
      {
        kind: "rejection",
        repeats: 3,
        effects: [
          { axis: "attach_anxiety", name: "Attachment anxiety", direction: 1 },
          { axis: "communion", name: "Communion", direction: -1 },
        ],
      },
    ],
    drift: [{ axis: "attach_anxiety", name: "Attachment anxiety", total: 0.03 }],
    recentScenes: [{ scene: 3, social: "rejection", threat: 0.5, safety: 0.1, goalImpact: -0.6 }],
    ...overrides,
  };
}

describe("Meter", () => {
  it("reports its value and range", () => {
    renderWithTheme(<Meter value={0.8} maximum={2} accessibilityLabel="Stress" />);
    const meter = screen.getByRole("meter", { name: "Stress" });
    expect(meter).toHaveAttribute("aria-valuenow", "0.8");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "2");
  });

  it("runs from minus to plus the maximum when signed", () => {
    renderWithTheme(<Meter value={-0.5} isSigned accessibilityLabel="Goal impact" />);
    expect(screen.getByRole("meter", { name: "Goal impact" })).toHaveAttribute(
      "aria-valuemin",
      "-1",
    );
  });
});

describe("Switch", () => {
  it("shows its state and reports the opposite when pressed", async () => {
    const onChange = vi.fn();
    renderWithTheme(<Switch label="Story engine" isOn onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Story engine" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("MeterRow", () => {
  it("shows a label, a display value and a meter", () => {
    renderWithTheme(
      <MeterRow label="Stability" value={-0.4} displayValue="+0.4 → −0.4" maximum={2} isSigned />,
    );
    expect(screen.getByText("+0.4 → −0.4")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Stability" })).toBeInTheDocument();
  });
});

describe("StoryPanel", () => {
  function renderPanel(overrides = {}) {
    const props = {
      engine: sampleEngine(),
      isEnabled: true,
      onToggleEnabled: vi.fn(),
      onReset: vi.fn(),
      ...overrides,
    };
    renderWithTheme(<StoryPanel {...props} />);
    return props;
  }

  it("shows stress, master dials, the last scene, patterns, drift and recent scenes", () => {
    renderPanel();
    expect(screen.getByText("Scene 3")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Stress" })).toHaveAttribute("aria-valuenow", "0.8");
    expect(screen.getByText("+0.4 → −0.4")).toBeInTheDocument();
    expect(screen.getByText("Emotions read: disapproval")).toBeInTheDocument();
    expect(
      screen.getByText("rejection ×3 → Attachment anxiety ↑, Communion ↓"),
    ).toBeInTheDocument();
    expect(screen.getByText("Attachment anxiety +0.03")).toBeInTheDocument();
    expect(screen.getByText("Scene 3 · rejection · threat 0.5 · safety 0.1")).toBeInTheDocument();
  });

  it("explains an empty story and an empty chat", () => {
    const { rerender } = renderWithTheme(
      <StoryPanel
        engine={sampleEngine({
          scene: 0,
          lastAppraisal: null,
          patterns: [],
          drift: [],
          recentScenes: [],
        })}
        isEnabled
        onToggleEnabled={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/No scenes yet/)).toBeInTheDocument();
    expect(screen.getByText("No lasting change yet.")).toBeInTheDocument();

    rerender(<StoryPanel engine={null} isEnabled onToggleEnabled={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText("No chat open.")).toBeInTheDocument();
  });

  it("switches the engine and resets the story state", async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole("switch", { name: /Adjust the character/ }));
    expect(props.onToggleEnabled).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Reset story state" }));
    expect(props.onReset).toHaveBeenCalled();
  });
});

describe("store: story engine events", () => {
  function storeStreaming(events, api = createFakeApi()) {
    api.sendMessage = vi.fn(async (_chatId, _content, { onEvent }) => {
      for (const event of events) {
        onEvent(event);
      }
    });
    const store = createAppStore({ api, platform: createFakePlatform() });
    store.setState({
      bootStatus: "ready",
      controls: sampleControls,
      personality: samplePersonality(),
      derived: sampleDerived(),
      settings: sampleSettings(),
      activeChat: sampleChat(),
      ...sampleStoryState(),
    });
    return store;
  }

  it("shows 'reading the scene' while appraising, then moves the dials live", async () => {
    const movedPersonality = samplePersonality({ mood: { p: -1.2, a: 0.8, d: -0.4 } });
    const phases = [];
    const engineView = sampleEngine();
    const movedView = { personality: movedPersonality, derived: sampleDerived() };
    // After the turn the store reloads the dials; the server has saved the moved ones by then.
    const api = createFakeApi({ getPersonality: vi.fn().mockResolvedValue(movedView) });
    const store = storeStreaming(
      [
        { type: "appraising" },
        {
          type: "engine",
          engine: engineView,
          personality: movedView,
          characters: [
            {
              characterId: SAMPLE_CHARACTER_ID,
              name: "Rowan",
              engine: engineView,
              personality: movedView,
            },
          ],
        },
        {
          type: "start",
          provider: "anthropic",
          model: "claude",
          request: { system: "S", messages: [] },
        },
      ],
      api,
    );
    store.subscribe((state) => {
      if (state.streamingReply?.phase) {
        phases.push(state.streamingReply.phase);
      }
    });

    const sending = store.getState().sendMessage("Hello");
    await sending;

    expect(phases).toContain("appraising");
    expect(phases.at(-1)).toBe("writing");
    expect(store.getState().personality.mood).toEqual({ p: -1.2, a: 0.8, d: -0.4 });
  });

  it("puts the engine view on the active chat as soon as the scene is played", async () => {
    const engineView = sampleEngine();
    const store = storeStreaming([
      {
        type: "engine",
        engine: engineView,
        personality: { personality: samplePersonality(), derived: sampleDerived() },
      },
    ]);
    const enginesSeen = [];
    store.subscribe((state) => {
      if (state.activeChat?.engine) {
        enginesSeen.push(state.activeChat.engine);
      }
    });

    await store.getState().sendMessage("Hello");

    expect(enginesSeen[0]).toEqual(engineView);
  });

  it("tells the person when a scene was skipped", async () => {
    const store = storeStreaming([
      { type: "engine_skipped", message: "The story engine skipped this scene: offline" },
    ]);
    await store.getState().sendMessage("Hello");
    expect(store.getState().toast.message).toBe("The story engine skipped this scene: offline");
  });

  it("resets the story state after confirmation", async () => {
    const api = createFakeApi({
      resetStoryEngine: vi
        .fn()
        .mockResolvedValue(sampleChat({ engine: sampleEngine({ scene: 0 }) })),
    });
    const store = storeStreaming([], api);
    await store.getState().resetStoryEngine();
    expect(api.resetStoryEngine).toHaveBeenCalledWith("chat-1");
    expect(store.getState().activeChat.engine.scene).toBe(0);
  });
});
