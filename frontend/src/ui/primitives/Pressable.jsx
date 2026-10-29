// Anything that can be pressed. Uses React Native's prop names: onPress, disabled, accessibilityLabel.
// `isPressed` marks a toggle as on; `isSelected` marks the current tab; `isChecked` marks the
// chosen radio option; `isExpanded` marks an open disclosure.

export function Pressable({
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityRole,
  isPressed,
  isSelected,
  isChecked,
  isExpanded,
  title,
  className,
  style,
  children,
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={disabled}
      title={title}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-pressed={isPressed}
      aria-selected={isSelected}
      aria-checked={isChecked}
      aria-expanded={isExpanded}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
