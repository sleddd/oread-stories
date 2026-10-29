// The phone menu's frame: the page dims and a sheet slides in from the right. Pressing the dimmed
// page closes it.
import styled, { keyframes } from "styled-components";
import { View, Pressable } from "../../ui/primitives/index.js";

const SHEET_WIDTH = "min(360px, 86vw)";

const slideIn = keyframes`
  from { transform: translateX(100%); }
  to { transform: none; }
`;

const Overlay = styled(View)`
  position: fixed;
  inset: 0;
  z-index: 40;
`;

const Backdrop = styled(Pressable)`
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: ${({ theme }) => theme.colors.scrim};
  cursor: default;
`;

const Sheet = styled(View)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${SHEET_WIDTH};
  overflow: auto;
  padding-top: env(safe-area-inset-top);
  background: ${({ theme }) => theme.colors.panel};
  box-shadow: -8px 0 30px ${({ theme }) => theme.colors.shadow};
  animation: ${slideIn} 0.2s ease;
`;

export function MenuSheet({ isOpen, onClose, children }) {
  if (!isOpen) {
    return null;
  }
  return (
    <Overlay>
      <Backdrop accessibilityLabel="Close menu" onPress={onClose} />
      <Sheet role="dialog" aria-modal="true" aria-label="Menu">
        {children}
      </Sheet>
    </Overlay>
  );
}
