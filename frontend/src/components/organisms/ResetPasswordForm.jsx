// Choosing a new password, after following the emailed reset link. Asked twice so a typo
// doesn't lock the account.
import { useState } from "react";
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Heading2, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";
import { MIN_PASSWORD_LENGTH } from "../../content/account.js";

const MISMATCH_MESSAGE = "The two passwords don't match yet.";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

export function ResetPasswordForm({ error, isBusy, onResetPassword, onShowSignIn }) {
  const [newPassword, setNewPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const isLongEnough = newPassword.length >= MIN_PASSWORD_LENGTH;
  const isRepeated = newPassword === repeatedPassword;
  const canSubmit = isLongEnough && isRepeated && !isBusy;
  const showsMismatch = repeatedPassword.length > 0 && !isRepeated;

  function submit() {
    if (canSubmit) {
      onResetPassword({ newPassword });
    }
  }

  return (
    <>
      <Heading2>Choose a new password</Heading2>
      <FormField label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        <TextField
          accessibilityLabel="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      <FormField label="New password again">
        <TextField
          accessibilityLabel="New password again"
          secureTextEntry
          value={repeatedPassword}
          onChangeText={setRepeatedPassword}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      {showsMismatch && <StatusText $isError>{MISMATCH_MESSAGE}</StatusText>}
      {error && <StatusText $isError>{error}</StatusText>}
      <Actions>
        <Button
          label={isBusy ? "Saving…" : "Save new password"}
          variant="primary"
          isWide
          disabled={!canSubmit}
          onPress={submit}
        />
        <AuthSwitch actionLabel="Back to sign in" onPress={onShowSignIn} />
      </Actions>
    </>
  );
}
