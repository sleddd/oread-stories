// A model ID field with a "Fetch models" button that fills in suggestions from the provider.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

const InputRow = styled(Row)`
  gap: 6px;
  & > input {
    flex: 1;
  }
`;

export function ModelField({ label, hint, value, onSave, onFetchModels, onFetched }) {
  const [typedValue, setTypedValue] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    setTypedValue(value);
  }, [value]);

  function saveIfChanged() {
    const trimmedValue = typedValue.trim();
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }
  }

  async function fetchModels() {
    setIsFetching(true);
    try {
      const models = await onFetchModels();
      setSuggestions(models.map((model) => ({ value: model.id, label: model.label })));
      onFetched({ count: models.length });
    } catch (error) {
      onFetched({ error });
    } finally {
      setIsFetching(false);
    }
  }

  return (
    <FormField label={label} hint={hint}>
      <InputRow>
        <TextField
          accessibilityLabel={label}
          value={typedValue}
          placeholder="Type a model ID or fetch the list"
          suggestions={suggestions}
          onChangeText={setTypedValue}
          onBlur={saveIfChanged}
        />
        <Button
          label={isFetching ? "Fetching…" : "Fetch models"}
          size="small"
          disabled={isFetching}
          onPress={fetchModels}
        />
      </InputRow>
    </FormField>
  );
}
