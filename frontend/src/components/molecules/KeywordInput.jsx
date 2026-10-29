// Keywords typed as a comma-separated list. Saves the cleaned list when the field loses focus.
import { useEffect, useState } from "react";
import { TextField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

const KEYWORD_SEPARATOR = ",";

export function joinKeywords(keywords) {
  return (keywords ?? []).join(`${KEYWORD_SEPARATOR} `);
}

export function splitKeywords(text) {
  const keywords = text.split(KEYWORD_SEPARATOR).map((keyword) => keyword.trim());
  return keywords.filter((keyword) => keyword.length > 0);
}

export function KeywordInput({ label = "Keywords", hint, keywords, placeholder, onChange }) {
  const [typedText, setTypedText] = useState(joinKeywords(keywords));
  useEffect(() => {
    setTypedText(joinKeywords(keywords));
  }, [keywords]);

  function saveIfChanged() {
    const cleanedKeywords = splitKeywords(typedText);
    if (joinKeywords(cleanedKeywords) !== joinKeywords(keywords)) {
      onChange(cleanedKeywords);
    }
  }

  return (
    <FormField label={label} hint={hint ?? "Separate with commas."}>
      <TextField
        accessibilityLabel={label}
        value={typedText}
        placeholder={placeholder}
        onChangeText={setTypedText}
        onBlur={saveIfChanged}
      />
    </FormField>
  );
}
