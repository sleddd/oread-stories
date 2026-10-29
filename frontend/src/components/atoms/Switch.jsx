// An on/off switch with a label, built on Pressable so it works the same way natively.
import styled from "styled-components";
import { Pressable, View } from "../../ui/primitives/index.js";

const SwitchButton = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.ink};
  background: transparent;
  border: 0;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const Track = styled(View)`
  width: 34px;
  height: 20px;
  border-radius: 10px;
  padding: 2px;
  background: ${({ $isOn, theme }) => ($isOn ? theme.colors.accent : theme.colors.lineStrong)};
  align-items: ${({ $isOn }) => ($isOn ? "flex-end" : "flex-start")};
  transition: background 0.15s;
`;

const Knob = styled(View)`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.panel};
`;

export function Switch({ label, isOn, onChange }) {
  return (
    <SwitchButton accessibilityRole="switch" isPressed={isOn} onPress={() => onChange(!isOn)}>
      <Track $isOn={isOn}>
        <Knob />
      </Track>
      {label}
    </SwitchButton>
  );
}
