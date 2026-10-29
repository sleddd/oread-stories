// A character's card: avatar, name, current mood and a link to edit the character.
import styled from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Avatar, LinkButton } from "../atoms/index.js";
import { MoodLabel } from "./MoodLabel.jsx";

const Card = styled(Row)`
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.panel};
`;

const Details = styled(View)`
  gap: 2px;
`;

const Name = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 20px;
  line-height: 1.2;
`;

export function PersonaCard({ name, mood, onEditCharacter }) {
  return (
    <Card>
      <Avatar name={name} size="large" ring="light" />
      <Details>
        <Name>{name}</Name>
        <MoodLabel mood={mood} />
        <LinkButton label="Edit character" onPress={onEditCharacter} />
      </Details>
    </Card>
  );
}
