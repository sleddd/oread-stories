// "What changed" under a reply: skill and ability changes, the memories each character wrote,
// and changes to the world. Closed, it's a quiet "What changed 6 ›" after the reply's tools,
// behind a thin divider; opened, the list takes a full line of its own below them.
import { useState } from "react";
import styled from "styled-components";
import { View, Text, Pressable } from "../../ui/primitives/index.js";
import { Icon } from "../atoms/index.js";
import { describeTurnChanges } from "../../lib/describeStory.js";

const Panel = styled(View)`
  flex: ${({ $isOpen }) => ($isOpen ? "1 1 100%" : "0 0 auto")};
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const Toggle = styled(Pressable)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.muted};
  background: transparent;
  border: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.line};
  padding: 2px 4px 2px 14px;
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const Count = styled(Text)`
  min-width: 20px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.segment};
  color: ${({ theme }) => theme.colors.ink};
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;

const Chevron = styled(View)`
  transition: transform 120ms ease;
  transform: rotate(${({ $isOpen }) => ($isOpen ? "90deg" : "0deg")});
`;

const Details = styled(View)`
  flex: 1 1 100%;
  margin-top: 8px;
  padding: 12px 16px;
  line-height: 1.6;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.panel};
`;

// A gap between groups (Memories, World…), none before the first.
const Group = styled(View)`
  & + & {
    margin-top: 12px;
  }
`;

const GroupTitle = styled(Text)`
  display: block;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.muted};
`;

const Line = styled(Text)`
  display: block;
  margin-top: 6px;
  color: ${({ theme }) => theme.colors.muted};
`;

function groupLines(lines) {
  const groups = [];
  for (const line of lines) {
    let group = groups.find((existing) => existing.title === line.group);
    if (!group) {
      group = { title: line.group, lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}

export function TurnChanges({ turnChanges }) {
  const [isOpen, setIsOpen] = useState(false);
  const lines = describeTurnChanges(turnChanges ?? {});
  if (lines.length === 0) {
    return null;
  }
  return (
    <Panel $isOpen={isOpen}>
      <Toggle
        isExpanded={isOpen}
        accessibilityLabel={`What changed: ${lines.length}`}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text>What changed</Text>
        <Count aria-hidden="true">{lines.length}</Count>
        <Chevron $isOpen={isOpen} aria-hidden="true">
          <Icon name="chevronRight" size={14} />
        </Chevron>
      </Toggle>
      {isOpen && (
        <Details>
          {groupLines(lines).map((group) => (
            <Group key={group.title}>
              <GroupTitle>{group.title}</GroupTitle>
              {group.lines.map((line) => (
                <Line key={line.id}>{line.text}</Line>
              ))}
            </Group>
          ))}
        </Details>
      )}
    </Panel>
  );
}
