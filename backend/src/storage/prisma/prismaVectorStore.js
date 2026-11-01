// One user's memory-search vectors in the database, one row per memory entry. A vector can be
// partly turned back into the gist of the memory, so it is sealed with the user's data key
// (`sealedVector`) and the plain column is left empty; rows from before sealing still read.
// Same shape as the document vector store in memory/memoryIndex.js: read(entryIds),
// save(vectorsById), remove(entryIds), with vectorsById = { [entryId]: { textHash, vector } }.

export function vectorPlace(entryId) {
  return `vector:${entryId}`;
}

// `sealer` seals and opens rows with the user's data key.
export function createPrismaVectorStore({ prisma, userId, sealer }) {
  function vectorOf(row) {
    if (row.sealedVector) {
      return sealer.open(row.sealedVector, vectorPlace(row.entryId));
    }
    return row.vector;
  }

  async function read(entryIds) {
    if (entryIds.length === 0) {
      return {};
    }
    const rows = await prisma.memoryEmbedding.findMany({
      where: { userId, entryId: { in: entryIds } },
    });
    const vectorsById = {};
    for (const row of rows) {
      vectorsById[row.entryId] = { textHash: row.textHash, vector: vectorOf(row) };
    }
    return vectorsById;
  }

  async function save(vectorsById) {
    const writes = Object.entries(vectorsById).map(([entryId, { textHash, vector }]) => {
      const sealedVector = sealer.seal(vector, vectorPlace(entryId));
      const columns = { textHash, vector: [], sealedVector };
      return prisma.memoryEmbedding.upsert({
        where: { userId_entryId: { userId, entryId } },
        create: { userId, entryId, ...columns },
        update: columns,
      });
    });
    await prisma.$transaction(writes);
  }

  async function remove(entryIds) {
    await prisma.memoryEmbedding.deleteMany({ where: { userId, entryId: { in: entryIds } } });
  }

  return { read, save, remove };
}
