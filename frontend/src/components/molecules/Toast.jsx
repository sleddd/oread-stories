// The short notice that pops up at the bottom of the screen.
import styled from "styled-components";
import { Text } from "../../ui/primitives/index.js";

const Notice = styled(Text).attrs({ role: "status", "aria-live": "polite" })`
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translate(-50%, ${({ $isVisible }) => ($isVisible ? "0" : "20px")});
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  pointer-events: none;
  transition: 0.2s;
  max-width: min(92vw, 560px);
  z-index: 50;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 15.5px;
  background: ${({ $isError, theme }) => ($isError ? theme.colors.danger : theme.colors.ink)};
  color: ${({ $isError, theme }) => ($isError ? "#ffffff" : theme.colors.background)};
`;

export function Toast({ toast }) {
  return (
    <Notice $isVisible={Boolean(toast)} $isError={toast?.kind === "error"}>
      {toast?.message ?? ""}
    </Notice>
  );
}
