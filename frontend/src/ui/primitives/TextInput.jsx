// Text entry with React Native's props: value, onChangeText, multiline, secureTextEntry, editable.
// onKeyPress receives { key, shiftKey, preventDefault } so callers can handle Enter the same way on both platforms.
// `suggestions` offers a list of values to pick from while typing.
import { forwardRef, useId } from "react";

function chooseInputType({ secureTextEntry, keyboardType }) {
  if (secureTextEntry) {
    return "password";
  }
  if (keyboardType === "numeric") {
    return "number";
  }
  return "text";
}

export const TextInput = forwardRef(function TextInput(
  {
    value,
    onChangeText,
    onBlur,
    onKeyPress,
    multiline = false,
    secureTextEntry = false,
    editable = true,
    readOnly = false,
    placeholder,
    accessibilityLabel,
    nativeID,
    keyboardType,
    suggestions,
    className,
    style,
    rows,
  },
  ref,
) {
  const suggestionListId = useId();
  const sharedProps = {
    ref,
    id: nativeID,
    className,
    style,
    value: value ?? "",
    placeholder,
    disabled: !editable,
    readOnly,
    "aria-label": accessibilityLabel,
    onChange: (event) => onChangeText?.(event.target.value),
    onBlur: (event) => onBlur?.(event.target.value),
    onKeyDown: (event) => {
      onKeyPress?.({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        preventDefault: () => event.preventDefault(),
      });
    },
  };

  if (multiline) {
    return <textarea {...sharedProps} rows={rows ?? 3} />;
  }

  const inputType = chooseInputType({ secureTextEntry, keyboardType });
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;
  return (
    <>
      <input
        {...sharedProps}
        type={inputType}
        autoComplete="off"
        list={hasSuggestions ? suggestionListId : undefined}
      />
      {hasSuggestions && (
        <datalist id={suggestionListId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion.value} value={suggestion.value}>
              {suggestion.label}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
});
