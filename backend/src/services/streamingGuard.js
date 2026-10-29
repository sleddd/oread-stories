// Remembers which chats have a reply being written, so a second reply, an edit or a delete
// can't run into it. This one lives in the process, which is all one local server needs; hosted
// mode uses the database version (storage/prisma/databaseStreamingGuard.js) with the same shape:
// isStreaming(chatId) answers at once, claim(chatId) → whether it was free, release(chatId).
export function createStreamingGuard() {
  const streamingChatIds = new Set();

  function isStreaming(chatId) {
    return streamingChatIds.has(chatId);
  }

  async function claim(chatId) {
    if (streamingChatIds.has(chatId)) {
      return false;
    }
    streamingChatIds.add(chatId);
    return true;
  }

  async function release(chatId) {
    streamingChatIds.delete(chatId);
  }

  return { isStreaming, claim, release };
}
