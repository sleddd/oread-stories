// Chat: the open story's conversation with its cast and scene, live steering of a chosen
// character, and a view of the exact request the model will receive.
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { useIsScreenAtMost } from "../lib/useIsScreenAtMost.js";
import { PHONE_LAYOUT_WIDTH } from "../theme/breakpoints.js";
import { ChatTemplate } from "../components/templates/index.js";
import {
  ChatSidebar,
  ChatHeader,
  MessageList,
  Composer,
  SteerPanel,
  ContextPanel,
  Inspector,
  StoryPanel,
  ScenePanel,
  lastSceneTurnOf,
} from "../components/organisms/index.js";
import { CharacterPicker } from "../components/molecules/index.js";
import { EmptyState } from "../components/atoms/index.js";
import { View } from "../ui/primitives/index.js";
import { formatTokenCount } from "../lib/format.js";
import { APPRAISING_STATUS } from "../content/copy.js";
import { RECALLING_STATUS } from "../content/story.js";

const BUSY_STATUS_BY_PHASE = { appraising: APPRAISING_STATUS, recalling: RECALLING_STATUS };

const INSPECTOR_TABS = [
  { id: "steer", label: "Steer" },
  { id: "story", label: "Story" },
  { id: "scene", label: "Scene" },
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
      isChatsPanelCollapsed: state.isChatsPanelCollapsed,
      isSteeringPanelCollapsed: state.isSteeringPanelCollapsed,
      isChatsPanelSlidIn: state.isChatsPanelSlidIn,
      isSteeringPanelSlidIn: state.isSteeringPanelSlidIn,
      editingMessageId: state.editingMessageId,
      draft: state.draft,
      context: state.context,
      lastExchange: state.lastExchange,
      stories: state.stories,
      activeStoryId: state.activeStoryId,
      activeStory: state.activeStory,
      selectedCharacterId: state.selectedCharacterId,
      turnChangesByMessageId: state.turnChangesByMessageId,
      pendingScene: state.pendingScene,
      pendingPresentCharacterIds: state.pendingPresentCharacterIds,
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
      toggleChatsPanel: state.toggleChatsPanel,
      toggleSteeringPanel: state.toggleSteeringPanel,
      closeSlidInPanels: state.closeSlidInPanels,
      deleteChat: state.deleteChat,
      renameActiveChat: state.renameActiveChat,
      clearActiveChat: state.clearActiveChat,
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
      resetStoryEngine: state.resetStoryEngine,
      patchSettings: state.patchSettings,
      openStory: state.openStory,
      selectCharacter: state.selectCharacter,
      openCharacterEditor: state.openCharacterEditor,
      setPresentCharacters: state.setPresentCharacters,
      saveScene: state.saveScene,
      discardPendingSceneChanges: state.discardPendingSceneChanges,
    })),
  );
}

function aiCharactersOf(story) {
  return (story?.characters ?? []).filter((character) => character.role === "ai");
}

// Who a reply belongs to, by the character id it carries.
function createSpeakerLookup(story) {
  return (characterId) => {
    const character = story?.characters.find((candidate) => candidate.id === characterId);
    if (!character) {
      return null;
    }
    return { name: character.name };
  };
}

// Who a chat's replies belong to when a reply doesn't name its speaker (older replies, shift
// markers): the chat's last speaker, or the first character in the scene.
function chooseChatSpeaker(chat, speakerFor) {
  if (!chat) {
    return null;
  }
  return speakerFor(chat.lastSpeakerId) ?? speakerFor(chat.presentCharacterIds?.[0]);
}

// A reply's changes come from the chat's turn log, or from the stream if the log isn't loaded.
function createTurnChangesLookup(chat, turnChangesByMessageId) {
  return (message) => {
    const logEntry = chat?.turnLog?.find((entry) => entry.messageId === message.id);
    return logEntry ?? turnChangesByMessageId[message.id];
  };
}

// The Scene tab: the chat's scene and cast, with your waiting edits shown in their place.
function SceneTab({ state, actions, isBusy }) {
  const chat = state.activeChat;
  if (!chat || !state.activeStory) {
    return null;
  }
  const presentCharacterIds = state.pendingPresentCharacterIds ?? chat.presentCharacterIds ?? [];
  const hasPendingChanges =
    state.pendingScene !== null || state.pendingPresentCharacterIds !== null;
  return (
    <ScenePanel
      scene={state.pendingScene ?? chat.scene}
      characters={aiCharactersOf(state.activeStory)}
      presentCharacterIds={presentCharacterIds}
      speakingCharacterId={state.streamingReply?.speakerId ?? chat.lastSpeakerId}
      updatedOnTurn={lastSceneTurnOf(chat.turnLog)}
      hasPendingChanges={hasPendingChanges}
      isDisabled={isBusy}
      onChangePresent={actions.setPresentCharacters}
      onChangeScene={actions.saveScene}
      onDiscard={actions.discardPendingSceneChanges}
    />
  );
}

