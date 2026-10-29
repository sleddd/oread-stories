// The Stories components and the story parts of the chat: overview, cast, abilities, skills,
// memory, world, present cast, scene, speakers and "what changed".
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  StoryOverviewForm,
  CastList,
  AbilityChart,
  SkillTable,
  MemoryEditor,
  WorldNotesEditor,
  WorldStateEditor,
  PresentCastBar,
  ScenePanel,
  TurnChanges,
  MessageList,
} from "../src/components/organisms/index.js";
import { KeywordInput } from "../src/components/molecules/index.js";
import {
  abilityModifier,
  describeMemorySource,
  describeTurnChanges,
} from "../src/lib/describeStory.js";
import {
  renderWithTheme,
  sampleChat,
  sampleCharacter,
  sampleMemoryEntry,
  sampleStory,
  sampleStorySummary,
} from "./helpers.jsx";

describe("describeStory helpers", () => {
  it("works out tabletop modifiers", () => {
    expect(abilityModifier(10)).toBe("+0");
    expect(abilityModifier(14)).toBe("+2");
    expect(abilityModifier(8)).toBe("−1");
  });

  it("says where a memory came from", () => {
    const lookups = {
      characterNameFor: () => "Mara",
      chatTitleFor: () => "The harbor",
    };
    expect(describeMemorySource("user", lookups)).toBe("Written by you");
    expect(describeMemorySource({ chatId: "c", turn: 3 }, lookups)).toBe("The harbor, turn 3");
    expect(describeMemorySource({ chatId: "c", turn: 3, toldBy: "m" }, lookups)).toBe(
      "Told by Mara · The harbor, turn 3",
    );
  });

  it("reads changes from the stream and from the turn log alike", () => {
    const fromStream = describeTurnChanges({
      memory: [{ characterName: "Mara", op: "add", before: null, after: { text: "Opy." } }],
      worldState: [{ op: "set", subject: "window", before: null, after: { fact: "broken" } }],
    });
    const fromLog = describeTurnChanges({
      memory: [{ characterName: "Mara", op: "add", text: "Opy." }],
      worldState: [{ op: "set", subject: "window", fact: "broken" }],
    });
    expect(fromStream.map((line) => line.text)).toEqual(fromLog.map((line) => line.text));
    expect(fromLog.map((line) => line.text)).toEqual(["Mara remembered: Opy.", "window: broken"]);
  });

  it("describes skill changes", () => {
    const lines = describeTurnChanges({
      updates: [
        { characterName: "Mara", type: "skill", name: "Lockpicking", from: 2, to: 3 },
        { characterName: "Mara", type: "skill", name: "Sailing", from: null, to: 1 },
      ],
    });
    expect(lines.map((line) => line.text)).toEqual([
      "Mara's Lockpicking rose 2 → 3",
      "Mara learned Sailing (1)",
    ]);
  });
});

describe("StoryOverviewForm", () => {
  it("saves a field when it loses focus", async () => {
    const onSave = vi.fn();
    renderWithTheme(<StoryOverviewForm story={sampleStory()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Theme"), "Memory is identity");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ theme: "Memory is identity" });
  });
});

describe("CastList", () => {
  it("selects a character and adds a new one with a role", async () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn();
    renderWithTheme(
      <CastList
        characters={[sampleCharacter()]}
        selectedCharacterId="rowan"
        onSelect={onSelect}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit Rowan" }));
    expect(onSelect).toHaveBeenCalledWith("rowan");

    await userEvent.click(screen.getByRole("button", { name: "+ Add character" }));
    await userEvent.type(screen.getByLabelText("New character name"), "Jenny");
    await userEvent.selectOptions(screen.getByLabelText("New character role"), "player");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith({ name: "Jenny", role: "player" });
  });

  it("only offers one player character", async () => {
    renderWithTheme(
      <CastList
        characters={[sampleCharacter({ id: "jenny", name: "Jenny", role: "player" })]}
        selectedCharacterId="jenny"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "+ Add character" }));
    const roleSelect = screen.getByLabelText("New character role");
    expect(within(roleSelect).queryByRole("option", { name: "Played by you" })).toBeNull();
  });
});

