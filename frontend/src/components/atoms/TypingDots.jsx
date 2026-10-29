// Three dots that bounce one after another while a reply is being written. For people who ask
// their system for less motion, the dots stay still.
import styled, { keyframes } from "styled-components";
import { Row, View } from "../../ui/primitives/index.js";

const DOT_SIZE = 7;
const BOUNCE_DURATION = "1.2s";
// Each dot starts a little after the one before it, so the bounce travels along the row.
const DOT_DELAYS = ["0s", "0.15s", "0.3s"];

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-6px); opacity: 1; }
`;

const Dots = styled(Row)`
  gap: 5px;
  height: 24px;
  align-items: center;
`;

const Dot = styled(View)`
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
  animation: ${bounce} ${BOUNCE_DURATION} ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.7;
  }
`;

export function TypingDots({ accessibilityLabel = "Writing" }) {
  return (
    <Dots role="status" aria-label={accessibilityLabel}>
      {DOT_DELAYS.map((delay) => (
        <Dot key={delay} $delay={delay} />
      ))}
    </Dots>
  );
}
