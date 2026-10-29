// The scene is what is true right now. Each turn's snapshot replaces the last one whole; when a
// turn brings no usable snapshot, the previous one stays, so a sloppy note never wipes the room.

// Returns { scene, isReplaced }.
export function applySceneSnapshot(previousScene, newScene) {
  if (!newScene) {
    return { scene: previousScene, isReplaced: false };
  }
  return { scene: structuredClone(newScene), isReplaced: true };
}
