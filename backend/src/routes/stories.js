// Story endpoints: the story list, a story's overview, and the chats inside a story.
import { created, noContent } from "../http/response.js";
import { requireObject, optionalString } from "../http/validate.js";
import { readNewStory, readStoryChanges } from "../stories/storyInput.js";

const MAX_CHAT_TITLE_LENGTH = 120;

export function storyRoutes(router, { stories, chats }) {
  router.get("/stories", async () => ({ stories: await stories.list() }));

  router.post("/stories", async ({ body }) => {
    return created(await stories.create(readNewStory(await body())));
  });

  router.get("/stories/:storyId", ({ params }) => stories.get(params.storyId));

  router.patch("/stories/:storyId", async ({ params, body }) => {
    return stories.update(params.storyId, readStoryChanges(await body()));
  });

  router.delete("/stories/:storyId", async ({ params }) => {
    await stories.remove(params.storyId);
    return noContent();
  });

  router.get("/stories/:storyId/chats", async ({ params }) => ({
    chats: await chats.listForStory(params.storyId),
  }));

  router.post("/stories/:storyId/chats", async ({ params, body }) => {
    const input = requireObject(await body());
    const title = optionalString(input.title, "title", { max: MAX_CHAT_TITLE_LENGTH });
    return created(await chats.create({ title, storyId: params.storyId }));
  });
}
