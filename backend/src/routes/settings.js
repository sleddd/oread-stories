// Settings and provider endpoints: read and patch settings, list (or search) a provider's
// models, and run a quick connection test.
import { optionalString } from "../http/validate.js";

const MAX_MODEL_SEARCH_LENGTH = 100;

export function settingsRoutes(router, { settings, models }) {
  router.get("/settings", () => settings.get());
  router.patch("/settings", async ({ body }) => settings.patch(await body()));
  router.get("/providers/:providerId/models", async ({ params, query }) => {
    const search = optionalString(query.get("search") ?? undefined, "search", {
      max: MAX_MODEL_SEARCH_LENGTH,
    });
    return { models: await models.listModels(params.providerId, { search: search?.trim() }) };
  });
  router.post("/providers/:providerId/test", ({ params }) => models.test(params.providerId));
}
