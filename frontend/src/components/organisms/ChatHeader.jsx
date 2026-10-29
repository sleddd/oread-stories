// The bar above the conversation: editable chat title, the character's mood, and panel toggles for small screens.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";

const Bar = styled(Row)`
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
`;

const TitleField = styled(TextField)`
  flex: 1;
  background: transparent;
  border-color: transparent;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 20px;
  font-weight: 600;
  padding: 4px 6px;
  &:hover,
  &:focus {
    border-color: ${({ theme }) => theme.colors.line};
  }
`;

const MoodLine = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.label};
  white-space: nowrap;
  @media (max-width: 760px) {
    display: none;
  }
`;

const MoodName = styled(Text)`
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.serif};
  font-style: italic;
`;

// The toggles only matter when the side panels are hidden on narrow screens.
const ChatsToggle = styled(Row)`
  display: none;
  @media (max-width: 760px) {
    display: flex;
  }
`;

const InspectorToggle = styled(Row)`
  display: none;
  @media (max-width: 1180px) {
    display: flex;
  }
`;

export function ChatHeader({ title, isEditable, characterName, mood, onRename, onToggleChats, onToggleInspector }) {
  const [typedTitle, setTypedTitle] = useState(title);

  useEffect(() => {
    setTypedTitle(title);
  }, [title]);

  return (
    <Bar>
      <ChatsToggle>
        <Button label="☰" variant="icon" accessibilityLabel="Show chats" onPress={onToggleChats} />
      </ChatsToggle>
      <TitleField
        accessibilityLabel="Chat title"
        value={typedTitle}
        editable={isEditable}
        onChangeText={setTypedTitle}
        onBlur={() => onRename(typedTitle)}
        onKeyPress={(keyPress) => {
          if (keyPress.key === "Enter") {
            onRename(typedTitle);
          }
        }}
      />
      <MoodLine>
        {`${characterName} feels `}
        <MoodName>{mood?.label}</MoodName>
        {mood?.intensity}
      </MoodLine>
      <InspectorToggle>
        <Button label="⚙︎" variant="icon" accessibilityLabel="Show steering and context" onPress={onToggleInspector} />
      </InspectorToggle>
    </Bar>
  );
}
