// Asking for a password-reset link by email.
import { useState } from "react";
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Heading2, Lede, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

export function ForgotPasswordForm({
  error,
  initialEmail = "",
  isBusy,
  onRequestReset,
  onShowSignIn,
}) {
  const [email, setEmail] = useState(initialEmail);
  const canSubmit = Boolean(email.trim()) && !isBusy;

  function submit() {
    if (canSubmit) {
      onRequestReset({ email: email.trim() });
    }
  }

  return (
    <>
      <Heading2>Reset your password</Heading2>
      <Lede>Enter your account's email and we'll send you a link to choose a new password.</Lede>
      <FormField label="Email">
        <TextField
          accessibilityLabel="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      {error && <StatusText $isError>{error}</StatusText>}
      <Actions>
        <Button
          label={isBusy ? "Sending…" : "Send reset link"}
          variant="primary"
          isWide
          disabled={!canSubmit}
          onPress={submit}
        />
        <AuthSwitch question="Remembered it?" actionLabel="Sign in" onPress={onShowSignIn} />
      </Actions>
    </>
  );
}
