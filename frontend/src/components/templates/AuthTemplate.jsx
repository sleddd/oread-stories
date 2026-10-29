// The signed-out screen: the Oread mark and name above one centred card holding the form.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { OreadMark } from "../atoms/index.js";

const MARK_SIZE = 64;
const CARD_WIDTH = 400;

const Screen = styled(View)`
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 32px 16px;
  background: ${({ theme }) => theme.colors.background};
`;

const Brand = styled(Row)`
  gap: 12px;
`;

const Wordmark = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 40px;
  letter-spacing: -0.01em;
`;

const Card = styled(View)`
  width: 100%;
  max-width: ${CARD_WIDTH}px;
  gap: 14px;
  padding: 26px 24px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.panel};
`;

export function AuthTemplate({ children }) {
  return (
    <Screen as="main">
      <Brand>
        <OreadMark size={MARK_SIZE} />
        <Wordmark>Oread</Wordmark>
      </Brand>
      <Card>{children}</Card>
    </Screen>
  );
}
