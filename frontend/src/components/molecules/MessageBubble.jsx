// One chat message. Your own messages sit in a tinted bubble on the right, in serif italics, with
// their tools underneath. A character's reply has no bubble: their avatar, their name and current
// mood, the reply as paragraphs lined up under the name, and a footer with the message tools on
// the left and an optional accessory (what the turn changed) on the right. Each message is a group
// named for its author, so screen readers still say who wrote your own unlabelled bubbles.
import { useState } from "react";
import styled from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Avatar, Button, TextArea, TypingDots } from "../atoms/index.js";
import { PHONE_LAYOUT_WIDTH } from "../../theme/breakpoints.js";
import { MessageTools } from "./MessageTools.jsx";
import { RoleplayText } from "./RoleplayText.jsx";

const PHONE = `(max-width: ${PHONE_LAYOUT_WIDTH}px)`;

const Layout = styled(View)`
  max-width: ${({ theme }) => theme.layout.conversationWidth};
  width: 100%;
  margin: 0 auto;
`;

const MineColumn = styled(View)`
  align-items: flex-end;
  gap: 4px;
`;

const MineBubble = styled(View)`
  max-width: min(720px, 85%);
  padding: 12px 18px;
  border-radius: ${({ theme }) => theme.radii.medium};
  border: 1px solid ${({ $hasError, theme }) => ($hasError ? theme.colors.danger : "transparent")};
  background: ${({ theme }) => theme.colors.userBubble};
`;

const MineText = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-style: italic;
  font-size: 17.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

// A reply is the speaker's avatar beside their text: no name line. The name still labels the
// message for screen readers (the group around it), and the initial tells speakers apart.
const ReplyRow = styled(Row)`
  align-items: flex-start;
  gap: 12px;
  @media ${PHONE} {
    gap: 10px;
  }
`;

// Sits level with the first line of text, with a very light ring so it doesn't compete with the
// reply. On a phone it shrinks, so the text keeps the width.
const AvatarSlot = styled(View)`
  margin-top: 1px;
  @media ${PHONE} {
    & > * {
      width: 28px;
      height: 28px;
      font-size: 13px;
    }
  }
`;

const ReplyBody = styled(View)`
  flex: 1;
  min-width: 0;
`;

const ReplyText = styled(View)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 18px;
  line-height: 1.85;
  overflow-wrap: anywhere;
`;

// The tools, then (when the turn changed anything) "What changed" after a thin divider, under a
// rule that separates them from the reply. The first icon lines up with the text above it.
const Footer = styled(Row)`
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
  & > :first-child {
    margin-left: -6px;
  }
`;

const ErrorLine = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin-top: 6px;
`;

const Editor = styled(TextArea)`
  width: 100%;
  min-height: 90px;
  font-family: ${({ theme }) => theme.fonts.serif};
`;

const EditorButtons = styled(Row)`
  gap: 6px;
  margin-top: 8px;
`;

function MessageEditor({ initialText, onSave, onCancel }) {
  const [text, setText] = useState(initialText);
  return (
    <View>
      <Editor accessibilityLabel="Edit message" value={text} onChangeText={setText} />
      <EditorButtons>
        <Button label="Save" variant="primary" size="small" onPress={() => onSave(text)} />
        <Button label="Cancel" size="small" onPress={onCancel} />
      </EditorButtons>
    </View>
  );
}

function MyMessage({ message, displayedText, isEditing, onSaveEdit, onCancelEdit, tools }) {
  if (isEditing) {
    return (
      <MessageEditor initialText={message.content} onSave={onSaveEdit} onCancel={onCancelEdit} />
    );
  }
  return (
    <MineColumn>
      <MineBubble $hasError={Boolean(message.error)}>
        <MineText>{displayedText}</MineText>
        {message.error && <ErrorLine>{message.error}</ErrorLine>}
      </MineBubble>
      {tools}
    </MineColumn>
  );
}

function CharacterReply({
  message,
  authorName,
  displayedText,
  isStreaming,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  tools,
  footerAccessory,
}) {
  return (
    <ReplyRow>
      <AvatarSlot>
        <Avatar name={authorName} ring="light" />
      </AvatarSlot>
      <ReplyBody>
        {isEditing && (
          <MessageEditor
            initialText={message.content}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        )}
        {!isEditing && (
          <>
            <ReplyText>
              <RoleplayText text={displayedText} />
              {isStreaming && <TypingDots />}
            </ReplyText>
            {message.error && <ErrorLine>{message.error}</ErrorLine>}
            {!isStreaming && (
              <Footer>
                {tools}
                {footerAccessory}
              </Footer>
            )}
          </>
        )}
      </ReplyBody>
    </ReplyRow>
  );
}

export function MessageBubble({
  message,
  authorName,
  displayedText,
  isLast,
  isBusy,
  isStreaming,
  isEditing,
  footerAccessory,
  onSaveEdit,
  onCancelEdit,
  ...toolHandlers
}) {
  const tools = !isStreaming && (
    <MessageTools message={message} isLast={isLast} isBusy={isBusy} {...toolHandlers} />
  );
  const sharedProps = { message, displayedText, isEditing, onSaveEdit, onCancelEdit, tools };
  return (
    <Layout role="group" aria-label={authorName}>
      {message.role === "user" ? (
        <MyMessage {...sharedProps} />
      ) : (
        <CharacterReply
          {...sharedProps}
          authorName={authorName}
          isStreaming={isStreaming}
          footerAccessory={footerAccessory}
        />
      )}
    </Layout>
  );
}
