// Shows a newly made recovery code, once. It is the only way back into the encrypted stories if
// the password is ever forgotten, and it is never shown again, so the person has to say they've
// kept it before going on.
import { useState } from "react";
import styled from "styled-components";
import { Text, View } from "../../ui/primitives/index.js";
import { Button, Heading2, Lede, Note, StatusText } from "../atoms/index.js";

const EXPLANATION =
  "Your stories, chats and memories are encrypted so that only you can read them. If you ever " +
  "forget your password, this code is the only way to open them again. Nobody, including us, " +
  "can recover them without it.";
const KEEPING_ADVICE =
  "Keep it somewhere safe outside Oread: a password manager, or written down. This is the only " +
  "time it is shown.";
const COPIED_MESSAGE = "Copied.";
const COPY_FAILED_MESSAGE = "Couldn't copy it. Select the code and copy it by hand.";

const CodeBox = styled(View)`
  margin: 14px 0;
  padding: 14px 16px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.field};
`;

const Code = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 17px;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  user-select: all;
`;

const Actions = styled(View)`
  gap: 10px;
  margin-top: 6px;
`;

// onCopy(text) resolves to whether it was copied.
export function RecoveryCodeNotice({ recoveryCode, onCopy, onSaved }) {
  const [copyStatus, setCopyStatus] = useState(null);

  async function copy() {
    const isCopied = await onCopy(recoveryCode);
    if (isCopied) {
      setCopyStatus(COPIED_MESSAGE);
      return;
    }
    setCopyStatus(COPY_FAILED_MESSAGE);
  }

  return (
    <>
      <Heading2>Save your recovery code</Heading2>
      <Lede>{EXPLANATION}</Lede>
      <CodeBox>
        <Code>{recoveryCode}</Code>
      </CodeBox>
      <Note>{KEEPING_ADVICE}</Note>
      {copyStatus && <StatusText>{copyStatus}</StatusText>}
      <Actions>
        <Button label="Copy the code" isWide onPress={copy} />
        <Button label="I've saved it" variant="primary" isWide onPress={onSaved} />
      </Actions>
    </>
  );
}
