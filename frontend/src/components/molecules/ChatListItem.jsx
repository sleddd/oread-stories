// One chat in the sidebar list: title, message count, last update, and a delete button.
import styled from "styled-components";
import { Row, View, Text, Pressable } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";
import { describeTimeAgo } from "../../lib/format.js";

const Item = styled(Row)`
  gap: 6px;
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.accentSoft : "transparent")};
  &:hover {
    background: ${({ theme }) => theme.colors.accentSoft};
  }
`;

const OpenArea = styled(Pressable)`
  flex: 1;
  min-width: 0;
  text-align: left;
  font: inherit;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.ink};
  background: none;
  border: 0;
  padding: 9px 12px;
  cursor: pointer;
`;

const Title = styled(Text)`
  display: block;
  font-weight: ${({ $isActive }) => ($isActive ? 700 : 500)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Details = styled(Text)`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.muted};
  font-weight: 400;
`;

const DeleteSlot = styled(View)`
  opacity: 0;
  ${Item}:hover &,
  ${Item}:focus-within & {
    opacity: 1;
  }
`;

export function ChatListItem({ chat, isActive, onOpen, onDelete }) {
  const details = `${chat.messageCount} messages · ${describeTimeAgo(chat.updated)}`;
  return (
    <Item $isActive={isActive}>
      <OpenArea isSelected={isActive} onPress={() => onOpen(chat.id)}>
        <Title $isActive={isActive}>{chat.title}</Title>
        <Details>{details}</Details>
      </OpenArea>
      <DeleteSlot>
        <Button
          label="✕"
          variant="ghost"
          size="small"
          title="Delete chat"
          accessibilityLabel={`Delete ${chat.title}`}
          onPress={() => onDelete(chat)}
        />
      </DeleteSlot>
    </Item>
  );
}
