// The top bar on a phone: the Oread mark and name, and a button that opens the menu (which holds
// the sections, the model and the colour scheme that the desktop bar shows inline).
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { IconButton, OreadMark } from "../atoms/index.js";

const MARK_SIZE = 36;

const Bar = styled(Row)`
  gap: 10px;
  padding: 10px 14px 10px 16px;
  padding-top: max(10px, env(safe-area-inset-top));
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  background: ${({ theme }) => theme.colors.header};
`;

const Wordmark = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 26px;
  letter-spacing: -0.01em;
  margin-right: auto;
`;

export function MobileAppBar({ onOpenMenu }) {
  return (
    <Bar as="header">
      <OreadMark size={MARK_SIZE} />
      <Wordmark>Oread</Wordmark>
      <IconButton icon="menu" label="Open menu" iconSize={24} onPress={onOpenMenu} />
    </Bar>
  );
}
