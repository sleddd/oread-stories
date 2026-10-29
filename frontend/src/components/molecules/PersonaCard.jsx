// The character's card: avatar, name, current mood and a link to the lorebook.
import styled from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Avatar, LinkButton } from "../atoms/index.js";
import { MoodLabel } from "./MoodLabel.jsx";

const Card = styled(Row)`
  gap: 10px;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.field};
`;

const Name = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 18px;
  line-height: 1.2;
`;

export function PersonaCard({ name, mood, avatarColor, onOpenLorebook }) {
  return (
    <Card>
      <Avatar name={name} color={avatarColor} />
      <View>
        <Name>{name}</Name>
        <MoodLabel mood={mood} />
        <LinkButton label="Open the full lorebook" onPress={onOpenLorebook} />
      </View>
    </Card>
  );
}
