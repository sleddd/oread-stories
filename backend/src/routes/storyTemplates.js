// Pre-built story endpoints: the template list, and starting a new story from a template.
import { created } from "../http/response.js";

export function storyTemplateRoutes(router, { storyTemplates }) {
  router.get("/story-templates", () => ({ templates: storyTemplates.list() }));

  router.post("/story-templates/:templateId/stories", async ({ params }) => {
    return created(await storyTemplates.createStory(params.templateId));
  });
}
