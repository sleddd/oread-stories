// The bar above the conversation: a toggle for the chats panel at the left end, the editable chat
// title, Clear chat, and a toggle for the steering panel at the right end. On a phone
// (`isCompact`) it's tighter: steering is a sliders icon and Clear chat moves into a "…" menu.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, IconButton, TextField } from "../atoms/index.js";
import { OverflowMenu } from "../molecules/index.js";

const Bar = styled(Row)`
  gap: ${({ $isCompact }) => ($isCompact ? "6px" : "12px")};
  padding: ${({ $isCompact }) => ($isCompact ? "8px 10px" : "12px 24px")};
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  background: ${({ theme }) => theme.colors.panel};
`;

const TitleField = styled(TextField)`
  flex: 1;
  background: transparent;
  border-color: transparent;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 24px;
  font-weight: 600;
  padding: 2px 6px;
  margin-left: -6px;
  &:hover,
  &:focus {
    border-color: ${({ theme }) => theme.colors.line};
  }
`;

export function ChatHeader({
  title,
  isEditable,
  onRename,
  onToggleChats,
  onToggleInspector,
  onClear,
  isCompact = false,
}) {
  const [typedTitle, setTypedTitle] = useState(title);

  useEffect(() => {
    setTypedTitle(title);
  }, [title]);

  return (
    <Bar $isCompact={isCompact}>
      <IconButton icon="panelLeft" label="Show or hide chats" onPress={onToggleChats} />
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
      {isCompact && (
        <>
          <IconButton icon="sliders" label="Show or hide steering" onPress={onToggleInspector} />
          <OverflowMenu
            label="More chat actions"
            items={[{ label: "Clear chat", onPress: onClear, isDisabled: !isEditable }]}
          />
        </>
      )}
      {!isCompact && (
        <>
          <Button
            label="Clear chat"
            size="small"
            title="Clear this conversation and start the story over"
            disabled={!isEditable}
            onPress={onClear}
          />
          <IconButton icon="panelRight" label="Show or hide steering" onPress={onToggleInspector} />
        </>
      )}
    </Bar>
  );
}
