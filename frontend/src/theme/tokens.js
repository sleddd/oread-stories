// Design tokens: the colours, type, spacing and radii every component styles itself with.
// Kept as plain values so the same tokens work in styled-components for web and React Native.
import { findAccentPreset, DEFAULT_ACCENT_ID } from "./accents.js";

// Cool slate neutrals. `panel` is a card, `raised` sits on top of a card (a selected segment),
// `field` fills inputs. Text colours keep WCAG AA contrast on both `background` and `panel`.
// The accent colours come from the chosen preset in accents.js.
const lightColors = {
  background: "#eef0f3",
  panel: "#ffffff",
  raised: "#ffffff",
  header: "#ffffff",
  ink: "#1d2733",
  muted: "#5b6878",
  line: "#d9dee5",
  lineStrong: "#c3cad4",
  positive: "#2f7a50",
  danger: "#a8322d",
  dialTrack: "#e6eaef",
  chip: "#eef1f5",
  segment: "#eef0f3",
  field: "#f4f6f9",
  characterBubble: "#ffffff",
  onPositive: "#ffffff",
  onDanger: "#ffffff",
  shadow: "rgba(29, 39, 51, 0.18)",
  // Dims the page behind a sheet or menu.
  scrim: "rgba(29, 39, 51, 0.42)",
};

const darkColors = {
  background: "#0f1318",
  panel: "#161c24",
  raised: "#1e2631",
  header: "#131920",
  ink: "#e6eaf0",
  muted: "#9aa6b5",
  line: "#262e3a",
  lineStrong: "#344052",
  positive: "#6fbf8e",
  danger: "#e8907f",
  dialTrack: "#1c232d",
  chip: "#1c232d",
  segment: "#11161d",
  field: "#1a212b",
  characterBubble: "#161c24",
  onPositive: "#0f1318",
  onDanger: "#0f1318",
  shadow: "rgba(0, 0, 0, 0.45)",
  scrim: "rgba(0, 0, 0, 0.6)",
};

const fonts = {
  interface: "'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif",
  serif: "Spectral, Georgia, serif",
  monospace: "ui-monospace, Menlo, Consolas, monospace",
};

const fontSizes = {
  small: "13.5px",
  label: "15px",
  eyebrow: "12px",
  body: "17px",
  heading3: "18px",
  heading2: "22px",
  heading1: "clamp(32px, 5vw, 46px)",
};

const spacing = {
  extraSmall: "4px",
  small: "8px",
  medium: "12px",
  large: "16px",
  extraLarge: "24px",
};

const radii = {
  small: "8px",
  medium: "12px",
  pill: "999px",
};

const layout = {
  pageWidth: "1240px",
  // Messages, the composer and transcript notes fill the conversation column up to this width,
  // so collapsing a side panel gives the chat more room while lines stay readable.
  conversationWidth: "1100px",
};

// The accent's tint doubles as the focus glow and the background of your own messages.
function accentColorsFor(colorScheme, accentId) {
  const accentValues = findAccentPreset(accentId)[colorScheme];
  return { ...accentValues, glow: accentValues.accent, userBubble: accentValues.accentSoft };
}

export function createTheme(colorScheme, accentId = DEFAULT_ACCENT_ID) {
  const neutralColors = colorScheme === "dark" ? darkColors : lightColors;
  const colors = { ...neutralColors, ...accentColorsFor(colorScheme, accentId) };
  return { colorScheme, accentId, colors, fonts, fontSizes, spacing, radii, layout };
}
