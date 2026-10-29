// A round initial badge for a person or character.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { initialOf } from "../../lib/format.js";

const SIZES = { regular: 40, small: 30 };

const Circle = styled(View)`
  flex: none;
  width: ${({ $diameter }) => $diameter}px;
  height: ${({ $diameter }) => $diameter}px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: ${({ $color, theme }) => $color ?? theme.colors.muted};
  color: #ffffff;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ $diameter }) => Math.round($diameter * 0.48)}px;
`;

export function Avatar({ name, color, size = "regular" }) {
  return (
    <Circle $diameter={SIZES[size]} $color={color} aria-hidden="true">
      <Text>{initialOf(name)}</Text>
    </Circle>
  );
}
