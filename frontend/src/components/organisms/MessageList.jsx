// The transcript: the opening narration, messages (each reply beside its speaker's avatar), what
// each reply changed, and the context-window boundary. Follows a streaming reply to the bottom
// unless the reader has scrolled up.
import { useLayoutEffect, useRef } from "react";
import styled from "styled-components";
import { ScrollView, Text, View } from "../../ui/primitives/index.js";
import { EmptyState } from "../atoms/index.js";
import { MessageBubble, NarrationBlock } from "../molecules/index.js";
import { NARRATION_LABEL } from "../../content/story.js";
import { TurnChanges } from "./TurnChanges.jsx";

const Scroller = styled(ScrollView)`
  height: 100%;
  padding: 20px 16px 8px;
  @media (max-width: 760px) {
    padding: 14px 10px 6px;
  }
`;

const Stack = styled(View)`
  gap: 14px;
  min-height: 100%;
`;

const CenteredEmpty = styled(EmptyState)`
  margin: auto;
  text-align: center;
`;

const WindowBoundary = styled(Text)`
  display: block;
  max-width: ${({ theme }) => theme.layout.conversationWidth};
  width: 100%;
  margin: 0 auto;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14px;
  border-top: 1px dashed ${({ theme }) => theme.colors.line};
  padding-top: 6px;
`;

function useFollowLatest(scrollerRef, chat, streamingText) {
  const wasNearEndRef = useRef(true);
  useLayoutEffect(() => {
    if (wasNearEndRef.current) {
      scrollerRef.current?.scrollToEnd();
    }
  }, [chat, streamingText, scrollerRef]);
  return () => {
    wasNearEndRef.current = scrollerRef.current?.isNearEnd() ?? true;
  };
}

// Who wrote a reply: its speaker when the story says so, otherwise the chat's character.
function chooseSpeaker({ message, isStreaming, streamingReply, speakerFor, fallbackSpeaker }) {
  let speakerId = message.speakerId;
  if (isStreaming && streamingReply.speakerId) {
    speakerId = streamingReply.speakerId;
  }
  if (!speakerId || !speakerFor) {
    return fallbackSpeaker;
  }
  return speakerFor(speakerId) ?? fallbackSpeaker;
}

function TranscriptEntries({
  chat,
  characterName,
  userName,
  speakerFor,
  turnChangesFor,
  streamingReply,
  editingMessageId,
  isBusy,
  handlers,
}) {
  const lastIndex = chat.messages.length - 1;
  return chat.messages.map((message, index) => {
    const showsWindowBoundary = index === chat.windowStart && index > 0;
    const windowBoundary = showsWindowBoundary && (
      <WindowBoundary>
        ↑ Older messages are outside the context window and are not sent
      </WindowBoundary>
    );
    if (message.role === "narration") {
      return (
        <View key={message.id}>
          {windowBoundary}
          <NarrationBlock label={NARRATION_LABEL} text={message.content} />
        </View>
      );
    }
    // Personality shifts are recorded in the chat but not shown; only a context-window boundary
    // that falls on one is drawn.
    if (message.role === "shift") {
      return windowBoundary && <View key={message.id}>{windowBoundary}</View>;
    }
    const isStreaming = streamingReply?.messageId === message.id;
    const isMine = message.role === "user";
    const speaker = chooseSpeaker({
      message,
      isStreaming,
      streamingReply,
      speakerFor,
      fallbackSpeaker: { name: characterName },
    });
    const turnChanges = !isMine && !isStreaming && turnChangesFor && (
      <TurnChanges turnChanges={turnChangesFor(message)} />
    );
    return (
      <View key={message.id}>
        {windowBoundary}
        <MessageBubble
          message={message}
          authorName={isMine ? userName : speaker.name}
          footerAccessory={turnChanges}
          displayedText={isStreaming ? streamingReply.text : message.content}
          isLast={index === lastIndex}
          isBusy={isBusy}
          isStreaming={isStreaming}
          isEditing={message.id === editingMessageId}
          onSwitchVersion={(versionIndex) => handlers.onSwitchVersion(message, versionIndex)}
          onRequestReply={handlers.onRequestReply}
          onEdit={() => handlers.onEdit(message)}
          onCopy={() => handlers.onCopy(message)}
          onDelete={() => handlers.onDelete(message)}
          onSaveEdit={(content) => handlers.onSaveEdit(message, content)}
          onCancelEdit={handlers.onCancelEdit}
        />
      </View>
    );
  });
}

export function MessageList(props) {
  const { chat, characterName, streamingReply } = props;
  const scrollerRef = useRef(null);
  const rememberScrollPosition = useFollowLatest(scrollerRef, chat, streamingReply?.text);

  return (
    <Scroller ref={scrollerRef} onScroll={rememberScrollPosition}>
      <Stack aria-live="polite">
        {!chat && <CenteredEmpty>Start a new chat to begin.</CenteredEmpty>}
        {chat && chat.messages.length === 0 && (
          <CenteredEmpty>{`${characterName} is waiting.`}</CenteredEmpty>
        )}
        {chat && <TranscriptEntries {...props} />}
      </Stack>
    </Scroller>
  );
}
