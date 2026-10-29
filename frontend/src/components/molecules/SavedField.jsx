// A labelled text field that saves when it loses focus, and only if the text changed. Typing
// stays local until then, so long text isn't sent on every keystroke.
import { useEffect, useState } from "react";
import { TextField, TextArea } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

export function SavedField({ label, hint, value, placeholder, isMultiline = false, rows, onSave }) {
  const [typedValue, setTypedValue] = useState(value ?? "");
  useEffect(() => {
    setTypedValue(value ?? "");
  }, [value]);

  function saveIfChanged() {
    if (typedValue !== (value ?? "")) {
      onSave(typedValue);
    }
  }

  const Field = isMultiline ? TextArea : TextField;
  return (
    <FormField label={label} hint={hint}>
      <Field
        accessibilityLabel={label}
        value={typedValue}
        placeholder={placeholder}
        rows={rows}
        onChangeText={setTypedValue}
        onBlur={saveIfChanged}
      />
    </FormField>
  );
}
