// One character, as a card: avatar, name and what they are in the story on top, with their role
// and a remove action; then a segmented control for personality, backstory, abilities and skills,
// and memory. The page supplies each section's content.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Avatar, Button, Heading2, SelectField } from "../atoms/index.js";
import { Section, Tabs } from "../molecules/index.js";
import { CHARACTER_ROLES } from "../../content/story.js";

export const CHARACTER_SECTIONS = [
  { id: "personality", label: "Personality" },
  { id: "backstory", label: "Backstory" },
  { id: "abilities", label: "Abilities & skills" },
  { id: "memory", label: "Memory" },
];

const Header = styled(Row)`
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 18px;
`;

const Identity = styled(View)`
  flex: 1;
  min-width: 180px;
`;

const Name = styled(Heading2)`
  font-size: 30px;
  margin-bottom: 0;
`;

const Subtitle = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const HeaderActions = styled(Row)`
  gap: 12px;
`;

const SectionBody = styled(View)`
  padding-top: 18px;
`;

function roleItems(canBePlayer) {
  const roles = CHARACTER_ROLES.filter((role) => role.id === "ai" || canBePlayer);
  return roles.map((role) => ({ value: role.id, label: role.label }));
}

function roleLabel(roleId) {
  return CHARACTER_ROLES.find((role) => role.id === roleId)?.label ?? roleId;
}

function describeCharacterPlace(character, storyTitle) {
  if (!storyTitle) {
    return roleLabel(character.role);
  }
  return `${roleLabel(character.role)} in ${storyTitle}`;
}

// sections: { [sectionId]: element }
export function CharacterEditor({
  character,
  storyTitle,
  canBePlayer,
  selectedSectionId,
  sections,
  onSelectSection,
  onChangeRole,
  onDelete,
}) {
  return (
    <Section>
      <Header>
        <Avatar name={character.name} size="large" />
        <Identity>
          <Name>{character.name}</Name>
          <Subtitle>{describeCharacterPlace(character, storyTitle)}</Subtitle>
        </Identity>
        <HeaderActions>
          <SelectField
            accessibilityLabel="Role"
            selectedValue={character.role}
            items={roleItems(canBePlayer || character.role === "player")}
            onValueChange={onChangeRole}
          />
          <Button
            label="Remove"
            variant="danger"
            accessibilityLabel={`Remove ${character.name}`}
            onPress={onDelete}
          />
        </HeaderActions>
      </Header>
      <Tabs
        look="segmented"
        tabs={CHARACTER_SECTIONS}
        selectedId={selectedSectionId}
        onSelect={onSelectSection}
        accessibilityLabel={`${character.name} sections`}
      />
      <SectionBody>{sections[selectedSectionId]}</SectionBody>
    </Section>
  );
}
