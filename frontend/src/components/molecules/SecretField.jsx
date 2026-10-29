// A write-only secret such as an API key. The value is never shown, only where it comes from.
import { useState } from "react";
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

const InputRow = styled(Row)`
  gap: 6px;
  & > input {
    flex: 1;
  }
`;

const SourceText = styled(Text)`
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ $isSet, theme }) => ($isSet ? theme.colors.positive : theme.colors.muted)};
`;

function describeSource(secretState) {
  if (secretState?.source === "saved") {
    return `Saved ${secretState.hint}`;
  }
  if (secretState?.source === "env") {
    return `From environment ${secretState.hint}`;
  }
  return "Not set";
}

export function SecretField({ label, hint, secretState, onSave, onClear }) {
  const [typedValue, setTypedValue] = useState("");
  const isSet = Boolean(secretState?.source);
  const isSaved = secretState?.source === "saved";

  function saveTypedValue() {
    const trimmedValue = typedValue.trim();
    if (!trimmedValue) {
      return;
    }
    onSave(trimmedValue);
    setTypedValue("");
  }

  return (
    <FormField label={label} hint={hint}>
      <InputRow>
        <TextField
          secureTextEntry
          accessibilityLabel={label}
          value={typedValue}
          placeholder={isSet ? "Paste to replace" : "Paste to save"}
          onChangeText={setTypedValue}
          onBlur={saveTypedValue}
          onKeyPress={(keyPress) => {
            if (keyPress.key === "Enter") {
              saveTypedValue();
            }
          }}
        />
        {isSaved && <Button label="Clear" size="small" onPress={onClear} />}
      </InputRow>
      <SourceText $isSet={isSet}>{describeSource(secretState)}</SourceText>
    </FormField>
  );
}
