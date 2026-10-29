// A bordered row that opens to show more: "Temperament 4 ›". Closed by default, so long lists of
// dials stay out of the way until they're wanted.
import { useState } from "react";
import styled from "styled-components";
import { View, Row, Text, Pressable } from "../../ui/primitives/index.js";

const Box = styled(View)`
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.panel};
  margin-bottom: 10px;
`;

const Toggle = styled(Pressable)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  font: inherit;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.ink};
  background: transparent;
  border: 0;
  padding: 12px 16px;
  cursor: pointer;
  text-align: left;
`;

const Count = styled(Row)`
  gap: 6px;
  color: ${({ theme }) => theme.colors.muted};
  font-weight: 600;
`;

const Chevron = styled(Text)`
  display: inline-block;
  transition: transform 0.15s;
  transform: rotate(${({ $isOpen }) => ($isOpen ? "90deg" : "0deg")});
`;

const Body = styled(View)`
  padding: 0 16px 8px;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const Note = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14px;
  margin-top: 10px;
`;

export function Disclosure({ title, count, note, isInitiallyOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);
  return (
    <Box>
      <Toggle isExpanded={isOpen} onPress={() => setIsOpen(!isOpen)}>
        <Text>{title}</Text>
        <Count>
          {count !== undefined && <Text>{count}</Text>}
          <Chevron $isOpen={isOpen} aria-hidden="true">
            ›
          </Chevron>
        </Count>
      </Toggle>
      {isOpen && (
        <Body>
          {note && <Note>{note}</Note>}
          {children}
        </Body>
      )}
    </Box>
  );
}
