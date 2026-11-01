// One user's stories in the database: a row per story holding the whole story as JSON, the same
// shape the services use, sealed with the user's data key (security/sealedJson.js). The title
// column is left blank; the title lives inside the sealed story. A change locks only that
// story's row while it is read, changed and written back, so two requests can't lose each
// other's changes.
import { notFound } from "../../http/errors.js";

function storyNotFound(storyId) {
  return notFound(`There is no story "${storyId}".`);
}

export function storyPlace(storyId) {
  return `story:${storyId}`;
}

function columnsOf(story, sealer) {
  return { title: "", data: sealer.seal(story, storyPlace(story.id)) };
}

function rowFor(userId, story, sealer) {
  return { userId, id: story.id, ...columnsOf(story, sealer) };
}

// `sealer` seals and opens rows with the user's data key.
export function createPrismaStoryRepository({ prisma, userId, migration, now, sealer }) {
  function storyKey(storyId) {
    return { userId_id: { userId, id: storyId } };
  }

  function openRow(row) {
    return sealer.open(row.data, storyPlace(row.id));
  }

  async function listStories() {
    await migration.ensureMigrated();
    const rows = await prisma.story.findMany({
      where: { userId },
      orderBy: { sequence: "asc" },
      select: { id: true, data: true },
    });
    return rows.map(openRow);
  }

  async function findStory(storyId) {
    await migration.ensureMigrated();
    const row = await prisma.story.findUnique({
      where: storyKey(storyId),
      select: { id: true, data: true },
    });
    if (!row) {
      throw storyNotFound(storyId);
    }
    return openRow(row);
  }

  async function lockedStory(transaction, storyId) {
    const rows = await transaction.$queryRaw`
      SELECT id, data FROM story WHERE "userId" = ${userId} AND id = ${storyId} FOR UPDATE`;
    if (rows.length === 0) {
      throw storyNotFound(storyId);
    }
    return openRow(rows[0]);
  }

  // Applies `applyChange` to one story, stamps its update time and returns what applyChange
  // returned (or the saved story when it returned nothing).
  async function updateStory(storyId, applyChange) {
    await migration.ensureMigrated();
    return prisma.$transaction(async (transaction) => {
      const story = await lockedStory(transaction, storyId);
      const changeResult = applyChange(story);
      story.updated = now();
      await transaction.story.update({
        where: storyKey(storyId),
        data: columnsOf(story, sealer),
      });
      return structuredClone(changeResult ?? story);
    });
  }

  async function addStory(story) {
    await migration.ensureMigrated();
    await prisma.story.create({ data: rowFor(userId, story, sealer) });
  }

  async function removeStory(storyId) {
    await migration.ensureMigrated();
    const deleted = await prisma.story.deleteMany({ where: { userId, id: storyId } });
    if (deleted.count === 0) {
      throw storyNotFound(storyId);
    }
  }

  // Adds or replaces stories by id (used by import).
  async function saveStories(importedStories) {
    await migration.ensureMigrated();
    await prisma.$transaction(
      importedStories.map((story) => {
        return prisma.story.upsert({
          where: storyKey(story.id),
          create: rowFor(userId, story, sealer),
          update: columnsOf(story, sealer),
        });
      }),
    );
  }

  return { listStories, findStory, updateStory, addStory, removeStory, saveStories };
}
