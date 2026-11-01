// The screen while Oread starts: the mark in the middle of the page, breathing slowly, with a
// thin arc circling it, and a line saying what's happening. The motion is web CSS (keyframes and
// a reduced-motion query), which is why it lives in a template; with reduced motion the mark
// simply stays still.
import styled, { keyframes, useTheme } from "styled-components";
import { G, Path, Svg, Text, View } from "../../ui/primitives/index.js";
import { OreadMark } from "../atoms/index.js";

const STAGE_SIZE = 132;
const MARK_SIZE = 76;
const ARC_VIEW_BOX = "0 0 100 100";
const ARC_STROKE_WIDTH = 1.6;
// A third of the circle, starting at the top.
const ARC_PATH = "M50 2 A48 48 0 0 1 91.57 74";
const FULL_RING_PATH = "M2 50 A48 48 0 1 0 98 50 A48 48 0 1 0 2 50 Z";

const breathe = keyframes`
  0%, 100% { transform: scale(0.94); opacity: 0.72; }
  50% { transform: scale(1); opacity: 1; }
`;

const circle = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const appear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Screen = styled(View)`
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 24px;
  animation: ${appear} 400ms ease-out both;
`;

const Stage = styled(View)`
  position: relative;
  width: ${STAGE_SIZE}px;
  height: ${STAGE_SIZE}px;
  align-items: center;
  justify-content: center;
`;

const Ring = styled(Svg)`
  position: absolute;
  inset: 0;
`;

const CirclingArc = styled(Svg)`
  position: absolute;
  inset: 0;
  animation: ${circle} 1.8s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const BreathingMark = styled(View)`
  animation: ${breathe} 2.8s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Message = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 15px;
  letter-spacing: 0.02em;
`;

export function LoadingTemplate({ message }) {
  const theme = useTheme();
  return (
    <Screen role="status" aria-live="polite">
      <Stage>
        <Ring
          viewBox={ARC_VIEW_BOX}
          width={STAGE_SIZE}
          height={STAGE_SIZE}
          color={theme.colors.line}
        >
          <Path
            d={FULL_RING_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth={ARC_STROKE_WIDTH}
          />
        </Ring>
        <CirclingArc
          viewBox={ARC_VIEW_BOX}
          width={STAGE_SIZE}
          height={STAGE_SIZE}
          color={theme.colors.accent}
        >
          <G strokeLinecap="round">
            <Path d={ARC_PATH} fill="none" stroke="currentColor" strokeWidth={ARC_STROKE_WIDTH} />
          </G>
        </CirclingArc>
        <BreathingMark>
          <OreadMark size={MARK_SIZE} />
        </BreathingMark>
      </Stage>
      <Message>{message}</Message>
    </Screen>
  );
}
