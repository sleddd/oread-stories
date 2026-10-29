// World endpoints: a story's world notes and its world state facts. Posting a fact about a
// subject that already has one replaces it (200) instead of adding another (201).
import { created, noContent } from "../http/response.js";
import {
  readNewWorldNote,
  readWorldNoteChanges,
  readNewWorldStateFact,
  readWorldStateFactChanges,
} from "../stories/worldInput.js";

const NOTES_PATH = "/stories/:storyId/world-notes";
const STATE_PATH = "/stories/:storyId/world-state";

function worldNoteRoutes(router, world) {
  router.get(NOTES_PATH, async ({ params }) => ({
    worldNotes: await world.listNotes(params.storyId),
  }));
  router.post(NOTES_PATH, async ({ params, body }) => {
    return created(await world.createNote(params.storyId, readNewWorldNote(await body())));
  });
  router.patch(`${NOTES_PATH}/:noteId`, async ({ params, body }) => {
    const changes = readWorldNoteChanges(await body());
    return world.updateNote(params.storyId, params.noteId, changes);
  });
  router.delete(`${NOTES_PATH}/:noteId`, async ({ params }) => {
    await world.removeNote(params.storyId, params.noteId);
    return noContent();
  });
}

function worldStateRoutes(router, world) {
  router.get(STATE_PATH, async ({ params }) => ({
    worldState: await world.listFacts(params.storyId),
  }));
  router.post(STATE_PATH, async ({ params, body }) => {
    const outcome = await world.setFact(params.storyId, readNewWorldStateFact(await body()));
    if (outcome.isNew) {
      return created(outcome.fact);
    }
    return outcome.fact;
  });
  router.patch(`${STATE_PATH}/:factId`, async ({ params, body }) => {
    const changes = readWorldStateFactChanges(await body());
    return world.updateFact(params.storyId, params.factId, changes);
  });
  router.delete(`${STATE_PATH}/:factId`, async ({ params }) => {
    await world.removeFact(params.storyId, params.factId);
    return noContent();
  });
}

export function worldRoutes(router, { world }) {
  worldNoteRoutes(router, world);
  worldStateRoutes(router, world);
}
