// Creating an account: a name, an email and a password. The account works once the emailed
// confirmation link is followed.
import { useState } from "react";
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Heading2, StatusText, TextField } from "../atoms/index.js";
import { AuthSwitch, FormField } from "../molecules/index.js";
import { submitOnEnter } from "../../lib/submitOnEnter.js";
import { MIN_PASSWORD_LENGTH } from "../../content/account.js";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

export function SignUpForm({ error, isBusy, onSignUp, onShowSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isPasswordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = Boolean(name.trim() && email.trim()) && isPasswordLongEnough && !isBusy;

  function submit() {
    if (canSubmit) {
      onSignUp({ name: name.trim(), email: email.trim(), password });
    }
  }

  return (
    <>
      <Heading2>Create an account</Heading2>
      <FormField label="Name">
        <TextField
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      <FormField label="Email">
        <TextField
          accessibilityLabel="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onKeyPress={submitOnEnter(submit)}
        />
      </FormField>
      <FormField label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
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
          label={isBusy ? "Creating…" : "Create account"}
          variant="primary"
          isWide
          disabled={!canSubmit}
          onPress={submit}
        />
        <AuthSwitch
          question="Already have an account?"
          actionLabel="Sign in"
          onPress={onShowSignIn}
        />
      </Actions>
    </>
  );
}
