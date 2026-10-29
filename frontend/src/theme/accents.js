// The accent colours a person can choose. Each has light- and dark-scheme values for the accent,
// a stronger hover shade, a soft tint for selected rows, chips and their own messages, a border
// for selected controls, and the text colour on a filled accent. Every pair was checked for WCAG
// AA: accent text 4.5:1 on cards, the page and its tint; text on the accent 4.5:1; borders 3:1.

export const DEFAULT_ACCENT_ID = "slate";

export const ACCENT_PRESETS = [
  {
    id: "slate",
    name: "Slate blue",
    light: {
      accent: "#2f4a6b",
      accentStrong: "#273d58",
      accentSoft: "#e2e6ea",
      accentBorder: "#72849a",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#8fb3d9",
      accentStrong: "#a3c1e0",
      accentSoft: "#293441",
      accentBorder: "#5f7791",
      onAccent: "#0f1318",
    },
  },
  {
    id: "sage",
    name: "Sage",
    light: {
      accent: "#3d6a50",
      accentStrong: "#325742",
      accentSoft: "#e4eae6",
      accentBorder: "#7b9a88",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#8fc4a2",
      accentStrong: "#a3cfb3",
      accentSoft: "#293738",
      accentBorder: "#5f8170",
      onAccent: "#0f1318",
    },
  },
  {
    id: "teal",
    name: "Teal",
    light: {
      accent: "#1d6a6f",
      accentStrong: "#18575b",
      accentSoft: "#dfeaeb",
      accentBorder: "#659a9d",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#6cc3c4",
      accentStrong: "#86cecf",
      accentSoft: "#24373e",
      accentBorder: "#4a8084",
      onAccent: "#0f1318",
    },
  },
  {
    id: "violet",
    name: "Violet",
    light: {
      accent: "#5a449e",
      accentStrong: "#4a3882",
      accentSoft: "#e8e5f1",
      accentBorder: "#8f80bd",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#b4a2ea",
      accentStrong: "#c2b3ee",
      accentSoft: "#2f3144",
      accentBorder: "#756c9b",
      onAccent: "#0f1318",
    },
  },
  {
    id: "rose",
    name: "Rose",
    light: {
      accent: "#a1364d",
      accentStrong: "#842c3f",
      accentSoft: "#f2e3e6",
      accentBorder: "#bf7686",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#ec9aac",
      accentStrong: "#efacbb",
      accentSoft: "#38303a",
      accentBorder: "#966876",
      onAccent: "#0f1318",
    },
  },
  {
    id: "amber",
    name: "Amber",
    light: {
      accent: "#875710",
      accentStrong: "#6f470d",
      accentSoft: "#eee7de",
      accentBorder: "#ad8d5c",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#e6b45f",
      accentStrong: "#ebc27c",
      accentSoft: "#37342d",
      accentBorder: "#937747",
      onAccent: "#0f1318",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    light: {
      accent: "#3a4048",
      accentStrong: "#30343b",
      accentSoft: "#e3e4e5",
      accentBorder: "#797d83",
      onAccent: "#ffffff",
    },
    dark: {
      accent: "#b8c0ca",
      accentStrong: "#c5cbd4",
      accentSoft: "#30363f",
      accentBorder: "#777e88",
      onAccent: "#0f1318",
    },
  },
];

export function findAccentPreset(accentId) {
  const preset = ACCENT_PRESETS.find((candidate) => candidate.id === accentId);
  return preset ?? ACCENT_PRESETS.find((candidate) => candidate.id === DEFAULT_ACCENT_ID);
}
