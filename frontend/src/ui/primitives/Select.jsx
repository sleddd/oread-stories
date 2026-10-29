// A single choice from a list, shaped like React Native's Picker:
// selectedValue, onValueChange and items of { label, value }.

export function Select({ selectedValue, onValueChange, items, placeholder, accessibilityLabel, className }) {
  return (
    <select
      className={className}
      value={selectedValue ?? ""}
      aria-label={accessibilityLabel}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
