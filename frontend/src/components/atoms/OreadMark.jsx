// Oread's mark: a mountain nymph with flowing hair and a sprig, rising from the peaks, inside a
// circle. Drawn in the accent colour so it follows the theme. Decorative unless given an
// accessibilityLabel, because the wordmark usually sits beside it.
import { useTheme } from "styled-components";
import { Svg, Path } from "../../ui/primitives/index.js";
import { OREAD_FIGURE_PATH } from "./oreadMarkFigure.js";

const VIEW_BOX = "0 0 100 100";
const DEFAULT_SIZE = 40;
const RING_STROKE_WIDTH = 1.35;
// Inset by half the stroke so the ring isn't clipped at the edge of the drawing.
const RING_PATH = "M1.35 50 A48.65 48.65 0 1 0 98.65 50 A48.65 48.65 0 1 0 1.35 50 Z";

export function OreadMark({ size = DEFAULT_SIZE, accessibilityLabel }) {
  const theme = useTheme();
  return (
    <Svg
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      color={theme.colors.accent}
      accessibilityLabel={accessibilityLabel}
    >
      <Path d={OREAD_FIGURE_PATH} fill="currentColor" fillRule="evenodd" />
      <Path d={RING_PATH} fill="none" stroke="currentColor" strokeWidth={RING_STROKE_WIDTH} />
    </Svg>
  );
}
