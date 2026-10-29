// A pressable button. Variants: "default", "primary", "ghost", "icon". Sizes: "regular", "small".
import styled, { css } from "styled-components";
import { Pressable } from "../../ui/primitives/index.js";

const variantStyles = {
  default: css`
    background: ${({ theme }) => theme.colors.chip};
    border-color: ${({ theme }) => theme.colors.line};
  `,
  primary: css`
    background: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
  `,
  ghost: css`
    background: transparent;
    border-color: transparent;
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.line};
    }
  `,
  icon: css`
    background: ${({ theme }) => theme.colors.chip};
    border-color: ${({ theme }) => theme.colors.line};
    padding: 5px 10px;
    line-height: 1;
    font-size: 18px;
  `,
};

const StyledPressable = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid;
  border-radius: ${({ theme }) => theme.radii.small};
  padding: ${({ $size }) => ($size === "small" ? "3px 9px" : "7px 14px")};
  font-size: ${({ $size, theme }) => ($size === "small" ? theme.fontSizes.label : "inherit")};
  width: ${({ $isWide }) => ($isWide ? "100%" : "auto")};
  cursor: pointer;
  ${({ $variant }) => variantStyles[$variant]}

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
`;

export function Button({ label, variant = "default", size = "regular", isWide = false, ...pressableProps }) {
  return (
    <StyledPressable $variant={variant} $size={size} $isWide={isWide} {...pressableProps}>
      {label}
    </StyledPressable>
  );
}
