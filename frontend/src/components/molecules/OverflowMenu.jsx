// A "…" button that opens a short list of less-used actions under it. Choosing an action, or
// pressing anywhere else, closes the list. items: [{ label, onPress, isDisabled }].
import { useState } from "react";
import styled from "styled-components";
import { View, Pressable } from "../../ui/primitives/index.js";
import { IconButton } from "../atoms/index.js";

const Anchor = styled(View)`
  position: relative;
`;

// Invisible, full-screen: a press outside the list lands here and closes it.
const OutsideArea = styled(Pressable)`
  position: fixed;
  inset: 0;
  z-index: 30;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: default;
`;

const List = styled(View)`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 31;
  min-width: 180px;
  padding: 6px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.raised};
  box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
`;

const Item = styled(Pressable)`
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.small};
  background: transparent;
  color: ${({ theme }) => theme.colors.ink};
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.segment};
  }
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

export function OverflowMenu({ label = "More", items }) {
  const [isOpen, setIsOpen] = useState(false);

  function choose(item) {
    setIsOpen(false);
    item.onPress();
  }

  return (
    <Anchor>
      <IconButton
        icon="more"
        label={label}
        isExpanded={isOpen}
        onPress={(event) => {
          event?.stopPropagation?.();
          setIsOpen(!isOpen);
        }}
      />
      {isOpen && (
        <>
          <OutsideArea accessibilityLabel="Close" onPress={() => setIsOpen(false)} />
          <List role="menu" aria-label={label}>
            {items.map((item) => (
              <Item
                key={item.label}
                accessibilityRole="menuitem"
                disabled={item.isDisabled}
                onPress={() => choose(item)}
              >
                {item.label}
              </Item>
            ))}
          </List>
        </>
      )}
    </Anchor>
  );
}
