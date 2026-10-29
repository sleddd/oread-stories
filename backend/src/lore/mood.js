// Mood is a point in PAD space (pleasure, arousal, dominance), each dial from -2 to 2.
// Its label is the lorebook prototype nearest to that point.
export const MOOD_AXES = ["p", "a", "d"];

const NEUTRAL_LABEL = "neutral";
// Prototypes live in -1..1 space, so dials are halved before comparing.
const DIAL_TO_PROTOTYPE_SCALE = 2;
const STRONG_INTENSITY_DISTANCE = 1.1;
const FAINT_INTENSITY_DISTANCE = 0.35;

function scaledMoodPoint(mood) {
  return [
    mood.p / DIAL_TO_PROTOTYPE_SCALE,
    mood.a / DIAL_TO_PROTOTYPE_SCALE,
    mood.d / DIAL_TO_PROTOTYPE_SCALE,
  ];
}

function squaredDistance(prototype, [pleasure, arousal, dominance]) {
  return (
    (prototype.p - pleasure) ** 2 + (prototype.a - arousal) ** 2 + (prototype.d - dominance) ** 2
  );
}

function nearestPrototype(prototypes, point) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const prototype of prototypes) {
    const distance = squaredDistance(prototype, point);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = prototype;
    }
  }
  return nearest;
}

// How far the mood sits from neutral, as words appended to the label.
function intensityWords(label, distanceFromNeutral) {
  if (label === NEUTRAL_LABEL) {
    return "";
  }
  if (distanceFromNeutral > STRONG_INTENSITY_DISTANCE) {
    return ", strongly";
  }
  if (distanceFromNeutral < FAINT_INTENSITY_DISTANCE) {
    return ", faintly";
  }
  return "";
}

// Nearest mood prototype to the PAD point, with an intensity word from the distance to neutral.
export function moodLabel(lore, personality) {
  const point = scaledMoodPoint(personality.mood);
  const prototype = nearestPrototype(lore.mood.prototypes, point);
  const distanceFromNeutral = Math.hypot(...point);
  return {
    label: prototype.label,
    intensity: intensityWords(prototype.label, distanceFromNeutral),
    proto: prototype,
  };
}
