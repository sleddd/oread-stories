// A model ID field with a "Fetch models" button. Fetched models come back as a dropdown rather
// than typing suggestions: a browser filters suggestions by the text already in the field, so
// once a model was saved it would be the only one offered.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, SelectField, TextField } from "../atoms/index.js";
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

  function saveIfChanged(newValue) {
    const trimmedValue = newValue.trim();
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }
  }

  function chooseFetchedModel(modelId) {
    if (!modelId) {
      return;
    }
    setTypedValue(modelId);
    saveIfChanged(modelId);
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
          onChangeText={setTypedValue}
          onBlur={() => saveIfChanged(typedValue)}
        />
        <Button
          label={isFetching ? "Fetching…" : "Fetch models"}
          size="small"
          disabled={isFetching}
          onPress={fetchModels}
        />
      </InputRow>
      {suggestions.length > 0 && (
        <SelectField
          accessibilityLabel={`${label}: fetched models`}
          selectedValue={typedValue}
          items={suggestions}
          placeholder="Choose a fetched model"
          onValueChange={chooseFetchedModel}
        />
      )}
    </FormField>
  );
}
