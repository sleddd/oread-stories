// Marks chats with a reply being written, in the database, so it holds across several server
// instances (or an old and a new one overlapping during a deploy). A claim only succeeds when
// the chat isn't marked, or its mark is so old the writer must have died.
//
// `claimsInProcess` is one Set shared by every request in this process, holding
// "userId:chatId" for claims made here; it answers isStreaming() at once, which the services
// need without waiting. The database claim is what actually stops two writers.
const STALE_CLAIM_MINUTES = 10;

export function createDatabaseStreamingGuard({ prisma, userId, claimsInProcess }) {
  function claimKey(chatId) {
    return `${userId}:${chatId}`;
  }

  function isStreaming(chatId) {
    return claimsInProcess.has(claimKey(chatId));
  }

  async function chatExists(chatId) {
    const count = await prisma.chat.count({ where: { userId, id: chatId } });
    return count > 0;
  }

  // A chat that doesn't exist is "free": the reply then fails with a clear 404 instead.
  async function claim(chatId) {
    const claimedRows = await prisma.$executeRaw`
      UPDATE chat SET "streamingSince" = now()
      WHERE "userId" = ${userId} AND id = ${chatId}
        AND ("streamingSince" IS NULL
          OR "streamingSince" < now() - make_interval(mins => ${STALE_CLAIM_MINUTES}))`;
    if (claimedRows === 1) {
      claimsInProcess.add(claimKey(chatId));
      return true;
    }
    return !(await chatExists(chatId));
  }

  async function release(chatId) {
    claimsInProcess.delete(claimKey(chatId));
    await prisma.chat.updateMany({
      where: { userId, id: chatId },
      data: { streamingSince: null },
    });
  }

  return { isStreaming, claim, release };
}
