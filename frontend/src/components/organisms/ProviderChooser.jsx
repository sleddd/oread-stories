// The model providers as large cards to choose from, one at a time: name, a line about each, and
// which one is in use for chat. Used by the first-run setup and by Settings, so choosing a
// provider looks the same in both. Choosing a card only reports it; the caller decides what that
// does (open its fields, or move to the next step).
import styled from "styled-components";
import { Pressable, Text, View } from "../../ui/primitives/index.js";

const List = styled(View)`
  gap: 10px;
`;

const Card = styled(Pressable)`
  width: 100%;
  padding: 16px 18px;
  border-radius: ${({ theme }) => theme.radii.medium};
  border: 1px solid
    ${({ $isSelected, theme }) => ($isSelected ? theme.colors.accent : theme.colors.line)};
  box-shadow: ${({ $isSelected, theme }) =>
    $isSelected ? `0 0 0 1px ${theme.colors.accent}` : "none"};
  background: ${({ $isSelected, theme }) =>
    $isSelected ? theme.colors.accentSoft : theme.colors.panel};
  color: ${({ theme }) => theme.colors.ink};
  font: inherit;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease;
  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const NameRow = styled(View)`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
`;

const Name = styled(Text)`
  font-size: 18px;
  font-weight: 700;
`;

const InUse = styled(Text)`
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-size: 12px;
  font-weight: 600;
`;

const Description = styled(Text)`
  display: block;
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
  line-height: 1.45;
`;

// providers: [{ id, name, description }]. `selectedId` is highlighted; `activeId` is the one in
// use for chat, marked "In use".
export function ProviderChooser({ providers, selectedId, activeId, onSelect }) {
  return (
    <List role="radiogroup" aria-label="Model provider">
      {providers.map((provider) => (
        <Card
          key={provider.id}
          accessibilityRole="radio"
          accessibilityLabel={provider.name}
          isChecked={provider.id === selectedId}
          $isSelected={provider.id === selectedId}
          onPress={() => onSelect(provider.id)}
        >
          <NameRow>
            <Name>{provider.name}</Name>
            {provider.id === activeId && <InUse>In use</InUse>}
          </NameRow>
          <Description>{provider.description}</Description>
        </Card>
      ))}
    </List>
  );
}
