import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme, sampleControls } from "./helpers.jsx";
import {
  Dial,
  ChipGroup,
  SecretField,
  ModelField,
  Tabs,
  MoodLabel,
  ChatListItem,
  MessageTools,
  MessageBubble,
  RoleplayText,
  ShiftMarker,
  ShiftPending,
  RuleBuilder,
  StatGrid,
  Toast,
} from "../src/components/molecules/index.js";

describe("Dial", () => {
  it("shows the name, formatted value, poles and description, and reports moves", () => {
    const onChange = vi.fn();
    renderWithTheme(
      <Dial name="Agency" lowLabel="Yielding" highLabel="Commanding" value={1.2} description="Leaning commanding." onChange={onChange} />,
    );

    expect(screen.getByText("+1.2")).toBeInTheDocument();
    expect(screen.getByText("Yielding")).toBeInTheDocument();
    expect(screen.getByText("Commanding")).toBeInTheDocument();
    expect(screen.getByText("Leaning commanding.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Agency" }), { target: { value: "-0.5" } });
    expect(onChange).toHaveBeenCalledWith(-0.5);
  });
});

describe("ChipGroup", () => {
  it("adds and removes ids while keeping selections from other groups", async () => {
    const onChange = vi.fn();
    const items = [{ id: "dry", label: "Dry wit" }, { id: "banter", label: "Playful banter" }];
    renderWithTheme(<ChipGroup title="Humor" items={items} selectedIds={["plain", "dry"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Playful banter" }));
    expect(onChange).toHaveBeenLastCalledWith(["plain", "dry", "banter"]);

    await userEvent.click(screen.getByRole("button", { name: "Dry wit" }));
    expect(onChange).toHaveBeenLastCalledWith(["plain"]);
  });
});

describe("SecretField", () => {
  it("never shows the secret, saves a typed value on Enter and clears the box", async () => {
    const onSave = vi.fn();
    renderWithTheme(<SecretField label="API key" secretState={{ source: "saved", hint: "…1234" }} onSave={onSave} onClear={() => {}} />);

    expect(screen.getByText("Saved …1234")).toBeInTheDocument();
    const field = screen.getByLabelText("API key");
    await userEvent.type(field, "  sk-new  {Enter}");
    expect(onSave).toHaveBeenCalledWith("sk-new");
    expect(field).toHaveValue("");
  });

  it("offers Clear only for saved secrets", () => {
    const { rerender } = renderWithTheme(<SecretField label="API key" secretState={{ source: "env", hint: "…9876" }} onSave={() => {}} onClear={() => {}} />);
    expect(screen.getByText("From environment …9876")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();

    rerender(<SecretField label="API key" secretState={{ source: "" }} onSave={() => {}} onClear={() => {}} />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });
});

describe("ModelField", () => {
  it("fetches models into suggestions and reports the count", async () => {
    const onFetched = vi.fn();
    const onFetchModels = vi.fn().mockResolvedValue([{ id: "model-a", label: "Model A" }]);
    const { container } = renderWithTheme(
      <ModelField label="Model" value="" onSave={() => {}} onFetchModels={onFetchModels} onFetched={onFetched} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fetch models" }));

    expect(onFetched).toHaveBeenCalledWith({ count: 1 });
    expect(container.querySelector("datalist option")).toHaveAttribute("value", "model-a");
  });

  it("saves only a changed value when the field loses focus", async () => {
    const onSave = vi.fn();
    renderWithTheme(<ModelField label="Model" value="old" onSave={onSave} onFetchModels={vi.fn()} onFetched={vi.fn()} />);

    const field = screen.getByLabelText("Model");
    fireEvent.blur(field);
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.clear(field);
    await userEvent.type(field, "new-model");
    fireEvent.blur(field);
    expect(onSave).toHaveBeenCalledWith("new-model");
  });
});

describe("Tabs", () => {
  it("marks the selected tab and reports presses", async () => {
    const onSelect = vi.fn();
    renderWithTheme(<Tabs tabs={[{ id: "steer", label: "Steer" }, { id: "context", label: "Context" }]} selectedId="steer" onSelect={onSelect} />);

    expect(screen.getByRole("tab", { name: "Steer" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(onSelect).toHaveBeenCalledWith("context");
  });
});

describe("MoodLabel", () => {
  it("reads as a sentence", () => {
    renderWithTheme(<MoodLabel mood={{ label: "relaxed", intensity: ", strongly" }} />);
    expect(screen.getByText(/Feeling/)).toHaveTextContent("Feeling relaxed, strongly");
  });
});

describe("ChatListItem", () => {
  it("opens on press and deletes from its own button", async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const chat = { id: "chat-1", title: "First chat", messageCount: 4, updated: Date.now() };
    renderWithTheme(<ChatListItem chat={chat} isActive onOpen={onOpen} onDelete={onDelete} />);

    expect(screen.getByText("4 messages · just now")).toBeInTheDocument();
    await userEvent.click(screen.getByText("First chat"));
    expect(onOpen).toHaveBeenCalledWith("chat-1");
    await userEvent.click(screen.getByRole("button", { name: "Delete First chat" }));
    expect(onDelete).toHaveBeenCalledWith(chat);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("MessageTools", () => {
  const handlers = { onSwitchVersion: vi.fn(), onRequestReply: vi.fn(), onEdit: vi.fn(), onCopy: vi.fn(), onDelete: vi.fn() };

  it("offers Regenerate on the last reply and Get reply on a last user message", () => {
    const { rerender } = renderWithTheme(<MessageTools message={{ role: "assistant" }} isLast {...handlers} />);
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();

    rerender(<MessageTools message={{ role: "assistant", error: "Stopped." }} isLast {...handlers} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    rerender(<MessageTools message={{ role: "user" }} isLast {...handlers} />);
    expect(screen.getByRole("button", { name: "Get reply" })).toBeInTheDocument();

    rerender(<MessageTools message={{ role: "user" }} isLast={false} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Get reply" })).not.toBeInTheDocument();
  });

  it("switches between versions and disables the ends", async () => {
    renderWithTheme(<MessageTools message={{ role: "assistant", alts: ["a", "b", "c"], alt: 0 }} isLast {...handlers} />);

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous version" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next version" }));
    expect(handlers.onSwitchVersion).toHaveBeenCalledWith(1);
  });

  it("disables changes while a reply is being written but still allows copying", () => {
    renderWithTheme(<MessageTools message={{ role: "assistant" }} isLast isBusy {...handlers} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
  });
});

describe("MessageBubble", () => {
  const message = { id: "message-1", role: "assistant", content: "Hello *waves*", error: "" };

  it("shows the author, the text and the tools", () => {
    renderWithTheme(<MessageBubble message={message} authorName="Rowan" displayedText={message.content} isLast />);
    expect(screen.getByText("Rowan")).toBeInTheDocument();
    expect(screen.getByText("waves")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("hides the tools while streaming and shows errors", () => {
    renderWithTheme(
      <MessageBubble message={{ ...message, error: "The model returned an empty reply." }} authorName="Rowan" displayedText="Hel" isStreaming isLast />,
    );
    expect(screen.getByText("Hel")).toBeInTheDocument();
    expect(screen.getByText("The model returned an empty reply.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
  });

  it("edits in place and saves the new text", async () => {
    const onSaveEdit = vi.fn();
    renderWithTheme(<MessageBubble message={message} authorName="Rowan" displayedText={message.content} isEditing onSaveEdit={onSaveEdit} onCancelEdit={() => {}} />);

    const editor = screen.getByRole("textbox", { name: "Edit message" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "Changed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveEdit).toHaveBeenCalledWith("Changed");
  });
});

describe("RoleplayText", () => {
  it("renders every piece of the text", () => {
    const { container } = renderWithTheme(<RoleplayText text='She *nods*. "Fine."' />);
    expect(container).toHaveTextContent('She nods. "Fine."');
  });
});

describe("shift notices", () => {
  it("marks a shift in the transcript", () => {
    renderWithTheme(<ShiftMarker characterName="Rowan" summary="much more warm" />);
    expect(screen.getByRole("note")).toHaveTextContent("Rowan shifts — much more warm");
  });

  it("offers to undo a pending shift", async () => {
    const onUndo = vi.fn();
    renderWithTheme(<ShiftPending summary="far more gloomy" onUndo={onUndo} />);
    expect(screen.getByText("far more gloomy")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
  });
});

describe("RuleBuilder", () => {
  it("names the direction after the chosen trait's poles and adds the rule", async () => {
    const onAdd = vi.fn();
    renderWithTheme(<RuleBuilder situations={sampleControls.situations} axes={sampleControls.axes} shifts={sampleControls.shifts} onAdd={onAdd} />);

    const direction = screen.getByRole("combobox", { name: "Direction" });
    expect(within(direction).getByRole("option", { name: "sunny" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Trait" }), "agency");
    expect(within(direction).getByRole("option", { name: "commanding" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Amount" }), "strong");
    await userEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(onAdd).toHaveBeenCalledWith({ situation: "upset", axis: "agency", dir: "high", amount: "strong" });
  });
});

describe("StatGrid and Toast", () => {
  it("lists stats with their labels", () => {
    renderWithTheme(<StatGrid stats={[{ label: "Messages", value: 12 }]} />);
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows the toast message", () => {
    renderWithTheme(<Toast toast={{ message: "Saved", kind: "info" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});
