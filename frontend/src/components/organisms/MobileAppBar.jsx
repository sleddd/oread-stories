// The top bar on a phone: the Oread mark and name, and a button that opens the menu (which holds
// the sections, the model and the colour scheme that the desktop bar shows inline).
import styled from "styled-components";
import { Row, Text, Pressable } from "../../ui/primitives/index.js";
import { IconButton, OreadMark } from "../atoms/index.js";

const MARK_SIZE = 36;

const Bar = styled(Row)`
  gap: 10px;
  padding: 10px 14px 10px 16px;
  padding-top: max(10px, env(safe-area-inset-top));
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  background: ${({ theme }) => theme.colors.header};
`;

// The mark and name together are a button home: pressing them opens the chat.
const Brand = styled(Pressable)`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
`;

const Wordmark = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 26px;
  letter-spacing: -0.01em;
`;

export function MobileAppBar({ onGoHome, onOpenMenu }) {
  return (
    <Bar as="header">
      <Brand accessibilityLabel="Oread, go to chat" onPress={onGoHome}>
        <OreadMark size={MARK_SIZE} />
        <Wordmark>Oread</Wordmark>
      </Brand>
      <IconButton icon="menu" label="Open menu" iconSize={24} onPress={onOpenMenu} />
    </Bar>
  );
}
