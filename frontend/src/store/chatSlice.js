// The open story's chats and their messages: opening, creating, renaming and deleting chats;
// who is in the scene and what the scene is; editing messages; and keeping the request preview
// (context) and pending personality shift up to date.
//
// The AI keeps the scene each turn. Your own changes to it (or to who is present) are held as a
// pending change and saved just before your next message or reply request, so they take effect
// on the turn they were meant for and never fight with a turn already in progress.
import { debounce } from "../lib/format.js";

const ACTIVE_CHAT_STORAGE_KEY = "oread.chat";
const CONTEXT_REFRESH_DELAY_MILLISECONDS = 250;
const SHIFT_REFRESH_DELAY_MILLISECONDS = 300;

export function createChatSlice({ api, platform }) {
  return (set, get) => {
    function rememberActiveChat(chatId) {
      platform.storage.write(ACTIVE_CHAT_STORAGE_KEY, chatId);
    }

    async function updateActiveChat(requestChat) {
      try {
        set({ activeChat: await requestChat() });
        get().refreshContext();
      } catch (error) {
        get().showError(error);
      }
    }

    let contextRequestNumber = 0;
    const refreshContext = debounce(async () => {
      const chat = get().activeChat;
      if (!chat) {
        set({ context: null });
        return;
      }
      contextRequestNumber += 1;
      const thisRequestNumber = contextRequestNumber;
      try {
        const context = await api.getContext(chat.id, get().draft.trim());
        if (thisRequestNumber === contextRequestNumber) {
          set({ context });
        }
      } catch {
        // The preview is a convenience; a failed refresh leaves the last one showing.
      }
    }, CONTEXT_REFRESH_DELAY_MILLISECONDS);

    // When the dials move, the chat's pending shift changes; ask the server for the new one.
    const refreshPendingShift = debounce(async () => {
      const chat = get().activeChat;
      if (!chat || get().isReplyStreaming()) {
        return;
      }
      try {
        const freshChat = await api.getChat(chat.id);
        const isStillActive = get().activeChat?.id === freshChat.id;
        if (isStillActive && !get().isReplyStreaming()) {
          set({ activeChat: freshChat });
        }
      } catch {
        // Leave the current marker; the next reply recalculates it anyway.
      }
    }, SHIFT_REFRESH_DELAY_MILLISECONDS);

    function forgetPendingSceneChanges() {
      set({ pendingScene: null, pendingPresentCharacterIds: null });
    }

    function pendingSceneChanges() {
      const changes = {};
      if (get().pendingScene) {
        changes.scene = get().pendingScene;
      }
      if (get().pendingPresentCharacterIds) {
        changes.presentCharacterIds = get().pendingPresentCharacterIds;
      }
      return changes;
    }

    return {
      chats: [],
      activeChat: null,
      editingMessageId: null,
      draft: "",
      context: null,
      // Your scene edits waiting for the next turn; null when there are none.
      pendingScene: null,
      pendingPresentCharacterIds: null,

      refreshContext,

      afterPersonalityChanged() {
        refreshPendingShift();
        refreshContext();
      },

      setDraft(draft) {
        set({ draft });
        refreshContext();
      },

      async loadChats() {
        const storyId = get().activeStoryId;
        if (!storyId) {
          set({ chats: [] });
          return;
        }
        try {
          set({ chats: await api.listChats(storyId) });
        } catch (error) {
          get().showError(error);
        }
      },

      // Opens the remembered chat, or the most recent one, or starts a new one.
      async showFirstChat() {
        if (get().activeChat) {
          refreshContext();
          return;
        }
        await get().loadChats();
        const chats = get().chats;
        const rememberedId = platform.storage.read(ACTIVE_CHAT_STORAGE_KEY);
        const remembered = chats.find((chat) => chat.id === rememberedId);
        const chatToOpen = remembered ?? chats[0];
        if (chatToOpen) {
          await get().openChat(chatToOpen.id);
        } else {
          await get().startNewChat();
        }
      },

      async openChat(chatId) {
        if (get().isReplyStreaming()) {
          get().showToast("Wait for the reply to finish, or stop it first.");
          return;
        }
        set({ editingMessageId: null });
        forgetPendingSceneChanges();
        rememberActiveChat(chatId);
        await updateActiveChat(() => api.getChat(chatId));
      },

      async startNewChat() {
        if (get().isReplyStreaming()) {
          return;
        }
        try {
          const chat = await api.createChat(get().activeStoryId);
          rememberActiveChat(chat.id);
          forgetPendingSceneChanges();
          set({ activeChat: chat, editingMessageId: null });
          await get().loadChats();
          refreshContext();
        } catch (error) {
          get().showError(error);
        }
      },

      async deleteChat(chat) {
        if (!platform.confirmAction(`Delete “${chat.title}”? This can't be undone.`)) {
          return;
        }
        try {
          await api.deleteChat(chat.id);
          await get().loadChats();
          if (get().activeChat?.id !== chat.id) {
            return;
          }
          set({ activeChat: null });
          rememberActiveChat(null);
          const nextChat = get().chats[0];
          if (nextChat) {
            await get().openChat(nextChat.id);
          }
        } catch (error) {
          get().showError(error);
        }
      },

      // Empties the open chat so the story starts over. The character's dials stay as they are.
      async clearActiveChat() {
        const chat = get().activeChat;
        if (!chat || get().isReplyStreaming()) {
          return;
        }
        const question =
          `Clear “${chat.title}”? All its messages and story state will be removed. ` +
          "The character's dials stay as they are.";
        if (!platform.confirmAction(question)) {
          return;
        }
        set({ editingMessageId: null, draft: "" });
        forgetPendingSceneChanges();
        await updateActiveChat(() => api.clearChat(chat.id));
        await get().loadChats();
      },

      // Chats belong to a story: after switching stories, show the new story's chats.
      async leaveChatsOfPreviousStory() {
        set({ activeChat: null, chats: [], context: null, editingMessageId: null });
        forgetPendingSceneChanges();
        const isShowingChat = get().bootStatus === "ready" && get().view === "chat";
        if (isShowingChat) {
          await get().showFirstChat();
          return;
        }
        await get().loadChats();
      },

      // Held until the next turn; see applyPendingSceneChanges.
      setPresentCharacters(presentCharacterIds) {
        if (!get().activeChat || get().isReplyStreaming()) {
          return;
        }
        set({ pendingPresentCharacterIds: presentCharacterIds });
      },

      // scene: { location, present[], withinReach[], timeOfDay, lastSaid, inMotion }.
      // Held until the next turn; see applyPendingSceneChanges.
      saveScene(scene) {
        if (!get().activeChat) {
          return;
        }
        set({ pendingScene: scene });
      },

      discardPendingSceneChanges: forgetPendingSceneChanges,

      hasPendingSceneChanges: () => Object.keys(pendingSceneChanges()).length > 0,

      // Saves your waiting scene edits. Returns false when they couldn't be saved, so the turn
      // that needed them doesn't go ahead without them; the edits stay for another try.
      async applyPendingSceneChanges() {
        const chat = get().activeChat;
        const changes = pendingSceneChanges();
        if (!chat || Object.keys(changes).length === 0) {
          return true;
        }
        try {
          const savedChat = await api.updateChatScene(chat.id, changes);
          set({ activeChat: savedChat });
          forgetPendingSceneChanges();
          return true;
        } catch (error) {
          get().showError(error);
          return false;
        }
      },

      async renameActiveChat(title) {
        const chat = get().activeChat;
        const trimmedTitle = title.trim();
        if (!chat || !trimmedTitle || trimmedTitle === chat.title) {
          return;
        }
        await updateActiveChat(() => api.renameChat(chat.id, trimmedTitle));
        await get().loadChats();
      },

      startEditingMessage: (messageId) => set({ editingMessageId: messageId }),
      cancelEditingMessage: () => set({ editingMessageId: null }),

      async saveMessageEdit(message, content) {
        set({ editingMessageId: null });
        await updateActiveChat(() => api.editMessage(get().activeChat.id, message.id, { content }));
      },

      async switchMessageVersion(message, versionIndex) {
        await updateActiveChat(() => {
          return api.editMessage(get().activeChat.id, message.id, { alt: versionIndex });
        });
      },

      async deleteMessage(message) {
        await updateActiveChat(() => api.deleteMessage(get().activeChat.id, message.id));
      },

      async undoShift() {
        const chat = get().activeChat;
        if (!chat) {
          return;
        }
        await get().runPersonalityAction(() => api.undoShift(chat.id));
        await get().refreshActiveStory();
      },

      // Clears the chat's stress and scene history. Trait drift already applied stays.
      async resetStoryEngine() {
        const chat = get().activeChat;
        if (!chat) {
          return;
        }
        if (!platform.confirmAction("Reset this story's stress and scene history?")) {
          return;
        }
        await updateActiveChat(() => api.resetStoryEngine(chat.id));
      },

      async copyText(text) {
        const copied = await platform.copyText(text);
        if (copied) {
          get().showToast("Copied");
        } else {
          get().showToast("Couldn't copy. Select the text and copy it manually.", "error");
        }
      },
    };
  };
}
