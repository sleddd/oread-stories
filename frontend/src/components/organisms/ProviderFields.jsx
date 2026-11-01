// One provider's fields from content/providers.js: its keys (kept by the backend, shown only as
// hints), its model (searchable once fetched) and any plain settings such as a base URL. Each
// field saves on its own. Shared by Settings and the first-run setup.
import { useEffect, useState } from "react";
import { View } from "../../ui/primitives/index.js";
import { TextField } from "../atoms/index.js";
import { FormField, SecretField, ModelField } from "../molecules/index.js";

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

// onSaveField(providerId, fieldKey, value); onFetchModels(providerId, search).
export function ProviderFields({ provider, settings, onSaveField, onFetchModels, onFetched }) {
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
          onFetchModels={(search) => onFetchModels(provider.id, search)}
          onFetched={onFetched}
        />
      );
    }
    return (
      <PlainTextField key={field.key} field={field} value={values[field.key] ?? ""} onSave={save} />
    );
  }

  return <View>{provider.fields.map(renderField)}</View>;
}
