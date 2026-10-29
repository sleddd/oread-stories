import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "./helpers.jsx";
import {
  Button,
  Chip,
  Avatar,
  Badge,
  DialSlider,
  RadioOption,
  LinkButton,
  TextField,
  SelectField,
} from "../src/components/atoms/index.js";

describe("Button", () => {
  it("calls onPress when pressed and not when disabled", async () => {
    const onPress = vi.fn();
    const { rerender } = renderWithTheme(<Button label="Send" onPress={onPress} />);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button label="Send" disabled onPress={onPress} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("uses its accessibility label when given one", () => {
    renderWithTheme(<Button label="✕" accessibilityLabel="Delete chat" onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Delete chat" })).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it("reports the opposite of its current state when pressed", async () => {
    const onToggle = vi.fn();
    renderWithTheme(<Chip label="Dry wit" isOn={false} onToggle={onToggle} />);

    const chip = screen.getByRole("button", { name: "Dry wit" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe("Avatar", () => {
  it("shows the name's initial", () => {
    renderWithTheme(<Avatar name="The Steady Mentor" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("shows its label and responds to presses", async () => {
    const onPress = vi.fn();
    renderWithTheme(<Badge label="Claude · claude-sonnet-5-5" isReady onPress={onPress} />);
    await userEvent.click(screen.getByRole("button", { name: /Claude/ }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("DialSlider", () => {
  it("runs from −2 to +2 and reports numbers", () => {
    const onValueChange = vi.fn();
    renderWithTheme(
      <DialSlider value={0} accessibilityLabel="Agency" onValueChange={onValueChange} />,
    );

    const slider = screen.getByRole("slider", { name: "Agency" });
    expect(slider).toHaveAttribute("min", "-2");
    expect(slider).toHaveAttribute("max", "2");
    fireEvent.change(slider, { target: { value: "1.3" } });
    expect(onValueChange).toHaveBeenCalledWith(1.3);
  });
});

describe("RadioOption", () => {
  it("marks the selected option and reports a selection", async () => {
    const onSelect = vi.fn();
    renderWithTheme(<RadioOption label="Use for chat" isSelected={false} onSelect={onSelect} />);

    const option = screen.getByRole("radio", { name: "Use for chat" });
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("LinkButton", () => {
  it("is pressable", async () => {
    const onPress = vi.fn();
    renderWithTheme(<LinkButton label="Open the full lorebook" onPress={onPress} />);
    await userEvent.click(screen.getByRole("button", { name: "Open the full lorebook" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("TextField", () => {
  it("reports typed text, blur and key presses", async () => {
    const onChangeText = vi.fn();
    const onBlur = vi.fn();
    const onKeyPress = vi.fn();
    renderWithTheme(
      <TextField
        accessibilityLabel="Title"
        value=""
        onChangeText={onChangeText}
        onBlur={onBlur}
        onKeyPress={onKeyPress}
      />,
    );

    const field = screen.getByRole("textbox", { name: "Title" });
    await userEvent.type(field, "A");
    expect(onChangeText).toHaveBeenCalledWith("A");
    expect(onKeyPress).toHaveBeenCalledWith(expect.objectContaining({ key: "A", shiftKey: false }));
    fireEvent.blur(field);
    expect(onBlur).toHaveBeenCalled();
  });

  it("hides secrets and offers suggestions", () => {
    const { container } = renderWithTheme(
      <TextField
        accessibilityLabel="API key"
        secureTextEntry
        value=""
        suggestions={[{ value: "claude-sonnet-5-5", label: "Sonnet" }]}
      />,
    );
    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "password");
    expect(container.querySelector("datalist option")).toHaveAttribute(
      "value",
      "claude-sonnet-5-5",
    );
  });
});

describe("SelectField", () => {
  it("lists its items after the placeholder and reports a choice", async () => {
    const onValueChange = vi.fn();
    renderWithTheme(
      <SelectField
        accessibilityLabel="Load a preset"
        placeholder="Load a preset…"
        selectedValue=""
        items={[{ value: "0", label: "The Steady Mentor" }]}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Load a preset" }), "0");
    expect(onValueChange).toHaveBeenCalledWith("0");
  });
});
