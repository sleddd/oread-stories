// A row of tabs. tabs: [{ id, label }].
import styled from "styled-components";
import { Row, Pressable } from "../../ui/primitives/index.js";

const TabRow = styled(Row)`
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: -1px;
`;

const Tab = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  padding: 7px 14px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 8px 8px 0 0;
  background: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.panel : theme.colors.chip)};
  border-bottom-color: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.panel : theme.colors.line)};
`;

export function Tabs({ tabs, selectedId, onSelect, accessibilityLabel, className }) {
  return (
    <TabRow role="tablist" aria-label={accessibilityLabel} className={className}>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          accessibilityRole="tab"
          isSelected={tab.id === selectedId}
          $isSelected={tab.id === selectedId}
          onPress={() => onSelect(tab.id)}
        >
          {tab.label}
        </Tab>
      ))}
    </TabRow>
  );
}
