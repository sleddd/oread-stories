// A story's cast: pick a character to edit, or add a new one as an AI character or as the one
// you play.
import { useState } from "react";
import styled from "styled-components";
import { View, Row, Text, Pressable } from "../../ui/primitives/index.js";
import { Avatar, Button, TextField, SelectField, EmptyState } from "../atoms/index.js";
import { CHARACTER_ROLES } from "../../content/story.js";

const Column = styled(View)`
  gap: 4px;
`;

const Item = styled(Pressable)`
  display: flex;
  align-items: center;
  gap: 10px;
  font: inherit;
  color: ${({ theme }) => theme.colors.ink};
  text-align: left;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.radii.small};
  cursor: pointer;
  border: 0;
  background: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.accentSoft : "transparent")};
  &:hover {
    background: ${({ theme }) => theme.colors.accentSoft};
  }
`;

const AddButtonSlot = styled(View)`
  margin-top: 6px;
`;

const Name = styled(Text)`
  display: block;
  font-weight: 700;
`;

const Role = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const AddRow = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const NameField = styled(TextField)`
  flex: 1 1 140px;
`;

function roleLabel(roleId) {
  return CHARACTER_ROLES.find((role) => role.id === roleId)?.label ?? roleId;
}

function AddCharacterForm({ hasPlayer, onAdd }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("ai");
  const roleItems = CHARACTER_ROLES.filter((option) => option.id === "ai" || !hasPlayer).map(
    (option) => ({ value: option.id, label: option.label }),
  );
  function add() {
    if (name.trim()) {
      onAdd({ name, role });
      setName("");
      setRole("ai");
      setIsOpen(false);
    }
  }
  if (!isOpen) {
    return (
      <AddButtonSlot>
        <Button label="+ Add character" variant="dashed" isWide onPress={() => setIsOpen(true)} />
      </AddButtonSlot>
    );
  }
  return (
    <AddRow>
      <NameField
        accessibilityLabel="New character name"
        placeholder="New character"
        value={name}
        onChangeText={setName}
      />
      <SelectField
        accessibilityLabel="New character role"
        selectedValue={role}
        items={roleItems}
        onValueChange={setRole}
      />
      <Button label="Add" variant="primary" disabled={!name.trim()} onPress={add} />
    </AddRow>
  );
}

export function CastList({ characters, selectedCharacterId, onSelect, onAdd }) {
  const hasPlayer = characters.some((character) => character.role === "player");
  return (
    <Column>
      {characters.length === 0 && <EmptyState>No characters yet.</EmptyState>}
      {characters.map((character) => (
        <Item
          key={character.id}
          accessibilityLabel={`Edit ${character.name}`}
          isSelected={character.id === selectedCharacterId}
          $isSelected={character.id === selectedCharacterId}
          onPress={() => onSelect(character.id)}
        >
          <Avatar name={character.name} size="small" />
          <View>
            <Name>{character.name}</Name>
            <Role>{roleLabel(character.role)}</Role>
          </View>
        </Item>
      ))}
      <AddCharacterForm hasPlayer={hasPlayer} onAdd={onAdd} />
    </Column>
  );
}
