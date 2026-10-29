// One user's chats in the database: a row per chat holding the whole chat as JSON, newest
// first. A change locks only that chat's row; a change to every chat (a story or character
// going away) locks all of the user's chats.
import { notFound } from "../../http/errors.js";

function chatNotFound(chatId) {
  return notFound(`There is no chat "${chatId}".`);
}

function rowFor(userId, chat) {
  return {
    userId,
    id: chat.id,
    storyId: chat.storyId ?? "",
    title: chat.title ?? "",
    data: chat,
  };
}

function columnsOf(chat) {
  return { storyId: chat.storyId ?? "", title: chat.title ?? "", data: chat };
}

function isSameJson(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function createPrismaChatRepository({ prisma, userId, migration, now }) {
  function chatKey(chatId) {
    return { userId_id: { userId, id: chatId } };
  }

  async function listChats() {
    await migration.ensureMigrated();
    const rows = await prisma.chat.findMany({
      where: { userId },
      orderBy: { sequence: "desc" },
      select: { data: true },
    });
    return rows.map((row) => row.data);
  }

  async function findChat(chatId) {
    await migration.ensureMigrated();
    const row = await prisma.chat.findUnique({ where: chatKey(chatId), select: { data: true } });
    if (!row) {
      throw chatNotFound(chatId);
    }
    return row.data;
  }

  // Applies `applyChange` to one chat, stamps its update time and returns the saved chat.
  async function updateChat(chatId, applyChange) {
    await migration.ensureMigrated();
    return prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw`
        SELECT data FROM chat WHERE "userId" = ${userId} AND id = ${chatId} FOR UPDATE`;
      if (rows.length === 0) {
        throw chatNotFound(chatId);
      }
      const chat = rows[0].data;
      applyChange(chat);
      chat.updated = now();
      await transaction.chat.update({ where: chatKey(chatId), data: columnsOf(chat) });
      return chat;
    });
  }

  async function addChat(chat) {
    await migration.ensureMigrated();
    await prisma.chat.create({ data: rowFor(userId, chat) });
  }

  async function removeChat(chatId) {
    await migration.ensureMigrated();
    const deleted = await prisma.chat.deleteMany({ where: { userId, id: chatId } });
    if (deleted.count === 0) {
      throw chatNotFound(chatId);
    }
  }

  async function writeChangedChats(transaction, before, after) {
    const beforeById = new Map(before.map((chat) => [chat.id, chat]));
    const keptIds = new Set(after.map((chat) => chat.id));
    const removedIds = before.map((chat) => chat.id).filter((chatId) => !keptIds.has(chatId));
    if (removedIds.length) {
      await transaction.chat.deleteMany({ where: { userId, id: { in: removedIds } } });
    }
    for (const chat of after) {
      const original = beforeById.get(chat.id);
      if (!original) {
        await transaction.chat.create({ data: rowFor(userId, chat) });
      } else if (!isSameJson(original, chat)) {
        await transaction.chat.update({ where: chatKey(chat.id), data: columnsOf(chat) });
      }
    }
  }

  // Changes every chat at once (used when a story or character goes away). `applyChange` gets
  // the chats and returns the ones to keep; chats it leaves out are deleted.
  async function updateAllChats(applyChange) {
    await migration.ensureMigrated();
    await prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw`
        SELECT data FROM chat WHERE "userId" = ${userId} ORDER BY sequence DESC FOR UPDATE`;
      const before = rows.map((row) => row.data);
      const after = applyChange(structuredClone(before));
      await writeChangedChats(transaction, before, after);
    });
  }

  // Adds or replaces chats by id (used by import).
  async function saveChats(importedChats) {
    await migration.ensureMigrated();
    await prisma.$transaction(
      importedChats.map((chat) => {
        return prisma.chat.upsert({
          where: chatKey(chat.id),
          create: rowFor(userId, chat),
          update: columnsOf(chat),
        });
      }),
    );
  }

  return { listChats, findChat, updateChat, addChat, removeChat, updateAllChats, saveChats };
}
