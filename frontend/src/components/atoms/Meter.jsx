// A horizontal bar showing a value. Unsigned meters fill from the left (0..maximum); signed
// meters fill from the centre line toward the side of the value (−maximum..maximum).
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";

const Track = styled(View)`
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.dialTrack};
  border: 1px solid ${({ theme }) => theme.colors.line};
  overflow: hidden;
`;

const Fill = styled(View)`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${({ $start }) => $start}%;
  width: ${({ $width }) => $width}%;
  background: ${({ $tone, theme }) => theme.colors[$tone]};
`;

const CentreLine = styled(View)`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: ${({ theme }) => theme.colors.muted};
`;

const FULL = 100;
const HALF = 50;

function fraction(value, maximum) {
  return Math.max(0, Math.min(1, Math.abs(value) / maximum));
}

// Where the filled part starts and how wide it is, as percentages of the track.
function fillGeometry(value, maximum, isSigned) {
  if (!isSigned) {
    return { start: 0, width: fraction(value, maximum) * FULL };
  }
  const width = fraction(value, maximum) * HALF;
  if (value < 0) {
    return { start: HALF - width, width };
  }
  return { start: HALF, width };
}

// tone: a theme colour name such as "accent", "danger" or "positive".
export function Meter({
  value,
  maximum = 1,
  isSigned = false,
  tone = "accent",
  accessibilityLabel,
}) {
  const { start, width } = fillGeometry(value, maximum, isSigned);
  const minimum = isSigned ? -maximum : 0;
  return (
    <Track
      role="meter"
      aria-label={accessibilityLabel}
      aria-valuenow={value}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
    >
      <Fill $start={start} $width={width} $tone={tone} />
      {isSigned && <CentreLine />}
    </Track>
  );
}
