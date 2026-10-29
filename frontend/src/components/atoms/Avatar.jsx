// A round initial badge for a person or character, in the chosen accent: a soft accent tint, an
// accent ring and the initial in the strong accent shade (checked for contrast in every preset).
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { initialOf } from "../../lib/format.js";

const SIZES = { large: 48, regular: 36, small: 26, tiny: 20 };

const Circle = styled(View)`
  flex: none;
  width: ${({ $diameter }) => $diameter}px;
  height: ${({ $diameter }) => $diameter}px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1.5px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accentStrong};
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ $diameter }) => Math.round($diameter * 0.46)}px;
  line-height: 1;
`;

export function Avatar({ name, size = "regular" }) {
  return (
    <Circle $diameter={SIZES[size]} aria-hidden="true">
      <Text>{initialOf(name)}</Text>
    </Circle>
  );
}
