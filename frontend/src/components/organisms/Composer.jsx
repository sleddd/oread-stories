// The message box. Enter sends and Shift+Enter starts a new line; while a reply is written, the button stops it.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button, TextArea } from "../atoms/index.js";
import { ShiftPending } from "../molecules/index.js";
import { COMPOSER_HINT } from "../../content/copy.js";

const Container = styled(View)`
  border-top: 1px solid ${({ theme }) => theme.colors.line};
  padding: 10px 16px 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.panel};
`;

const Inner = styled(View)`
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
`;

const InputRow = styled(Row)`
  gap: 8px;
  align-items: flex-end;
`;

const MessageInput = styled(TextArea)`
  flex: 1;
  resize: none;
  max-height: 40vh;
  font-family: ${({ theme }) => theme.fonts.serif};
  line-height: 1.5;
  field-sizing: content;
`;

const MetaRow = styled(Row)`
  justify-content: space-between;
  gap: 10px;
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.muted};
  margin-top: 5px;
`;

export function Composer({ draft, isBusy, tokenEstimate, pendingShift, onDraftChange, onSend, onStop, onUndoShift }) {
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
        <InputRow>
          <MessageInput
            nativeID="composer-input"
            rows={1}
            accessibilityLabel="Message"
            placeholder="Say something, or *do* something…"
            value={draft}
            onChangeText={onDraftChange}
            onKeyPress={handleKeyPress}
          />
          {isBusy && <Button label="Stop" onPress={onStop} />}
          {!isBusy && <Button label="Send" variant="primary" onPress={sendDraft} />}
        </InputRow>
        <MetaRow>
          <Text>{isBusy ? "Writing…" : COMPOSER_HINT}</Text>
          <Text>{tokenEstimate}</Text>
        </MetaRow>
      </Inner>
    </Container>
  );
}
