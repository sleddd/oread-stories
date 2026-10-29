// The public face of the lorebook: what the interface needs to draw its controls
// (names, pole labels, tag labels, situations, presets), without the prompt text itself.
function axisGroups(lore) {
  const groupNames = lore.axes.map((axis) => axis.group);
  return [...new Set(groupNames)];
}

function axisControls(lore) {
  return lore.axes.map(({ id, group, name, low, high }) => ({ id, group, name, low, high }));
}

function metatraitControls(lore) {
  const metatraitList = lore.metatraits || [];
  return metatraitList.map(({ id, name, low, high, note }) => ({ id, name, low, high, note }));
}

function tagControls(lore) {
  return lore.tags.map((group) => ({
    group: group.group,
    items: group.items.map(({ id, label, text }) => ({ id, label, description: text })),
  }));
}

function shiftControls(lore) {
  const shiftEntries = Object.entries(lore.shifts);
  return shiftEntries.map(([id, shift]) => ({ id, word: shift.word }));
}

// Presets are addressed by their position in the book.
function presetControls(lore) {
  return lore.presets.map((preset, index) => ({ id: String(index), name: preset.name }));
}

export function loreControls(lore) {
  return {
    version: lore.version,
    groups: axisGroups(lore),
    axes: axisControls(lore),
    metatraits: metatraitControls(lore),
    tags: tagControls(lore),
    situations: lore.situations.map(({ id, text }) => ({ id, text })),
    shifts: shiftControls(lore),
    presets: presetControls(lore),
  };
}
