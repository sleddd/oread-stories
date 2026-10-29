// A rounded on/off toggle, used for voice tags.
import styled from "styled-components";
import { Pressable } from "../../ui/primitives/index.js";

const StyledChip = styled(Pressable)`
  font: inherit;
  font-weight: 500;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 5px 12px;
  cursor: pointer;
  border: 1px solid ${({ $isOn, theme }) => ($isOn ? theme.colors.positive : theme.colors.line)};
  background: ${({ $isOn, theme }) => ($isOn ? theme.colors.positive : "transparent")};
  color: ${({ $isOn, theme }) => ($isOn ? theme.colors.onPositive : theme.colors.ink)};
`;

export function Chip({ label, isOn, description, onToggle }) {
  return (
    <StyledChip $isOn={isOn} isPressed={isOn} title={description} onPress={() => onToggle(!isOn)}>
      {label}
    </StyledChip>
  );
}
