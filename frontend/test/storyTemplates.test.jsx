// Pre-built stories and the story dropdown: the picker, starting a story from a template, the
// new overview fields, the opening narration in the transcript, and the store actions.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  StoryChooser,
  NewStoryPanel,
  StoryOverviewForm,
  MessageList,
  ChatSidebar,
} from "../src/components/organisms/index.js";
import { StoryPicker, NarrationBlock } from "../src/components/molecules/index.js";
import { createAppStore } from "../src/store/index.js";
import {
  describeCastNames,
  describeTemplateOption,
  describeMemorySource,
} from "../src/lib/describeStory.js";
import {
  renderWithTheme,
  createFakeApi,
  createFakePlatform,
  sampleChat,
  sampleControls,
  sampleDerived,
  samplePersonality,
  sampleSettings,
  sampleStory,
  sampleStoryState,
  sampleStorySummary,
  sampleStoryTemplate,
} from "./helpers.jsx";

const stories = [
  sampleStorySummary(),
  sampleStorySummary({ id: "harbor", title: "The harbor", characterCount: 2 }),
];

function createReadyStore({ api = createFakeApi(), platform = createFakePlatform() } = {}) {
  const store = createAppStore({ api, platform });
  store.setState({
    bootStatus: "ready",
    controls: sampleControls,
    personality: samplePersonality(),
    derived: sampleDerived(),
    settings: sampleSettings(),
    ...sampleStoryState(),
  });
  return { store, api, platform };
}

describe("template wording", () => {
  it("names the cast and the shelf", () => {
    expect(describeCastNames(["Ann"])).toBe("With Ann.");
    expect(describeCastNames(["Ann", "Bea", "Cal"])).toBe("With Ann, Bea and Cal.");
    expect(describeTemplateOption(sampleStoryTemplate())).toBe("Whodunnit Manor · Mystery");
    expect(describeTemplateOption(sampleStoryTemplate({ category: "other" }))).toBe(
      "Whodunnit Manor",
    );
    expect(describeMemorySource("template", {})).toBe("From the story template");
  });
});

describe("StoryPicker", () => {
  it("switches to another story, and ignores the one already open", async () => {
    const onSelect = vi.fn();
    renderWithTheme(<StoryPicker stories={stories} activeStoryId="my-story" onSelect={onSelect} />);
    const picker = screen.getByRole("combobox", { name: "Story" });
    expect(picker).toHaveValue("my-story");
    await userEvent.selectOptions(picker, "harbor");
    expect(onSelect).toHaveBeenCalledWith("harbor");
  });

  it("is the story dropdown in the chat sidebar too", async () => {
    const onSwitchStory = vi.fn();
    renderWithTheme(
      <ChatSidebar
        stories={stories}
        activeStoryId="my-story"
        onSwitchStory={onSwitchStory}
        characterName="Rowan"
        mood={{ label: "calm" }}
        chats={[]}
        onNewChat={vi.fn()}
        onOpenChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onEditCharacter={vi.fn()}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Story" }), "harbor");
    expect(onSwitchStory).toHaveBeenCalledWith("harbor");
  });
});

describe("NewStoryPanel", () => {
  function renderPanel() {
    const props = {
      templates: [sampleStoryTemplate()],
      onCreateBlank: vi.fn(),
      onCreateFromTemplate: vi.fn(),
    };
    renderWithTheme(<NewStoryPanel {...props} />);
    return props;
  }

  it("starts a blank story from a title", async () => {
    const props = renderPanel();
    await userEvent.type(screen.getByLabelText("New story title"), "Lighthouse{Enter}");
    expect(props.onCreateBlank).toHaveBeenCalledWith("Lighthouse");
  });

  it("shows a pre-built story's description and cast, then creates it", async () => {
    const props = renderPanel();
    const startFrom = screen.getByRole("combobox", { name: "Start from" });
    await userEvent.selectOptions(startFrom, "whodunnit-manor");
    expect(screen.getByText("A murder in a manor where everyone has a secret.")).toBeVisible();
    expect(screen.getByText("With Colonel Ashford, Vivienne and Mrs. Finch.")).toBeVisible();
    expect(screen.queryByLabelText("New story title")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create “Whodunnit Manor”" }));
    expect(props.onCreateFromTemplate).toHaveBeenCalledWith("whodunnit-manor");
    expect(startFrom).toHaveValue("blank");
  });
});

describe("StoryChooser", () => {
  function renderChooser(activeStoryId) {
    const props = {
      stories,
      activeStoryId,
      templates: [],
      onOpen: vi.fn(),
      onDelete: vi.fn(),
      onCreateBlank: vi.fn(),
      onCreateFromTemplate: vi.fn(),
    };
    renderWithTheme(<StoryChooser {...props} />);
    return props;
  }

  it("never offers to delete My story", () => {
    renderChooser("my-story");
    expect(screen.queryByRole("button", { name: "Delete My story" })).not.toBeInTheDocument();
  });

  it("deletes the open story", async () => {
    const props = renderChooser("harbor");
    await userEvent.click(screen.getByRole("button", { name: "Delete The harbor" }));
    expect(props.onDelete).toHaveBeenCalledWith(stories[1]);
  });
});

describe("StoryOverviewForm rules and opening scene", () => {
  it("saves rules one per line and the opening scene", async () => {
    const onSave = vi.fn();
    const story = sampleStory({ rules: ["Never act for the user."] });
    renderWithTheme(<StoryOverviewForm story={story} onSave={onSave} />);
    const rules = screen.getByLabelText("Rules");
    expect(rules).toHaveValue("Never act for the user.");

    await userEvent.type(rules, "{Enter}{Enter}Keep it short.");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({
      rules: ["Never act for the user.", "Keep it short."],
    });

    await userEvent.type(screen.getByLabelText("Opening scene"), "Rain on the window.");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ openingScene: "Rain on the window." });
  });
});

