// Choosing the accent colour: the presets' contrast, the store action and its persistence, and the
// Settings swatches changing the theme.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "styled-components";
import { useStore } from "zustand";
import { createAppStore } from "../src/store/index.js";
import { createTheme, ACCENT_PRESETS, DEFAULT_ACCENT_ID } from "../src/theme/index.js";
import { AccentPicker } from "../src/components/molecules/index.js";
import { Avatar } from "../src/components/atoms/index.js";
import { createFakeApi, createFakePlatform } from "./helpers.jsx";

const AA_TEXT_CONTRAST = 4.5;
const SCHEMES = ["light", "dark"];

function channelLuminance(channel) {
  const fraction = channel / 255;
  if (fraction <= 0.03928) {
    return fraction / 12.92;
  }
  return ((fraction + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor) {
  const channels = [1, 3, 5].map((start) => parseInt(hexColor.slice(start, start + 2), 16));
  const [red, green, blue] = channels.map(channelLuminance);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(firstColor, secondColor) {
  const luminances = [relativeLuminance(firstColor), relativeLuminance(secondColor)];
  const lighter = Math.max(...luminances);
  const darker = Math.min(...luminances);
  return (lighter + 0.05) / (darker + 0.05);
}

function AccentProbe() {
  const theme = useTheme();
  return <output aria-label="Current accent">{theme.colors.accent}</output>;
}

// The real app's wiring in miniature: the store's accent feeds the theme around the swatches.
function AccentHarness({ store }) {
  const accentId = useStore(store, (state) => state.accentId);
  const chooseAccent = useStore(store, (state) => state.chooseAccent);
  return (
    <ThemeProvider theme={createTheme("light", accentId)}>
      <AccentPicker
        presets={ACCENT_PRESETS}
        selectedId={accentId}
        onSelect={chooseAccent}
        accessibilityLabel="Accent colour"
      />
      <AccentProbe />
    </ThemeProvider>
  );
}

describe("accent presets", () => {
  it("keep accent text and text on the accent at WCAG AA in both schemes", () => {
    for (const scheme of SCHEMES) {
      for (const preset of ACCENT_PRESETS) {
        const { colors } = createTheme(scheme, preset.id);
        const label = `${preset.name} (${scheme})`;
        expect(contrastRatio(colors.accent, colors.panel), label).toBeGreaterThanOrEqual(
          AA_TEXT_CONTRAST,
        );
        expect(contrastRatio(colors.accent, colors.background), label).toBeGreaterThanOrEqual(
          AA_TEXT_CONTRAST,
        );
        expect(contrastRatio(colors.onAccent, colors.accent), label).toBeGreaterThanOrEqual(
          AA_TEXT_CONTRAST,
        );
        expect(contrastRatio(colors.accentStrong, colors.accentSoft), label).toBeGreaterThanOrEqual(
          AA_TEXT_CONTRAST,
        );
      }
    }
  });

  it("fall back to the default accent for an unknown id", () => {
    const fallbackTheme = createTheme("dark", "neon");
    expect(fallbackTheme.colors.accent).toBe(createTheme("dark", DEFAULT_ACCENT_ID).colors.accent);
  });
});

describe("chooseAccent", () => {
  it("changes the accent and remembers it on this device", () => {
    const platform = createFakePlatform();
    const store = createAppStore({ api: createFakeApi(), platform });
    expect(store.getState().accentId).toBe(DEFAULT_ACCENT_ID);

    store.getState().chooseAccent("sage");
    expect(store.getState().accentId).toBe("sage");
    expect(platform.storage.read("oread.accent")).toBe("sage");

    const nextVisitStore = createAppStore({ api: createFakeApi(), platform });
    expect(nextVisitStore.getState().accentId).toBe("sage");
  });

  it("ignores unknown accents, stored or chosen", () => {
    const platform = createFakePlatform();
    platform.storage.write("oread.accent", "neon");
    const store = createAppStore({ api: createFakeApi(), platform });
    expect(store.getState().accentId).toBe(DEFAULT_ACCENT_ID);

    store.getState().chooseAccent("neon");
    expect(store.getState().accentId).toBe(DEFAULT_ACCENT_ID);
  });
});

describe("AccentPicker", () => {
  it("offers every preset as a named radio and changes the theme's accent when one is picked", async () => {
    const store = createAppStore({ api: createFakeApi(), platform: createFakePlatform() });
    render(<AccentHarness store={store} />);

    const group = screen.getByRole("radiogroup", { name: "Accent colour" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(ACCENT_PRESETS.length);
    expect(screen.getByRole("radio", { name: "Slate blue" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(screen.getByRole("radio", { name: "Sage" }));
    expect(screen.getByRole("radio", { name: "Sage" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Current accent")).toHaveTextContent(
      createTheme("light", "sage").colors.accent,
    );
  });
});

describe("Avatar", () => {
  function avatarColorsIn(accentId) {
    const { container, unmount } = render(
      <ThemeProvider theme={createTheme("light", accentId)}>
        <Avatar name="Jamie" />
      </ThemeProvider>,
    );
    const circleStyle = getComputedStyle(container.firstChild);
    const colors = {
      fill: circleStyle.backgroundColor,
      ring: circleStyle.borderColor,
      initial: circleStyle.color,
    };
    unmount();
    return colors;
  }

  it("takes its tint, ring and initial from the chosen accent", () => {
    const slateColors = avatarColorsIn("slate");
    const sageColors = avatarColorsIn("sage");
    expect(slateColors.fill).not.toBe("");
    expect(sageColors.fill).not.toBe(slateColors.fill);
    expect(sageColors.ring).not.toBe(slateColors.ring);
    expect(sageColors.initial).not.toBe(slateColors.initial);
  });
});
