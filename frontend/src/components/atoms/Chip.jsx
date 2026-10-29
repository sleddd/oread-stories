// A rounded on/off toggle, used for voice tags and who is in the scene.
import styled from "styled-components";
import { Pressable } from "../../ui/primitives/index.js";

const StyledChip = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.label};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 4px 14px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  border: 1px solid ${({ $isOn, theme }) => ($isOn ? theme.colors.accent : theme.colors.line)};
  background: ${({ $isOn, theme }) => ($isOn ? theme.colors.accentSoft : "transparent")};
  color: ${({ $isOn, theme }) => ($isOn ? theme.colors.ink : theme.colors.muted)};
  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

export function Chip({ label, isOn, description, onToggle }) {
  return (
    <StyledChip $isOn={isOn} isPressed={isOn} title={description} onPress={() => onToggle(!isOn)}>
      {label}
    </StyledChip>
  );
}