describe("AbilityChart", () => {
  it("raises a score by one and shows its modifier", async () => {
    const onChange = vi.fn();
    const abilities = { ...sampleCharacter().abilities, strength: 14 };
    renderWithTheme(<AbilityChart abilities={abilities} onChange={onChange} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Raise Strength" }));
    expect(onChange).toHaveBeenCalledWith({ strength: 15 });
  });

  it("won't go past the top of the scale", () => {
    const abilities = { ...sampleCharacter().abilities, charisma: 20 };
    renderWithTheme(<AbilityChart abilities={abilities} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Raise Charisma" })).toBeDisabled();
  });
});

describe("SkillTable", () => {
  it("keeps edits local until saved, and drops unnamed rows", async () => {
    const onSave = vi.fn();
    renderWithTheme(
      <SkillTable skills={[{ id: "s1", name: "Sailing", level: 2, note: "" }]} onSave={onSave} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Raise Sailing" }));
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Add skill" }));
    await userEvent.click(screen.getByRole("button", { name: "Save skills" }));
    expect(onSave).toHaveBeenCalledWith([{ id: "s1", name: "Sailing", level: 3, note: "" }]);
  });
});

describe("MemoryEditor", () => {
  const identity = sampleMemoryEntry({
    id: "identity-1",
    kind: "identity",
    text: "I am the keeper of the light.",
    source: "user",
  });
  const person = sampleMemoryEntry({ source: { chatId: "chat-1", turn: 2, toldBy: "jenny" } });

  function renderEditor(overrides = {}) {
    const handlers = {
      onAdd: vi.fn(),
      onSave: vi.fn(),
      onDelete: vi.fn(),
      onSearch: vi.fn(),
      onClearSearch: vi.fn(),
    };
    const sourceLabelFor = (source) => {
      if (source === "user") {
        return "Written by you";
      }
      return "Told by Jenny · First chat, turn 2";
    };
    renderWithTheme(
      <MemoryEditor
        characterName="Rowan"
        entries={[person, identity]}
        search={{ query: "", status: "idle", results: [] }}
        sourceLabelFor={sourceLabelFor}
        handlers={handlers}
        {...overrides}
      />,
    );
    return handlers;
  }

  it("puts identity first and groups the rest by kind, with where each came from", () => {
    renderEditor();
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual(["Identity", "In the middle of", "People"]);
    expect(screen.getByText("I am the keeper of the light.")).toBeInTheDocument();
    expect(screen.getByText(/Told by Jenny · First chat, turn 2/)).toBeInTheDocument();
  });

  it("edits a memory", async () => {
    const handlers = renderEditor();
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await userEvent.click(editButtons[0]);
    const textBox = screen.getByLabelText("Memory text");
    await userEvent.clear(textBox);
    await userEvent.type(textBox, "I keep the light, and it keeps me.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handlers.onSave).toHaveBeenCalledWith("identity-1", {
      text: "I keep the light, and it keeps me.",
      about: ["Jenny"],
      importance: 3,
    });
  });

  it("adds a memory the user writes", async () => {
    const handlers = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Add a memory" }));
    await userEvent.selectOptions(screen.getByLabelText("Memory kind"), "place");
    await userEvent.type(screen.getByLabelText("New memory text"), "The old house smells of tar.");
    await userEvent.click(screen.getByRole("button", { name: "Add memory" }));
    expect(handlers.onAdd).toHaveBeenCalledWith({
      kind: "place",
      text: "The old house smells of tar.",
      about: [],
      importance: 3,
    });
  });

  it("searches by meaning and says when search isn't ready", async () => {
    const handlers = renderEditor({
      search: { query: "fire", status: "unavailable", results: [] },
    });
    await userEvent.type(screen.getByLabelText("Search memories by meaning"), "the fire{Enter}");
    expect(handlers.onSearch).toHaveBeenCalledWith("the fire");
    expect(screen.getByText(/isn't ready yet/)).toBeInTheDocument();
  });
});

describe("KeywordInput", () => {
  it("saves a cleaned comma-separated list", async () => {
    const onChange = vi.fn();
    renderWithTheme(<KeywordInput keywords={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Keywords"), " harbor, , boats ");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(["harbor", "boats"]);
  });
});

describe("WorldNotesEditor", () => {
  const note = {
    id: "n1",
    category: "setting",
    title: "The harbor",
    text: "Fog most mornings.",
    keywords: ["harbor"],
    pinned: false,
  };

  it("groups notes by category and pins one", async () => {
    const handlers = { onAdd: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() };
    renderWithTheme(<WorldNotesEditor notes={[note]} handlers={handlers} />);
    expect(screen.getByRole("heading", { name: "Setting & Geography" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: /Pinned/ }));
    expect(handlers.onSave).toHaveBeenCalledWith("n1", { pinned: true });
  });

  it("adds a note in a category", async () => {
    const handlers = { onAdd: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() };
    renderWithTheme(<WorldNotesEditor notes={[]} handlers={handlers} />);
    await userEvent.type(screen.getByLabelText("New world note title"), "The guild");
    await userEvent.selectOptions(screen.getByLabelText("New world note category"), "economy");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(handlers.onAdd).toHaveBeenCalledWith({ title: "The guild", category: "economy" });
  });
});

describe("WorldStateEditor", () => {
  it("adds and removes standing facts", async () => {
    const handlers = { onAdd: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() };
    const fact = { id: "f1", subject: "kitchen window", fact: "broken", keywords: [] };
    renderWithTheme(<WorldStateEditor facts={[fact]} handlers={handlers} />);
    expect(screen.getByText("kitchen window")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove kitchen window" }));
    expect(handlers.onDelete).toHaveBeenCalledWith(fact);

    await userEvent.type(screen.getByLabelText("New fact subject"), "letter");
    await userEvent.type(screen.getByLabelText("New fact"), "on the table");
    await userEvent.click(screen.getByRole("button", { name: "Add fact" }));
    expect(handlers.onAdd).toHaveBeenCalledWith({ subject: "letter", fact: "on the table" });
  });
});

describe("PresentCastBar", () => {
  const characters = [
    sampleCharacter({ id: "mara", name: "Mara" }),
    sampleCharacter({ id: "brann", name: "Brann" }),
  ];

  it("toggles who is in the scene", async () => {
    const onChange = vi.fn();
    renderWithTheme(
      <PresentCastBar characters={characters} presentCharacterIds={["mara"]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Brann" }));
    expect(onChange).toHaveBeenCalledWith(["mara", "brann"]);
  });

  it("keeps at least one character in the scene", async () => {
    const onChange = vi.fn();
    renderWithTheme(
      <PresentCastBar characters={characters} presentCharacterIds={["mara"]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mara" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ScenePanel", () => {
  const characters = [
    sampleCharacter({ id: "mara", name: "Mara" }),
    sampleCharacter({ id: "brann", name: "Brann" }),
  ];
  const scene = {
    location: "the farmhouse kitchen",
    present: ["Mara"],
    withinReach: ["the lantern"],
    timeOfDay: "late evening",
    lastSaid: "",
    inMotion: "Mara's hand on the cellar door",
  };

  function renderPanel(overrides = {}) {
    const props = {
      scene,
      characters,
      presentCharacterIds: ["mara"],
      speakingCharacterId: "mara",
      updatedOnTurn: 4,
      hasPendingChanges: false,
      isDisabled: false,
      onChangePresent: vi.fn(),
      onChangeScene: vi.fn(),
      onDiscard: vi.fn(),
      ...overrides,
    };
    renderWithTheme(<ScenePanel {...props} />);
    return props;
  }

  it("shows the scene the story keeps, who's here and the turn it was updated", () => {
    renderPanel();
    expect(screen.getByText("the farmhouse kitchen")).toBeInTheDocument();
    expect(screen.getByText("late evening")).toBeInTheDocument();
    expect(screen.getByText("the lantern")).toBeInTheDocument();
    expect(screen.getByText("Mara's hand on the cellar door")).toBeInTheDocument();
    expect(screen.queryByText("Last said")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "In the scene" })).toBeInTheDocument();
    expect(screen.getByText("Updated on turn 4")).toBeInTheDocument();
  });

  it("says the scene fills in with play when it's empty, and never asks you to set it", () => {
    renderPanel({ scene: null, updatedOnTurn: null });
    expect(screen.getByText("The scene fills in as the story is played.")).toBeInTheDocument();
    expect(screen.queryByText(/No scene set yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated on turn/)).not.toBeInTheDocument();
  });

  it("hands edits on, splitting lists", async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Edit scene" }));
    await userEvent.clear(screen.getByLabelText("Within reach"));
    await userEvent.type(screen.getByLabelText("Within reach"), "the lantern, the letter");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onChangeScene).toHaveBeenCalledWith({
      ...scene,
      withinReach: ["the lantern", "the letter"],
    });
  });

  it("marks waiting edits and lets you discard them", async () => {
    const props = renderPanel({ hasPendingChanges: true });
    expect(screen.getByRole("status")).toHaveTextContent("Applies with your next message.");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(props.onDiscard).toHaveBeenCalled();
  });
});

describe("TurnChanges", () => {
  it("stays closed until asked, then lists the changes by group", async () => {
    renderWithTheme(
      <TurnChanges
        turnChanges={{
          memory: [{ characterName: "Mara", op: "add", text: "Jenny calls me Opy." }],
          worldState: [{ op: "remove", subject: "letter" }],
        }}
      />,
    );
    expect(screen.queryByText(/Mara remembered/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "What changed: 2" }));
    expect(screen.getByText("Mara remembered: Jenny calls me Opy.")).toBeInTheDocument();
    expect(screen.getByText("No longer true: letter")).toBeInTheDocument();
  });

  it("shows nothing for a turn that changed nothing", () => {
    renderWithTheme(<TurnChanges turnChanges={{}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("MessageList with a cast", () => {
  const handlers = {
    onSwitchVersion: vi.fn(),
    onRequestReply: vi.fn(),
    onEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
  };

  it("labels each reply with its speaker, without a name line, and shows what it changed", () => {
    const chat = sampleChat({
      messages: [
        { id: "message-1", role: "user", content: "Hello", ts: 1 },
        { id: "message-2", role: "assistant", content: "Evening.", ts: 2, speakerId: "mara" },
      ],
    });
    const speakers = { mara: { name: "Mara" } };
    renderWithTheme(
      <MessageList
        chat={chat}
        characterName="Rowan"
        userName="You"
        speakerFor={(speakerId) => speakers[speakerId] ?? null}
        turnChangesFor={() => ({ memory: [{ characterName: "Mara", op: "add", text: "Hi." }] })}
        streamingReply={null}
        editingMessageId={null}
        isBusy={false}
        handlers={handlers}
      />,
    );
    expect(screen.getByRole("group", { name: "Mara" })).toHaveTextContent("Evening.");
    expect(screen.queryByText("Mara")).not.toBeInTheDocument();
    expect(screen.queryByText("Rowan")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What changed: 1" })).toBeInTheDocument();
  });
});
