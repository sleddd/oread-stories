// A button that is just an icon. It always has an accessible name (`label`), which is also its
// tooltip. "plain" sits quietly in a row of tools; "round" is a circled control like the theme
// toggle.
import styled, { css } from "styled-components";
import { Pressable } from "../../ui/primitives/index.js";
import { Icon } from "./Icon.jsx";

const PLAIN_SIZE = 30;
const ROUND_SIZE = 42;

const SHAPES = {
  plain: css`
    width: ${PLAIN_SIZE}px;
    height: ${PLAIN_SIZE}px;
    border-radius: ${({ theme }) => theme.radii.small};
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.muted};
    &:hover:not(:disabled) {
      color: ${({ theme }) => theme.colors.ink};
      background: ${({ theme }) => theme.colors.segment};
    }
  `,
  round: css`
    width: ${ROUND_SIZE}px;
    height: ${ROUND_SIZE}px;
    border-radius: 50%;
    border: 1px solid ${({ theme }) => theme.colors.line};
    background: ${({ theme }) => theme.colors.panel};
    color: ${({ theme }) => theme.colors.ink};
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.lineStrong};
    }
  `,
};

const StyledPressable = styled(Pressable)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  padding: 0;
  cursor: pointer;
  ${({ $shape }) => SHAPES[$shape]}
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export function IconButton({ icon, label, shape = "plain", iconSize, ...pressableProps }) {
  return (
    <StyledPressable $shape={shape} accessibilityLabel={label} title={label} {...pressableProps}>
      <Icon name={icon} size={iconSize} />
    </StyledPressable>
  );
}
