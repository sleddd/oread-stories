// Chat: the conversation, live steering and a view of the exact request the model will receive.
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { ChatTemplate } from "../components/templates/index.js";
import {
  ChatSidebar,
  ChatHeader,
  MessageList,
  Composer,
  SteerPanel,
  ContextPanel,
  Inspector,
} from "../components/organisms/index.js";
import { avatarColorFor, formatTokenCount } from "../lib/format.js";

const INSPECTOR_TABS = [
  { id: "steer", label: "Steer" },
  { id: "context", label: "Context" },
];

function useChatPageState() {
  return useAppStore(
    useShallow((state) => ({
      controls: state.controls,
      personality: state.personality,
      derived: state.derived,
      settings: state.settings,
      chats: state.chats,
      activeChat: state.activeChat,
      streamingReply: state.streamingReply,
      editingMessageId: state.editingMessageId,
      draft: state.draft,
      context: state.context,
      lastExchange: state.lastExchange,
    })),
  );
}

function useChatPageActions() {
  return useAppStore(
    useShallow((state) => ({
      navigate: state.navigate,
      changePersonality: state.changePersonality,
      startNewChat: state.startNewChat,
      openChat: state.openChat,
      deleteChat: state.deleteChat,
      renameActiveChat: state.renameActiveChat,
      setDraft: state.setDraft,
      sendMessage: state.sendMessage,
      requestReply: state.requestReply,
      stopReply: state.stopReply,
      undoShift: state.undoShift,
      startEditingMessage: state.startEditingMessage,
      cancelEditingMessage: state.cancelEditingMessage,
      saveMessageEdit: state.saveMessageEdit,
      switchMessageVersion: state.switchMessageVersion,
      deleteMessage: state.deleteMessage,
      copyText: state.copyText,
    })),
  );
}

export function ChatPage() {
  const state = useChatPageState();
  const actions = useChatPageActions();
  const [inspectorTabId, setInspectorTabId] = useState("steer");
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const { personality, derived, activeChat } = state;
  const isBusy = state.streamingReply !== null;
  const avatarColor = avatarColorFor(personality);
  const openLorebook = () => actions.navigate("lore");

  const messageHandlers = {
    onSwitchVersion: actions.switchMessageVersion,
    onRequestReply: actions.requestReply,
    onEdit: (message) => actions.startEditingMessage(message.id),
    onCancelEdit: actions.cancelEditingMessage,
    onSaveEdit: actions.saveMessageEdit,
    onCopy: (message) => actions.copyText(message.content),
    onDelete: actions.deleteMessage,
  };

  const inspectorPanes = {
    steer: (
      <SteerPanel
        controls={state.controls}
        personality={personality}
        derived={derived}
        onChange={actions.changePersonality}
        onOpenLorebook={openLorebook}
      />
    ),
    context: <ContextPanel context={state.context} lastExchange={state.lastExchange} onCopy={actions.copyText} />,
  };

  function openChat(chatId) {
    setIsChatsOpen(false);
    actions.openChat(chatId);
  }

  return (
    <ChatTemplate
      isChatsOpen={isChatsOpen}
      isInspectorOpen={isInspectorOpen}
      onClosePanels={() => {
        setIsChatsOpen(false);
        setIsInspectorOpen(false);
      }}
      sidebar={
        <ChatSidebar
          characterName={personality.name}
          mood={derived.mood}
          avatarColor={avatarColor}
          chats={state.chats}
          activeChatId={activeChat?.id}
          onNewChat={actions.startNewChat}
          onOpenChat={openChat}
          onDeleteChat={actions.deleteChat}
          onOpenLorebook={openLorebook}
        />
      }
      header={
        <ChatHeader
          title={activeChat?.title ?? personality.name}
          isEditable={Boolean(activeChat)}
          characterName={personality.name}
          mood={derived.mood}
          onRename={actions.renameActiveChat}
          onToggleChats={(event) => {
            event?.stopPropagation?.();
            setIsChatsOpen(!isChatsOpen);
          }}
          onToggleInspector={(event) => {
            event?.stopPropagation?.();
            setIsInspectorOpen(!isInspectorOpen);
          }}
        />
      }
      messages={
        <MessageList
          chat={activeChat}
          characterName={personality.name}
          userName={state.settings.user?.name || "You"}
          avatarColor={avatarColor}
          streamingReply={state.streamingReply}
          editingMessageId={state.editingMessageId}
          isBusy={isBusy}
          handlers={messageHandlers}
        />
      }
      composer={
        <Composer
          draft={state.draft}
          isBusy={isBusy}
          tokenEstimate={state.context ? formatTokenCount(state.context.estimate.total) : ""}
          pendingShift={activeChat?.pendingShift}
          onDraftChange={actions.setDraft}
          onSend={actions.sendMessage}
          onStop={actions.stopReply}
          onUndoShift={actions.undoShift}
        />
      }
      inspector={
        <Inspector
          tabs={INSPECTOR_TABS}
          selectedTabId={inspectorTabId}
          onSelectTab={setInspectorTabId}
          panes={inspectorPanes}
        />
      }
    />
  );
}
