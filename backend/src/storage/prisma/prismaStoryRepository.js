// One user's stories in the database: a row per story holding the whole story as JSON, the same
// shape the services use. A change locks only that story's row while it is read, changed and
// written back, so two requests can't lose each other's changes.
import { notFound } from "../../http/errors.js";

function storyNotFound(storyId) {
  return notFound(`There is no story "${storyId}".`);
}

function rowFor(userId, story) {
  return { userId, id: story.id, title: story.title ?? "", data: story };
}

export function createPrismaStoryRepository({ prisma, userId, migration, now }) {
  function storyKey(storyId) {
    return { userId_id: { userId, id: storyId } };
  }

  async function listStories() {
    await migration.ensureMigrated();
    const rows = await prisma.story.findMany({
      where: { userId },
      orderBy: { sequence: "asc" },
      select: { data: true },
    });
    return rows.map((row) => row.data);
  }

  async function findStory(storyId) {
    await migration.ensureMigrated();
    const row = await prisma.story.findUnique({ where: storyKey(storyId), select: { data: true } });
    if (!row) {
      throw storyNotFound(storyId);
    }
    return row.data;
  }

  async function lockedStory(transaction, storyId) {
    const rows = await transaction.$queryRaw`
      SELECT data FROM story WHERE "userId" = ${userId} AND id = ${storyId} FOR UPDATE`;
    if (rows.length === 0) {
      throw storyNotFound(storyId);
    }
    return rows[0].data;
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
        data: { title: story.title ?? "", data: story },
      });
      return structuredClone(changeResult ?? story);
    });
  }

  async function addStory(story) {
    await migration.ensureMigrated();
    await prisma.story.create({ data: rowFor(userId, story) });
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
        const row = rowFor(userId, story);
        return prisma.story.upsert({
          where: storyKey(story.id),
          create: row,
          update: { title: row.title, data: row.data },
        });
      }),
    );
  }

  return { listStories, findStory, updateStory, addStory, removeStory, saveStories };
}
