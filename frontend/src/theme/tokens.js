// Design tokens: the colours, type, spacing and radii every component styles itself with.
// Kept as plain values so the same tokens work in styled-components for web and React Native.

const lightColors = {
  background: "#efe6d2",
  panel: "#f7f0e1",
  ink: "#2b2019",
  muted: "#6e5d4e",
  line: "#cdbb9d",
  accent: "#b8741a",
  glow: "#e8a33d",
  positive: "#3f7a6e",
  danger: "#8a2f2f",
  dialTrack: "#e9dcc0",
  chip: "#e6d8bb",
  field: "#fffaf0",
  userBubble: "#e3d4b5",
  characterBubble: "#fbf6ea",
  onAccent: "#1f1814",
  onPositive: "#ffffff",
};

const darkColors = {
  background: "#1f1814",
  panel: "#2a211b",
  ink: "#f0e5cf",
  muted: "#b4a28b",
  line: "#4a3b30",
  accent: "#e8a33d",
  glow: "#f2b955",
  positive: "#6fb3a3",
  danger: "#d77a6b",
  dialTrack: "#33281f",
  chip: "#3a2e25",
  field: "#241c17",
  userBubble: "#3b2f25",
  characterBubble: "#2a211b",
  onAccent: "#1f1814",
  onPositive: "#ffffff",
};

const fonts = {
  interface: "'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif",
  serif: "Spectral, Georgia, serif",
  monospace: "ui-monospace, Menlo, Consolas, monospace",
};

const fontSizes = {
  small: "13.5px",
  label: "15px",
  body: "17px",
  heading3: "18px",
  heading2: "22px",
  heading1: "clamp(28px, 4.5vw, 42px)",
};

const spacing = {
  extraSmall: "4px",
  small: "8px",
  medium: "12px",
  large: "16px",
  extraLarge: "24px",
};

const radii = {
  small: "6px",
  medium: "10px",
  pill: "999px",
};

export function createTheme(colorScheme) {
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  return { colorScheme, colors, fonts, fontSizes, spacing, radii };
}