describe("opening narration", () => {
  it("shows as narration, with no speaker and no message tools", () => {
    const chat = sampleChat({
      messages: [{ id: "n1", role: "narration", content: "Lightning splits the sky." }],
      windowStart: 0,
    });
    renderWithTheme(
      <MessageList chat={chat} characterName="Rowan" userName="You" handlers={{}} isBusy={false} />,
    );
    const narration = screen.getByRole("note", { name: "Narration" });
    expect(narration).toHaveTextContent("Lightning splits the sky.");
    expect(screen.queryByText("Rowan")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  it("renders actions in the narration text", () => {
    renderWithTheme(<NarrationBlock text="*thunder* The lights go out." />);
    expect(screen.getByText("thunder")).toBeInTheDocument();
  });
});

describe("store: pre-built stories", () => {
  it("lists them at start-up, and works without them", async () => {
    const { store, api } = createReadyStore();
    await store.getState().openFirstStory();
    expect(api.listStoryTemplates).toHaveBeenCalled();
    expect(store.getState().storyTemplates).toEqual([sampleStoryTemplate()]);

    const failingApi = createFakeApi({
      listStoryTemplates: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const failing = createReadyStore({ api: failingApi });
    await failing.store.getState().openFirstStory();
    expect(failing.store.getState().storyTemplates).toEqual([]);
    expect(failing.store.getState().toast).toBeNull();
  });

  it("creates a story from a template and opens its overview", async () => {
    const manor = sampleStory({ id: "manor-1", title: "Whodunnit Manor" });
    const api = createFakeApi({ getStory: vi.fn().mockResolvedValue(manor) });
    const { store } = createReadyStore({ api });
    store.setState({ storyEditorTabId: "world" });

    await store.getState().createStoryFromTemplate("whodunnit-manor");

    expect(api.createStoryFromTemplate).toHaveBeenCalledWith("whodunnit-manor");
    expect(api.listStories).toHaveBeenCalled();
    expect(store.getState().activeStoryId).toBe("manor-1");
    expect(store.getState().storyEditorTabId).toBe("overview");
  });

  it("shows an error when a template can't be used", async () => {
    const api = createFakeApi({
      createStoryFromTemplate: vi.fn().mockRejectedValue(new Error("No such template")),
    });
    const { store } = createReadyStore({ api });
    await store.getState().createStoryFromTemplate("nowhere");
    expect(store.getState().toast?.message ?? store.getState().toast).toBeTruthy();
  });
});
