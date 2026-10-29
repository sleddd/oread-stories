// Cast endpoints: a story's characters and each character's personality.
import { created, noContent } from "../http/response.js";
import { readNewCharacter, readCharacterChanges } from "../stories/characterInput.js";

const CHARACTER_PATH = "/stories/:storyId/characters/:characterId";

function personalityRoutes(router, cast) {
  function personalityOf(params) {
    return cast.personalityOf(params.storyId, params.characterId);
  }
  router.get(`${CHARACTER_PATH}/personality`, ({ params }) => personalityOf(params).read());
  router.put(`${CHARACTER_PATH}/personality`, async ({ params, body }) => {
    return personalityOf(params).replace(await body());
  });
  router.patch(`${CHARACTER_PATH}/personality`, async ({ params, body }) => {
    return personalityOf(params).patch(await body());
  });
  router.post(`${CHARACTER_PATH}/personality/randomize`, ({ params }) => {
    return personalityOf(params).randomize();
  });
  router.post(`${CHARACTER_PATH}/personality/reset`, ({ params }) => {
    return personalityOf(params).reset();
  });
  router.post(`${CHARACTER_PATH}/personality/presets/:presetId`, ({ params }) => {
    return personalityOf(params).applyPreset(params.presetId);
  });
}

export function characterRoutes(router, { cast }) {
  router.get("/stories/:storyId/characters", async ({ params }) => ({
    characters: await cast.list(params.storyId),
  }));

  router.post("/stories/:storyId/characters", async ({ params, body }) => {
    return created(await cast.create(params.storyId, readNewCharacter(await body())));
  });

  router.get(CHARACTER_PATH, ({ params }) => cast.get(params.storyId, params.characterId));

  router.patch(CHARACTER_PATH, async ({ params, body }) => {
    const changes = readCharacterChanges(await body());
    return cast.update(params.storyId, params.characterId, changes);
  });

  router.delete(CHARACTER_PATH, async ({ params }) => {
    await cast.remove(params.storyId, params.characterId);
    return noContent();
  });

  personalityRoutes(router, cast);
}
