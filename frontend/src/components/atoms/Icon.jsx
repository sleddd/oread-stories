// Small line icons for tools and toggles, drawn in the surrounding text colour. Each is a few
// strokes on a 24-unit grid; "auto" also fills half its circle.
import { Svg, G, Path } from "../../ui/primitives/index.js";

const VIEW_BOX = "0 0 24 24";
const DEFAULT_SIZE = 18;
const STROKE_WIDTH = 1.8;

const ICON_STROKES = {
  regenerate: ["M20 12a8 8 0 1 1-2.34-5.66", "M20 4v5h-5"],
  reply: ["M9 16l-5-5 5-5", "M20 18v-2a5 5 0 0 0-5-5H4"],
  edit: ["M4 20h4L19 9l-4-4L4 16v4z", "M13.5 6.5l4 4"],
  copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  delete: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"],
  chevronLeft: ["M15 6l-6 6 6 6"],
  chevronRight: ["M9 6l6 6-6 6"],
  chevronDown: ["M6 9l6 6 6-6"],
  sun: [
    "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
    "M12 2v2",
    "M12 20v2",
    "M4.9 4.9l1.4 1.4",
    "M17.7 17.7l1.4 1.4",
    "M2 12h2",
    "M20 12h2",
    "M4.9 19.1l1.4-1.4",
    "M17.7 6.3l1.4-1.4",
  ],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  chat: ["M5 5h14v10H10l-4 4v-4H5z"],
  book: [
    "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z",
    "M12 6v13.5",
  ],
  settings: [
    "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
    "M12 3v2.5",
    "M12 18.5V21",
    "M3 12h2.5",
    "M18.5 12H21",
    "M5.6 5.6l1.8 1.8",
    "M16.6 16.6l1.8 1.8",
    "M5.6 18.4l1.8-1.8",
    "M16.6 7.4l1.8-1.8",
  ],
  sliders: ["M4 7h9", "M17 7h3", "M15 5v4", "M4 17h3", "M11 17h9", "M9 15v4"],
  panelLeft: ["M4 5h16v14H4z", "M9.5 5v14"],
  panelRight: ["M4 5h16v14H4z", "M14.5 5v14"],
  moon: ["M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"],
  auto: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z"],
};

const ICON_FILLS = {
  auto: "M12 3v18a9 9 0 0 0 0-18z",
  more: "M5 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z M12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z M19 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z",
};

export const ICON_NAMES = [...Object.keys(ICON_STROKES), ...Object.keys(ICON_FILLS)];

export function Icon({ name, size = DEFAULT_SIZE }) {
  const strokes = ICON_STROKES[name] ?? [];
  const fill = ICON_FILLS[name];
  return (
    <Svg viewBox={VIEW_BOX} width={size} height={size}>
      <G
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {strokes.map((stroke) => (
          <Path key={stroke} d={stroke} />
        ))}
      </G>
      {fill && <Path d={fill} fill="currentColor" />}
    </Svg>
  );
}
