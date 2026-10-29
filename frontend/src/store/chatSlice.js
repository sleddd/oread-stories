// Chats and their messages: opening, creating, renaming and deleting chats; editing messages;
// and keeping the request preview (context) and pending personality shift up to date.
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

    return {
      chats: [],
      activeChat: null,
      editingMessageId: null,
      draft: "",
      context: null,

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
        try {
          set({ chats: await api.listChats() });
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
        rememberActiveChat(chatId);
        await updateActiveChat(() => api.getChat(chatId));
      },

      async startNewChat() {
        if (get().isReplyStreaming()) {
          return;
        }
        try {
          const chat = await api.createChat();
          rememberActiveChat(chat.id);
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
