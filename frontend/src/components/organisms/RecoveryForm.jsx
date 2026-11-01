// After a password reset the new password can't open the old encrypted data, so this asks for
// the recovery code that was shown when the account was set up. Without it, the only way on is
// to start over, which erases everything; that needs the word typed out, so it can't happen by
// accident.
import { useState } from "react";
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Heading2, Heading3, Lede, Note, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";

const RECOVERY_EXPLANATION =
  "Your password changed, and your stories are encrypted with the old one. Your recovery code " +
  "opens them again.";
const START_OVER_WARNING =
  "Without the recovery code your stories, chats, memories and settings can't be opened by " +
  "anyone, including us. Starting over erases them for good and gives you a fresh account.";
const START_OVER_WORD = "erase";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

const StartOver = styled(View)`
  gap: 8px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

export function RecoveryForm({ error, isBusy, onRecover, onStartOver, onBack }) {
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const hasPassword = password.length > 0;
  const canRecover = hasPassword && recoveryCode.trim().length > 0 && !isBusy;
  const isStartOverConfirmed = typedConfirmation.trim().toLowerCase() === START_OVER_WORD;
  const canStartOver = hasPassword && isStartOverConfirmed && !isBusy;

  function recover() {
    if (canRecover) {
      onRecover({ password, recoveryCode });
    }
  }

  return (
    <>
      <Heading2>Recover your stories</Heading2>
      <Lede>{RECOVERY_EXPLANATION}</Lede>
      <FormField label="Your current password">
        <TextField
          accessibilityLabel="Your current password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </FormField>
      <FormField label="Recovery code" hint="The code in groups of four, like ABCD-EFGH-…">
        <TextField
          accessibilityLabel="Recovery code"
          value={recoveryCode}
          onChangeText={setRecoveryCode}
          onKeyPress={submitOnEnter(recover)}
        />
      </FormField>
      {error && <StatusText $isError>{error}</StatusText>}
      <Actions>
        <Button
          label={isBusy ? "Opening…" : "Recover my stories"}
          variant="primary"
          isWide
          disabled={!canRecover}
          onPress={recover}
        />
        <AuthSwitch actionLabel="Back" onPress={onBack} />
      </Actions>
      <StartOver>
        <Heading3>Lost the recovery code?</Heading3>
        <Note>{START_OVER_WARNING}</Note>
        <FormField label={`Type "${START_OVER_WORD}" to confirm`}>
          <TextField
            accessibilityLabel={`Type ${START_OVER_WORD} to confirm`}
            value={typedConfirmation}
            onChangeText={setTypedConfirmation}
          />
        </FormField>
        <Button
          label="Erase everything and start over"
          variant="danger"
          isWide
          disabled={!canStartOver}
          onPress={() => onStartOver({ password })}
        />
      </StartOver>
    </>
  );
}
