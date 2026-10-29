// One chat message: avatar, author, text (or an editor), any error, and the message tools.
import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Avatar, Button, TextArea } from "../atoms/index.js";
import { MessageTools } from "./MessageTools.jsx";
import { RoleplayText } from "./RoleplayText.jsx";

const blink = keyframes`
  50% { opacity: 0; }
`;

const Layout = styled(Row)`
  gap: 10px;
  align-items: flex-start;
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
  flex-direction: ${({ $isMine }) => ($isMine ? "row-reverse" : "row")};
`;

const Bubble = styled(View)`
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid ${({ $hasError, theme }) => ($hasError ? theme.colors.danger : theme.colors.line)};
  background: ${({ $isMine, theme }) => ($isMine ? theme.colors.userBubble : theme.colors.characterBubble)};
  max-width: min(680px, 88%);
`;

const Author = styled(Text)`
  font-weight: 700;
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.muted};
  margin-bottom: 2px;
`;

const Body = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 17.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  &::after {
    content: ${({ $isStreaming }) => ($isStreaming ? '"▍"' : "none")};
    color: ${({ theme }) => theme.colors.accent};
    animation: ${blink} 1s steps(2) infinite;
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
    <>
      <Editor accessibilityLabel="Edit message" value={text} onChangeText={setText} />
      <EditorButtons>
        <Button label="Save" variant="primary" size="small" onPress={() => onSave(text)} />
        <Button label="Cancel" size="small" onPress={onCancel} />
      </EditorButtons>
    </>
  );
}

export function MessageBubble({
  message,
  authorName,
  avatarColor,
  displayedText,
  isLast,
  isBusy,
  isStreaming,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  ...toolHandlers
}) {
  const isMine = message.role === "user";
  return (
    <Layout $isMine={isMine}>
      <Avatar name={authorName} color={isMine ? undefined : avatarColor} size="small" />
      <Bubble $isMine={isMine} $hasError={Boolean(message.error)}>
        <Author>{authorName}</Author>
        {isEditing && <MessageEditor initialText={message.content} onSave={onSaveEdit} onCancel={onCancelEdit} />}
        {!isEditing && (
          <>
            <Body $isStreaming={isStreaming}>
              <RoleplayText text={displayedText} />
            </Body>
            {message.error && <ErrorLine>{message.error}</ErrorLine>}
            {!isStreaming && <MessageTools message={message} isLast={isLast} isBusy={isBusy} {...toolHandlers} />}
          </>
        )}
      </Bubble>
    </Layout>
  );
}
