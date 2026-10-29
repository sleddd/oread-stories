// The accent colour choice: a row of round swatches that behave as one radio group. Each swatch
// shows the preset in the current colour scheme and is named for screen readers.
import styled, { useTheme } from "styled-components";
import { View, Row, Text, Pressable } from "../../ui/primitives/index.js";

const SWATCH_SIZE = 34;

const Group = styled(Row)`
  gap: 14px;
  flex-wrap: wrap;
  margin: 6px 0 10px;
`;

const Choice = styled(View)`
  align-items: center;
  gap: 6px;
  width: 64px;
`;

const Swatch = styled(Pressable)`
  width: ${SWATCH_SIZE}px;
  height: ${SWATCH_SIZE}px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  background: ${({ $color }) => $color};
  border: 2px solid ${({ theme }) => theme.colors.panel};
  box-shadow: 0 0 0 2px
    ${({ $isSelected, theme }) => ($isSelected ? theme.colors.ink : theme.colors.line)};
`;

const Name = styled(Text)`
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.ink : theme.colors.muted)};
  font-weight: ${({ $isSelected }) => ($isSelected ? 700 : 500)};
  text-align: center;
`;

// presets: [{ id, name, light: { accent }, dark: { accent } }]
export function AccentPicker({ presets, selectedId, onSelect, accessibilityLabel }) {
  const theme = useTheme();
  return (
    <Group role="radiogroup" aria-label={accessibilityLabel}>
      {presets.map((preset) => {
        const isSelected = preset.id === selectedId;
        return (
          <Choice key={preset.id}>
            <Swatch
              accessibilityRole="radio"
              accessibilityLabel={preset.name}
              isChecked={isSelected}
              $isSelected={isSelected}
              $color={preset[theme.colorScheme].accent}
              onPress={() => onSelect(preset.id)}
            />
            <Name $isSelected={isSelected} aria-hidden="true">
              {preset.name}
            </Name>
          </Choice>
        );
      })}
    </Group>
  );
}
