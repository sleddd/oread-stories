// One provider's settings: credentials, model, other fields, "Use for chat" and a connection test.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button, Heading2, RadioOption, StatusText, TextField } from "../atoms/index.js";
import { FormField, SecretField, ModelField } from "../molecules/index.js";

const Card = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ $isActive, theme }) => ($isActive ? theme.colors.accent : theme.colors.line)};
  box-shadow: ${({ $isActive, theme }) => ($isActive ? `0 0 0 1px ${theme.colors.accent}` : "none")};
  border-radius: ${({ theme }) => theme.radii.medium};
  padding: 14px 16px;
`;

const Header = styled(Row)`
  justify-content: space-between;
  gap: 10px;
`;

const Description = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
  margin: 2px 0 8px;
`;

const Actions = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

function PlainTextField({ field, value, onSave }) {
  const [typedValue, setTypedValue] = useState(value);
  useEffect(() => {
    setTypedValue(value);
  }, [value]);
  return (
    <FormField label={field.label} hint={field.hint}>
      <TextField
        accessibilityLabel={field.label}
        value={typedValue}
        onChangeText={setTypedValue}
        onBlur={() => {
          if (typedValue.trim() !== value) {
            onSave(typedValue.trim());
          }
        }}
      />
    </FormField>
  );
}

function ConnectionTest({ providerId, onTest }) {
  const [status, setStatus] = useState({ text: "", isError: false });
  const [isTesting, setIsTesting] = useState(false);

  async function runTest() {
    setIsTesting(true);
    setStatus({ text: "Testing…", isError: false });
    try {
      const result = await onTest(providerId);
      const seconds = (result.ms / 1000).toFixed(1);
      const reply = (result.reply || "").slice(0, 40) || "(empty reply)";
      setStatus({ text: `Connected to ${result.model} in ${seconds}s — “${reply}”`, isError: false });
    } catch (error) {
      setStatus({ text: error.message, isError: true });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Actions>
      <Button label="Test connection" disabled={isTesting} onPress={runTest} />
      <StatusText $isError={status.isError}>{status.text}</StatusText>
    </Actions>
  );
}

export function ProviderCard({ provider, settings, onUse, onSaveField, onFetchModels, onFetched, onTest }) {
  const isActive = settings.provider === provider.id;
  const values = settings[provider.id] ?? {};
  const secrets = settings.secrets?.[provider.id] ?? {};

  function renderField(field) {
    const save = (value) => onSaveField(provider.id, field.key, value);
    if (field.kind === "secret") {
      return (
        <SecretField
          key={field.key}
          label={field.label}
          hint={field.hint}
          secretState={secrets[field.key]}
          onSave={save}
          onClear={() => save(null)}
        />
      );
    }
    if (field.kind === "model") {
      return (
        <ModelField
          key={field.key}
          label={field.label}
          hint={field.hint}
          value={values[field.key] ?? ""}
          onSave={save}
          onFetchModels={() => onFetchModels(provider.id)}
          onFetched={onFetched}
        />
      );
    }
    return <PlainTextField key={field.key} field={field} value={values[field.key] ?? ""} onSave={save} />;
  }

  return (
    <Card as="section" $isActive={isActive}>
      <Header>
        <Heading2>{provider.name}</Heading2>
        <RadioOption label="Use for chat" isSelected={isActive} onSelect={() => onUse(provider.id)} />
      </Header>
      <Description>{provider.description}</Description>
      {provider.fields.map(renderField)}
      <ConnectionTest providerId={provider.id} onTest={onTest} />
    </Card>
  );
}
