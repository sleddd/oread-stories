// A numeric slider with the props of React Native's community Slider:
// value, minimumValue, maximumValue, step, onValueChange.

export function Slider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  accessibilityLabel,
  nativeID,
  className,
}) {
  return (
    <input
      type="range"
      id={nativeID}
      className={className}
      min={minimumValue}
      max={maximumValue}
      step={step}
      value={value}
      aria-label={accessibilityLabel}
      onChange={(event) => onValueChange?.(parseFloat(event.target.value))}
    />
  );
}
