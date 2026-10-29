// The left column of the chat page: the story dropdown, the selected character's card, a New
// chat button and the story's chats.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, EmptyState, Eyebrow } from "../atoms/index.js";
import { PersonaCard, ChatListItem, StoryPicker } from "../molecules/index.js";

const Column = styled(View)`
  gap: 14px;
`;

const ListTitle = styled(Eyebrow)`
  margin-top: 8px;
`;

const ChatList = styled(View)`
  gap: 4px;
`;

export function ChatSidebar({
  stories = [],
  activeStoryId,
  onSwitchStory,
  characterName,
  mood,
  chats,
  activeChatId,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onEditCharacter,
}) {
  return (
    <Column>
      {stories.length > 0 && (
        <StoryPicker stories={stories} activeStoryId={activeStoryId} onSelect={onSwitchStory} />
      )}
      <PersonaCard name={characterName} mood={mood} onEditCharacter={onEditCharacter} />
      <Button label="+ New chat" variant="primary" isWide onPress={onNewChat} />
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
