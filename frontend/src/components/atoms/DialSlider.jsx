// The lorebook's −2…+2 slider: a thin ruled track with a centre mark and a round knob ringed in
// the accent colour.
import styled, { css } from "styled-components";
import { Slider } from "../../ui/primitives/index.js";

const DIAL_MINIMUM = -2;
const DIAL_MAXIMUM = 2;
const DIAL_STEP = 0.1;
const TICK_SPACING = "5%";

const trackStyles = css`
  border-radius: 999px;
  border: 0;
  background:
    linear-gradient(
      to right,
      transparent calc(50% - 1px),
      ${({ theme }) => theme.colors.muted} calc(50% - 1px),
      ${({ theme }) => theme.colors.muted} calc(50% + 1px),
      transparent calc(50% + 1px)
    ),
    repeating-linear-gradient(
      to right,
      ${({ theme }) => theme.colors.lineStrong} 0 1px,
      transparent 1px ${TICK_SPACING}
    ),
    ${({ theme }) => theme.colors.dialTrack};
`;

const knobStyles = css`
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.panel};
  border: 2px solid ${({ theme }) => theme.colors.accent};
  box-shadow:
    inset 0 0 0 3px ${({ theme }) => theme.colors.panel},
    inset 0 0 0 8px ${({ theme }) => theme.colors.accent};
`;

function trackHeight(isCompact) {
  return isCompact ? 6 : 8;
}

function knobSize(isCompact) {
  return isCompact ? 16 : 20;
}

const StyledSlider = styled(Slider)`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: ${({ $isCompact }) => knobSize($isCompact) + 6}px;
  background: transparent;
  margin: 6px 0 0;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    ${trackStyles}
    height: ${({ $isCompact }) => trackHeight($isCompact)}px;
  }
  &::-moz-range-track {
    ${trackStyles}
    height: ${({ $isCompact }) => trackHeight($isCompact)}px;
  }
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    ${knobStyles}
    width: ${({ $isCompact }) => knobSize($isCompact)}px;
    height: ${({ $isCompact }) => knobSize($isCompact)}px;
    margin-top: ${({ $isCompact }) => (trackHeight($isCompact) - knobSize($isCompact)) / 2}px;
  }
  &::-moz-range-thumb {
    ${knobStyles}
    width: ${({ $isCompact }) => knobSize($isCompact) - 4}px;
    height: ${({ $isCompact }) => knobSize($isCompact) - 4}px;
  }
`;

export function DialSlider({
  value,
  onValueChange,
  accessibilityLabel,
  nativeID,
  isCompact = false,
}) {
  return (
    <StyledSlider
      $isCompact={isCompact}
      nativeID={nativeID}
      value={value}
      minimumValue={DIAL_MINIMUM}
      maximumValue={DIAL_MAXIMUM}
      step={DIAL_STEP}
      accessibilityLabel={accessibilityLabel}
      onValueChange={onValueChange}
    />
  );
}
