// A row of tabs. tabs: [{ id, label }]. Two looks: "underline" (text tabs over a shared rule, for
// page sections) and "segmented" (a rounded track whose selected segment is raised).
import styled, { css } from "styled-components";
import { Row, Pressable } from "../../ui/primitives/index.js";

const rowStyles = {
  underline: css`
    gap: 24px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  `,
  segmented: css`
    gap: 2px;
    padding: 4px;
    align-self: flex-start;
    background: ${({ theme }) => theme.colors.segment};
    border: 1px solid ${({ theme }) => theme.colors.line};
    border-radius: ${({ theme }) => theme.radii.medium};
  `,
};

const tabStyles = {
  underline: css`
    padding: 8px 2px;
    margin-bottom: -1px;
    border: 0;
    border-bottom: 2px solid
      ${({ $isSelected, theme }) => ($isSelected ? theme.colors.accent : "transparent")};
    background: transparent;
  `,
  segmented: css`
    padding: 7px 16px;
    border: 1px solid
      ${({ $isSelected, theme }) => ($isSelected ? theme.colors.line : "transparent")};
    border-radius: ${({ theme }) => theme.radii.small};
    background: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.raised : "transparent")};
    box-shadow: ${({ $isSelected, theme }) => ($isSelected ? `0 1px 2px ${theme.colors.shadow}` : "none")};
  `,
};

const TabRow = styled(Row)`
  flex-wrap: wrap;
  ${({ $look }) => rowStyles[$look]}
`;

const Tab = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  font-size: 16px;
  color: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.ink : theme.colors.muted)};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
  ${({ $look }) => tabStyles[$look]}
`;

export function Tabs({
  tabs,
  selectedId,
  onSelect,
  accessibilityLabel,
  look = "underline",
  className,
}) {
  return (
    <TabRow role="tablist" aria-label={accessibilityLabel} className={className} $look={look}>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          accessibilityRole="tab"
          isSelected={tab.id === selectedId}
          $isSelected={tab.id === selectedId}
          $look={look}
          onPress={() => onSelect(tab.id)}
        >
          {tab.label}
        </Tab>
      ))}
    </TabRow>
  );
}
