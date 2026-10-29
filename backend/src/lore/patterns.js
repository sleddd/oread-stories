// Lorebook patterns and warnings: notes that apply when several dials sit in given ranges.
function isInRange(value, [lowest, highest]) {
  return value >= lowest && value <= highest;
}

function patternMatches(pattern, values) {
  const conditions = Object.entries(pattern.when);
  return conditions.every(([axisId, range]) => isInRange(values[axisId] ?? 0, range));
}

export function activePatterns(lore, values) {
  return lore.patterns.filter((pattern) => patternMatches(pattern, values));
}
