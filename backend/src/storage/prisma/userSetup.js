// Makes sure a user has what every account starts with: "My story" with its default
// character. It runs right after sign-up and again (cheaply) the first time each request touches
// stories or chats. Same shape as services/storyMigrationRunner.js, so the repositories can
// call either: ensureMigrated(), and runAgain() after an import, which also moves any imported
// chat whose story isn't known into My story.
import {
  withDefaultStory,
  withChatsInStories,
  needsStory,
  storyIdsOf,
} from "../../stories/storyMigration.js";
import { DEFAULT_STORY_ID } from "../../stories/limits.js";
import { storyPlace } from "./prismaStoryRepository.js";
import { chatPlace } from "./prismaChatRepository.js";

// `sealer` seals and opens rows with the user's data key, like the repositories.
export function createUserSetup({ prisma, userId, lore, now, newId, sealer }) {
  let running = null;

  async function hasDefaultStory() {
    const count = await prisma.story.count({ where: { userId, id: DEFAULT_STORY_ID } });
    return count > 0;
  }

  async function createDefaultStory() {
    const { defaultStory } = withDefaultStory({
      lore,
      stories: [],
      oldPersonality: null,
      timestamp: now(),
      newId,
    });
    // skipDuplicates: two first requests at once both try, and one quietly loses.
    await prisma.story.createMany({
      data: [
        {
          userId,
          id: defaultStory.id,
          title: "",
          data: sealer.seal(defaultStory, storyPlace(defaultStory.id)),
        },
      ],
      skipDuplicates: true,
    });
  }

  async function ensureDefaultStory() {
    if (!(await hasDefaultStory())) {
      await createDefaultStory();
    }
  }

  async function moveStrayChats() {
    const storyRows = await prisma.story.findMany({
      where: { userId },
      select: { id: true, data: true },
    });
    const stories = storyRows.map((row) => sealer.open(row.data, storyPlace(row.id)));
    const knownStoryIds = storyIdsOf(stories);
    const chatRows = await prisma.chat.findMany({
      where: { userId },
      select: { id: true, data: true },
    });
    const chats = chatRows.map((row) => sealer.open(row.data, chatPlace(row.id)));
    const strayChats = chats.filter((chat) => needsStory(chat, knownStoryIds));
    if (strayChats.length === 0) {
      return;
    }
    const defaultStory = stories.find((story) => story.id === DEFAULT_STORY_ID);
    const movedChats = withChatsInStories(strayChats, stories, defaultStory);
    await prisma.$transaction(
      movedChats.map((chat) => {
        return prisma.chat.update({
          where: { userId_id: { userId, id: chat.id } },
          data: { storyId: chat.storyId, data: sealer.seal(chat, chatPlace(chat.id)) },
        });
      }),
    );
  }

  // Shares one run between callers; a failed run is forgotten so the next call retries.
  function ensureMigrated() {
    if (!running) {
      running = ensureDefaultStory();
      running.catch(() => {
        running = null;
      });
    }
    return running;
  }

  async function runAgain() {
    running = null;
    await ensureMigrated();
    await moveStrayChats();
  }

  return { ensureMigrated, runAgain };
}
