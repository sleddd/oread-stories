// Runs the move into stories once per process, before stories or chats are first read. Imports
// ask for it to run again so imported chats without a known story join the default one. Each document is changed under the
// store's lock, so nothing written at the same time is lost.
import {
  withDefaultStory,
  withChatsInStories,
  needsStory,
  storyIdsOf,
} from "../stories/storyMigration.js";

const STORIES_DOCUMENT = "stories";
const CHATS_DOCUMENT = "chats";
const OLD_PERSONALITY_DOCUMENT = "personality";

export function createStoryMigrationRunner({ lore, store, now, newId }) {
  let running = null;

  async function ensureDefaultStory() {
    const oldPersonality = await store.read(OLD_PERSONALITY_DOCUMENT);
    let outcome;
    await store.update(STORIES_DOCUMENT, [], (stories) => {
      outcome = withDefaultStory({
        lore,
        stories,
        oldPersonality,
        timestamp: now(),
        newId,
      });
      return outcome.stories;
    });
    return outcome;
  }

  async function migrate() {
    const { stories, defaultStory } = await ensureDefaultStory();
    const knownStoryIds = storyIdsOf(stories);
    const chats = (await store.read(CHATS_DOCUMENT, [])) || [];
    if (!chats.some((chat) => needsStory(chat, knownStoryIds))) {
      return;
    }
    await store.update(CHATS_DOCUMENT, [], (currentChats) => {
      return withChatsInStories(currentChats, stories, defaultStory);
    });
  }

  // Shares one run between callers; a failed run is forgotten so the next call retries.
  function ensureMigrated() {
    if (!running) {
      running = migrate();
      running.catch(() => {
        running = null;
      });
    }
    return running;
  }

  function runAgain() {
    running = null;
    return ensureMigrated();
  }

  return { ensureMigrated, runAgain };
}
