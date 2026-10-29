// Serialises async tasks so a store's read-modify-write updates never interleave.
export function createWriteLock() {
  let queueTail = Promise.resolve();
  return function runExclusively(task) {
    // Run after the previous task whether it succeeded or failed.
    const run = queueTail.then(task, task);
    queueTail = run.catch(() => {});
    return run;
  };
}
