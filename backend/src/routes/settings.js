// Settings and provider endpoints: read and patch settings, list a provider's models, and run
// a quick connection test.
export function settingsRoutes(router, { settings, models }) {
  router.get("/settings", () => settings.get());
  router.patch("/settings", async ({ body }) => settings.patch(await body()));
  router.get("/providers/:providerId/models", async ({ params }) => ({
    models: await models.listModels(params.providerId),
  }));
  router.post("/providers/:providerId/test", ({ params }) => models.test(params.providerId));
}
