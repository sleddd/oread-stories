// Lorebook endpoint: the controls the interface draws, computed once since the book never changes.
import { loreControls } from "../lore/controls.js";

export function loreRoutes(router, { lore }) {
  const controls = loreControls(lore);
  router.get("/lore", () => controls);
}
