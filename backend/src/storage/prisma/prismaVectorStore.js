// One user's memory-search vectors in the database, one row per memory entry. Same shape as the
// document vector store in memory/memoryIndex.js: read(entryIds), save(vectorsById),
// remove(entryIds), with vectorsById = { [entryId]: { textHash, vector } }.
export function createPrismaVectorStore({ prisma, userId }) {
  async function read(entryIds) {
    if (entryIds.length === 0) {
      return {};
    }
    const rows = await prisma.memoryEmbedding.findMany({
      where: { userId, entryId: { in: entryIds } },
    });
    const vectorsById = {};
    for (const row of rows) {
      vectorsById[row.entryId] = { textHash: row.textHash, vector: row.vector };
    }
    return vectorsById;
  }

  async function save(vectorsById) {
    const writes = Object.entries(vectorsById).map(([entryId, { textHash, vector }]) => {
      return prisma.memoryEmbedding.upsert({
        where: { userId_entryId: { userId, entryId } },
        create: { userId, entryId, textHash, vector },
        update: { textHash, vector },
      });
    });
    await prisma.$transaction(writes);
  }

  async function remove(entryIds) {
    await prisma.memoryEmbedding.deleteMany({ where: { userId, entryId: { in: entryIds } } });
  }

  return { read, save, remove };
}
