// The lorebook's −2…+2 slider: a ruled track with a centre line and a glowing needle.
import styled, { css } from "styled-components";
import { Slider } from "../../ui/primitives/index.js";

const DIAL_MINIMUM = -2;
const DIAL_MAXIMUM = 2;
const DIAL_STEP = 0.1;

const trackStyles = css`
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  background:
    linear-gradient(
      to right,
      transparent calc(50% - 1px),
      ${({ theme }) => theme.colors.muted} calc(50% - 1px),
      ${({ theme }) => theme.colors.muted} calc(50% + 1px),
      transparent calc(50% + 1px)
    ),
    repeating-linear-gradient(to right, ${({ theme }) => theme.colors.line} 0 1px, transparent 1px 5%),
    ${({ theme }) => theme.colors.dialTrack};
`;

const needleStyles = css`
  width: 6px;
  border: 0;
  border-radius: 2px;
  background: ${({ theme }) => theme.colors.danger};
  box-shadow: 0 0 10px ${({ theme }) => theme.colors.glow};
`;

const StyledSlider = styled(Slider)`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: ${({ $isCompact }) => ($isCompact ? "22px" : "30px")};
  background: transparent;
  margin: 4px 0 0;

  &::-webkit-slider-runnable-track {
    ${trackStyles}
    height: ${({ $isCompact }) => ($isCompact ? "14px" : "22px")};
  }
  &::-moz-range-track {
    ${trackStyles}
    height: ${({ $isCompact }) => ($isCompact ? "14px" : "22px")};
  }
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    ${needleStyles}
    height: ${({ $isCompact }) => ($isCompact ? "22px" : "32px")};
    margin-top: ${({ $isCompact }) => ($isCompact ? "-5px" : "-6px")};
  }
  &::-moz-range-thumb {
    ${needleStyles}
    height: ${({ $isCompact }) => ($isCompact ? "22px" : "32px")};
  }
`;

export function DialSlider({ value, onValueChange, accessibilityLabel, nativeID, isCompact = false }) {
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
