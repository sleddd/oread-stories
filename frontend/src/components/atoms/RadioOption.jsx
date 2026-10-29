// One choice in a set where only one can be selected.
import styled from "styled-components";
import { Pressable, View } from "../../ui/primitives/index.js";

const Option = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.ink};
  background: transparent;
  border: 0;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

const Ring = styled(View)`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colors.accent};
  align-items: center;
  justify-content: center;
`;

const Fill = styled(View)`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
`;

export function RadioOption({ label, isSelected, onSelect }) {
  return (
    <Option accessibilityRole="radio" isPressed={isSelected} onPress={onSelect}>
      <Ring>{isSelected && <Fill />}</Ring>
      {label}
    </Option>
  );
}
