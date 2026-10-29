// Storage access for chats. All chats live in one "chats" document; changes to a single chat
// run read-modify-write under the store's lock. Every call waits for the move into stories to
// finish first, so chats always belong to a story.
import { notFound } from "../http/errors.js";
import { mergeById } from "./storyRepository.js";

const CHATS_DOCUMENT = "chats";

function chatNotFound(chatId) {
  return notFound(`There is no chat "${chatId}".`);
}

export function createChatRepository({ store, migration, now }) {
  async function listChats() {
    await migration.ensureMigrated();
    return (await store.read(CHATS_DOCUMENT, [])) || [];
  }

  async function findChat(chatId) {
    const chats = await listChats();
    const chat = chats.find((candidate) => candidate.id === chatId);
    if (!chat) {
      throw chatNotFound(chatId);
    }
    return chat;
  }

  // Applies `applyChange` to one chat, stamps its update time and returns the saved chat.
  async function updateChat(chatId, applyChange) {
    await migration.ensureMigrated();
    let updatedChat;
    await store.update(CHATS_DOCUMENT, [], (chats) => {
      const chat = chats.find((candidate) => candidate.id === chatId);
      if (!chat) {
        throw chatNotFound(chatId);
      }
      applyChange(chat);
      chat.updated = now();
      updatedChat = chat;
      return chats;
    });
    return updatedChat;
  }

  // New chats go first in the list.
  async function addChat(chat) {
    await migration.ensureMigrated();
    await store.update(CHATS_DOCUMENT, [], (chats) => [chat, ...chats]);
  }

  async function removeChat(chatId) {
    await migration.ensureMigrated();
    await store.update(CHATS_DOCUMENT, [], (chats) => {
      if (!chats.some((chat) => chat.id === chatId)) {
        throw chatNotFound(chatId);
      }
      return chats.filter((chat) => chat.id !== chatId);
    });
  }

  // Changes every chat at once (used when a story or character goes away).
  async function updateAllChats(applyChange) {
    await migration.ensureMigrated();
    await store.update(CHATS_DOCUMENT, [], (chats) => applyChange(chats));
  }

  // Adds or replaces chats by id (used by import).
  async function saveChats(importedChats) {
    await migration.ensureMigrated();
    await store.update(CHATS_DOCUMENT, [], (chats) => mergeById(chats, importedChats));
  }

  return { listChats, findChat, updateChat, addChat, removeChat, updateAllChats, saveChats };
}
