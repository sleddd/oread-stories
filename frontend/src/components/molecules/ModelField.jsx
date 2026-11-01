// A model ID field that searches the provider's models. "Fetch models" opens a list of what the
// provider offers, starting from everything; from then on, typing narrows it (Featherless alone has tens of thousands, so
// the search runs on the server). Choosing a model saves it. A model ID that isn't listed, such
// as a Bedrock inference profile, is saved with Enter, or when the field loses focus while no
// list is open.
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";
import { ModelSuggestionList } from "./ModelSuggestionList.jsx";

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 350;

const InputRow = styled(Row)`
  gap: 6px;
  & > input {
    flex: 1;
  }
`;

// onFetchModels(search) resolves to [{ id, label }]; onFetched({ count } | { error }) reports the
// first fetch, and any failed search.
export function ModelField({ label, hint, value, onSave, onFetchModels, onFetched }) {
  const [typedValue, setTypedValue] = useState(value);
  const [models, setModels] = useState([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingSearch, setPendingSearch] = useState(null);
  // Only the newest search may fill the list; an older one finishing late is ignored.
  const latestSearchRef = useRef(0);

  useEffect(() => {
    setTypedValue(value);
  }, [value]);

  function saveIfChanged(newValue) {
    const trimmedValue = newValue.trim();
    if (trimmedValue !== value) {
      onSave(trimmedValue);
    }
  }

  async function search(searchText, { isFirstFetch = false } = {}) {
    latestSearchRef.current += 1;
    const searchNumber = latestSearchRef.current;
    setIsSearching(true);
    try {
      const foundModels = await onFetchModels(searchText);
      if (searchNumber !== latestSearchRef.current) {
        return;
      }
      setModels(foundModels);
      setIsListOpen(true);
      if (isFirstFetch) {
        onFetched({ count: foundModels.length });
      }
    } catch (error) {
      onFetched({ error });
    } finally {
      if (searchNumber === latestSearchRef.current) {
        setIsSearching(false);
      }
    }
  }

  useEffect(() => {
    if (pendingSearch === null) {
      return undefined;
    }
    const timer = setTimeout(() => search(pendingSearch), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `search` is rebuilt every render; only a new search text should start a request.
  }, [pendingSearch]);

  function changeText(text) {
    setTypedValue(text);
    if (isListOpen) {
      setPendingSearch(text.trim());
    }
  }

  function chooseModel(modelId) {
    setTypedValue(modelId);
    setIsListOpen(false);
    setPendingSearch(null);
    saveIfChanged(modelId);
  }

  function closeList() {
    setIsListOpen(false);
    setPendingSearch(null);
  }

  function handleKeyPress(keyEvent) {
    if (keyEvent.key === "Enter" && !keyEvent.isComposing) {
      keyEvent.preventDefault();
      closeList();
      saveIfChanged(typedValue);
      return;
    }
    if (keyEvent.key === "Escape") {
      closeList();
    }
  }

  // With the list open, leaving the field (often to press a model in the list) must not save a
  // half-typed search as the model.
  function handleBlur() {
    if (!isListOpen) {
      saveIfChanged(typedValue);
    }
  }

  return (
    <FormField label={label} hint={hint}>
      <InputRow>
        <TextField
          accessibilityLabel={label}
          value={typedValue}
          placeholder="Type a model ID, or fetch the list and search it"
          onChangeText={changeText}
          onKeyPress={handleKeyPress}
          onBlur={handleBlur}
        />
        {isListOpen ? (
          <Button label="Close list" size="small" onPress={closeList} />
        ) : (
          <Button
            label={isSearching ? "Fetching…" : "Fetch models"}
            size="small"
            disabled={isSearching}
            onPress={() => search("", { isFirstFetch: true })}
          />
        )}
      </InputRow>
      {isListOpen && (
        <ModelSuggestionList
          models={models}
          currentModelId={value}
          isSearching={isSearching}
          onChoose={chooseModel}
        />
      )}
    </FormField>
  );
}
