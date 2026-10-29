// Personality endpoints: read, replace, patch, randomize, reset and apply a preset.
export function personalityRoutes(router, { personality }) {
  router.get("/personality", () => personality.read());
  router.put("/personality", async ({ body }) => personality.replace(await body()));
  router.patch("/personality", async ({ body }) => personality.patch(await body()));
  router.post("/personality/randomize", () => personality.randomize());
  router.post("/personality/reset", () => personality.reset());
  router.post("/personality/presets/:presetId", ({ params }) => {
    return personality.applyPreset(params.presetId);
  });
}
