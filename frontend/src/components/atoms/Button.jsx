// A pressable button. Variants: "default" (outlined), "primary" (filled), "ghost" (text only),
// "danger" (danger-coloured text), "dashed" (an outlined add-something button) and "icon" (round).
// Sizes: "regular", "small". `icon` is an optional symbol shown before the label.
import styled, { css } from "styled-components";
import { Pressable, Text } from "../../ui/primitives/index.js";

const variantStyles = {
  default: css`
    background: ${({ theme }) => theme.colors.panel};
    border-color: ${({ theme }) => theme.colors.lineStrong};
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.accent};
    }
  `,
  primary: css`
    background: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
  `,
  ghost: css`
    background: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.colors.muted};
    &:hover:not(:disabled) {
      color: ${({ theme }) => theme.colors.ink};
    }
  `,
  danger: css`
    background: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.colors.danger};
    padding-left: 4px;
    padding-right: 4px;
    &:hover:not(:disabled) {
      text-decoration: underline;
    }
  `,
  dashed: css`
    background: transparent;
    border-style: dashed;
    border-color: ${({ theme }) => theme.colors.lineStrong};
    color: ${({ theme }) => theme.colors.muted};
    font-weight: 500;
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.accent};
      color: ${({ theme }) => theme.colors.ink};
    }
  `,
  icon: css`
    background: ${({ theme }) => theme.colors.panel};
    border-color: ${({ theme }) => theme.colors.line};
    border-radius: 50%;
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    line-height: 1;
    font-size: 18px;
  `,
};

const StyledPressable = styled(Pressable)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid;
  border-radius: ${({ theme }) => theme.radii.small};
  padding: ${({ $size }) => ($size === "small" ? "4px 10px" : "8px 16px")};
  font-size: ${({ $size, theme }) => ($size === "small" ? theme.fontSizes.label : "16px")};
  width: ${({ $isWide }) => ($isWide ? "100%" : "auto")};
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    filter 0.15s;
  ${({ $variant }) => variantStyles[$variant]}

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const IconMark = styled(Text)`
  font-size: 1.05em;
  line-height: 1;
`;

export function Button({
  label,
  icon,
  variant = "default",
  size = "regular",
  isWide = false,
  ...pressableProps
}) {
  return (
    <StyledPressable $variant={variant} $size={size} $isWide={isWide} {...pressableProps}>
      {icon && <IconMark aria-hidden="true">{icon}</IconMark>}
      {label}
    </StyledPressable>
  );
}
