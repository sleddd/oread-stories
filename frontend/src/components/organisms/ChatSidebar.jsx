// The left column of the chat page: the character card, a New chat button and the list of chats.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { Button, EmptyState } from "../atoms/index.js";
import { PersonaCard, ChatListItem } from "../molecules/index.js";

const Column = styled(View)`
  gap: 10px;
`;

const ListTitle = styled(Text)`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.muted};
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: 0.06em;
  margin-top: 6px;
`;

const ChatList = styled(View)`
  gap: 4px;
`;

export function ChatSidebar({
  characterName,
  mood,
  avatarColor,
  chats,
  activeChatId,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onOpenLorebook,
}) {
  return (
    <Column>
      <PersonaCard name={characterName} mood={mood} avatarColor={avatarColor} onOpenLorebook={onOpenLorebook} />
      <Button label="New chat" variant="primary" isWide onPress={onNewChat} />
      <ListTitle>Chats</ListTitle>
      <ChatList>
        {chats.length === 0 && <EmptyState>No chats yet.</EmptyState>}
        {chats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            onOpen={onOpenChat}
            onDelete={onDeleteChat}
          />
        ))}
      </ChatList>
    </Column>
  );
}
