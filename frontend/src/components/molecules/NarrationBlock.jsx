// Narration in the transcript, such as a story's opening scene: set apart from the characters'
// lines, with no speaker and no avatar.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { RoleplayText } from "./RoleplayText.jsx";

const Block = styled(View)`
  max-width: ${({ theme }) => theme.layout.conversationWidth};
  width: 100%;
  margin: 0 auto;
  padding: 14px 20px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-left: 3px solid ${({ theme }) => theme.colors.accent};
  background: ${({ theme }) => theme.colors.panel};
  border-radius: 0 ${({ theme }) => theme.radii.medium} ${({ theme }) => theme.radii.medium} 0;
`;

const Label = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.accent};
  font-size: ${({ theme }) => theme.fontSizes.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
`;

const Body = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-style: italic;
  font-size: 17.5px;
  line-height: 1.8;
  color: ${({ theme }) => theme.colors.muted};
  white-space: pre-wrap;
`;

export function NarrationBlock({ text, label = "Narration" }) {
  return (
    <Block role="note" aria-label={label}>
      <Label>{label}</Label>
      <Body>
        <RoleplayText text={text} />
      </Body>
    </Block>
  );
}
