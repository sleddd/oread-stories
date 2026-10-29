// The message box. Enter sends and Shift+Enter starts a new line; while a reply is written, the
// button stops it.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button, TextArea } from "../atoms/index.js";
import { ShiftPending } from "../molecules/index.js";
import { COMPOSER_HINT } from "../../content/copy.js";

const Container = styled(View)`
  padding: 8px 24px 14px;
  padding-bottom: max(14px, env(safe-area-inset-bottom));
`;

const Inner = styled(View)`
  max-width: ${({ theme }) => theme.layout.conversationWidth};
  width: 100%;
  margin: 0 auto;
`;

// The send button sits inside the box, at its bottom right.
const InputBox = styled(Row)`
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 4px;
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.lineStrong};
  border-radius: 14px;
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const MessageInput = styled(TextArea)`
  flex: 1;
  resize: none;
  min-height: 48px;
  max-height: 40vh;
  background: transparent;
  border: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 18px;
  line-height: 1.55;
  field-sizing: content;
  &:focus-visible {
    outline: none;
  }
`;

const SquareButton = styled(Button)`
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 10px;
  font-size: 20px;
  flex: none;
`;

const MetaRow = styled(Row)`
  justify-content: space-between;
  gap: 10px;
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.muted};
  margin-top: 8px;
  padding: 0 4px;
`;

const DEFAULT_BUSY_STATUS = "Writing…";

function statusLine(isBusy, busyStatus) {
  if (!isBusy) {
    return COMPOSER_HINT;
  }
  return busyStatus || DEFAULT_BUSY_STATUS;
}

export function Composer({
  draft,
  isBusy,
  busyStatus,
  tokenEstimate,
  pendingShift,
  onDraftChange,
  onSend,
  onStop,
  onUndoShift,
}) {
  function sendDraft() {
    const text = draft.trim();
    if (!text || isBusy) {
      return;
    }
    onSend(text);
  }

  function handleKeyPress(keyPress) {
    const isPlainEnter = keyPress.key === "Enter" && !keyPress.shiftKey && !keyPress.isComposing;
    if (isPlainEnter) {
      keyPress.preventDefault();
      sendDraft();
    }
  }

  const showsPendingShift = Boolean(pendingShift) && !isBusy;

  return (
    <Container>
      <Inner>
        {showsPendingShift && <ShiftPending summary={pendingShift.summary} onUndo={onUndoShift} />}
        <InputBox>
          <MessageInput
            nativeID="composer-input"
            rows={1}
            accessibilityLabel="Message"
            placeholder="Say something, or *do* something…"
            value={draft}
            onChangeText={onDraftChange}
            onKeyPress={handleKeyPress}
          />
          {isBusy && <SquareButton label="■" accessibilityLabel="Stop" onPress={onStop} />}
          {!isBusy && (
            <SquareButton
              label="↑"
              variant="primary"
              accessibilityLabel="Send"
              onPress={sendDraft}
            />
          )}
        </InputBox>
        <MetaRow>
          <Text>{statusLine(isBusy, busyStatus)}</Text>
          <Text>{tokenEstimate}</Text>
        </MetaRow>
      </Inner>
    </Container>
  );
}