export function ChatPage() {
  const state = useChatPageState();
  const actions = useChatPageActions();
  // The selected character's personality loads with its story; it can be missing for a moment
  // after switching, or if the backend couldn't load it.
  if (!state.personality || !state.derived) {
    return <EmptyState>Loading the character…</EmptyState>;
  }
  return <LoadedChatPage state={state} actions={actions} />;
}

function LoadedChatPage({ state, actions }) {
  const [inspectorTabId, setInspectorTabId] = useState("steer");
  const isPhone = useIsScreenAtMost(PHONE_LAYOUT_WIDTH);

  const { personality, derived, activeChat } = state;
  const isBusy = state.streamingReply !== null;
  const speakerFor = createSpeakerLookup(state.activeStory);
  const chatSpeaker = chooseChatSpeaker(activeChat, speakerFor) ?? { name: personality.name };
  const editCharacter = () => actions.openCharacterEditor(state.selectedCharacterId);
  const characterPicker = (
    <CharacterPicker
      characters={aiCharactersOf(state.activeStory)}
      selectedCharacterId={state.selectedCharacterId}
      onSelect={actions.selectCharacter}
    />
  );
  const engine = activeChat?.engines?.[state.selectedCharacterId] ?? activeChat?.engine;

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
      <View>
        {characterPicker}
        <SteerPanel
          controls={state.controls}
          personality={personality}
          derived={derived}
          onChange={actions.changePersonality}
          onEditCharacter={editCharacter}
        />
      </View>
    ),
    story: (
      <View>
        {characterPicker}
        <StoryPanel
          engine={engine}
          isEnabled={Boolean(state.settings.engine?.enabled)}
          onToggleEnabled={(enabled) =>
            actions.patchSettings({ engine: { enabled } }, { announce: false })
          }
          onReset={actions.resetStoryEngine}
        />
      </View>
    ),
    scene: <SceneTab state={state} actions={actions} isBusy={isBusy} />,
    context: (
      <ContextPanel
        context={state.context}
        lastExchange={state.lastExchange}
        onCopy={actions.copyText}
      />
    ),
  };

  function openChat(chatId) {
    actions.closeSlidInPanels();
    actions.openChat(chatId);
  }

  return (
    <ChatTemplate
      isChatsPanelCollapsed={state.isChatsPanelCollapsed}
      isSteeringPanelCollapsed={state.isSteeringPanelCollapsed}
      isChatsPanelSlidIn={state.isChatsPanelSlidIn}
      isSteeringPanelSlidIn={state.isSteeringPanelSlidIn}
      onClosePanels={actions.closeSlidInPanels}
      sidebar={
        <ChatSidebar
          stories={state.stories}
          activeStoryId={state.activeStoryId}
          onSwitchStory={actions.openStory}
          characterName={personality.name}
          mood={derived.mood}
          chats={state.chats}
          activeChatId={activeChat?.id}
          onNewChat={actions.startNewChat}
          onOpenChat={openChat}
          onDeleteChat={actions.deleteChat}
          onEditCharacter={editCharacter}
        />
      }
      header={
        <ChatHeader
          title={activeChat?.title ?? personality.name}
          isEditable={Boolean(activeChat)}
          onRename={actions.renameActiveChat}
          onClear={actions.clearActiveChat}
          isCompact={isPhone}
          onToggleChats={(event) => {
            event?.stopPropagation?.();
            actions.toggleChatsPanel();
          }}
          onToggleInspector={(event) => {
            event?.stopPropagation?.();
            actions.toggleSteeringPanel();
          }}
        />
      }
      messages={
        <MessageList
          chat={activeChat}
          characterName={chatSpeaker.name}
          userName={state.settings.user?.name || "You"}
          speakerFor={speakerFor}
          turnChangesFor={createTurnChangesLookup(activeChat, state.turnChangesByMessageId)}
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
          busyStatus={BUSY_STATUS_BY_PHASE[state.streamingReply?.phase]}
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
