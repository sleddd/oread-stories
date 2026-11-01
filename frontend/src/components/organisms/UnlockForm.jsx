// Asks for the password to open a signed-in account's encrypted stories, for a session that
// isn't unlocked yet (right after confirming the email, or on a browser that lost its unlock).
import { useState } from "react";
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Heading2, Lede, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";

const EXPLANATION =
  "Your stories and chats are encrypted with your password, so only you can open them. " +
  "Enter it to carry on.";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

export function UnlockForm({ error, isBusy, onUnlock, onForgotPassword, onSignOut }) {
  const [password, setPassword] = useState("");
  const canSubmit = password.length > 0 && !isBusy;

  function submit() {
    if (canSubmit) {
      onUnlock({ password });
    }
  }

  return (
    <>
      <Heading2>Open your stories</Heading2>
      <Lede>{EXPLANATION}</Lede>
      <FormField label="Password">
        <TextField
          accessibilityLabel="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      {error && <StatusText $isError>{error}</StatusText>}
      <Actions>
        <Button
          label={isBusy ? "Opening…" : "Open"}
          variant="primary"
          isWide
          disabled={!canSubmit}
          onPress={submit}
        />
        <AuthSwitch
          question="Reset your password?"
          actionLabel="Use your recovery code"
          onPress={onForgotPassword}
        />
        <AuthSwitch actionLabel="Sign out" onPress={onSignOut} />
      </Actions>
    </>
  );
}
