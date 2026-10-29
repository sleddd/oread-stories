// Signing in with email and password. A notice above the form says what just happened, such as
// where a confirmation or reset email went.
import { useState } from "react";
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { Button, Heading2, LinkButton, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

const Notice = styled(Text).attrs({ role: "status" })`
  display: block;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.ink};
  font-size: 14.5px;
`;

export function SignInForm({
  error,
  notice,
  initialEmail = "",
  isBusy,
  onSignIn,
  onShowSignUp,
  onForgotPassword,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const canSubmit = Boolean(email.trim() && password) && !isBusy;

  function submit() {
    if (canSubmit) {
      onSignIn({ email: email.trim(), password });
    }
  }

  return (
    <>
      <Heading2>Sign in</Heading2>
      {notice && <Notice>{notice}</Notice>}
      <FormField label="Email">
        <TextField
          accessibilityLabel="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      <FormField label="Password">
        <TextField
          accessibilityLabel="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      <LinkButton label="Forgot password?" onPress={onForgotPassword} />
      {error && <StatusText $isError>{error}</StatusText>}
      <Actions>
        <Button
          label={isBusy ? "Signing in…" : "Sign in"}
          variant="primary"
          isWide
          disabled={!canSubmit}
          onPress={submit}
        />
        <AuthSwitch
          question="New to Oread?"
          actionLabel="Create an account"
          onPress={onShowSignUp}
        />
      </Actions>
    </>
  );
}
