// How the trait words in a story template ("Reserved", "Witty", "Protective", …) move a
// character's lorebook dials and which style tags they pick. Each trait nudges a few axes by half
// or one step; the nudges add up and are clamped to the dial range. Traits the table doesn't know
// are ignored.
import { clamp, roundToTenth } from "../lore/dials.js";

const HALF_STEP = 0.5;
const FULL_STEP = 1;

// trait → { axes: { axisId: change }, tag?: lorebook tag id }
export const TRAIT_EFFECTS = {
  Reserved: { axes: { communion: -HALF_STEP, attach_avoidance: HALF_STEP } },
  Warm: { axes: { communion: FULL_STEP } },
  Expressive: { axes: { reactivity: HALF_STEP, communion: HALF_STEP } },
  Calm: { axes: { reactivity: -FULL_STEP } },
  Sensitive: { axes: { reactivity: HALF_STEP, communion: HALF_STEP } },
  "Takes Initiative": { axes: { agency: FULL_STEP } },
  Independent: { axes: { agency: HALF_STEP, attach_avoidance: HALF_STEP } },
  Friendly: { axes: { communion: FULL_STEP, valence: HALF_STEP }, tag: "connector" },
  Supportive: { axes: { communion: HALF_STEP, agency: -HALF_STEP } },
  Extroverted: { axes: { agency: HALF_STEP, communion: HALF_STEP, valence: HALF_STEP } },
  Introverted: { axes: { attach_avoidance: HALF_STEP }, tag: "brief" },
  Practical: { axes: { openness: -HALF_STEP, conscientiousness: HALF_STEP }, tag: "plain" },
  Observant: { axes: { conscientiousness: HALF_STEP } },
  Creative: { axes: { openness: FULL_STEP } },
  Curious: { axes: { openness: FULL_STEP }, tag: "collector" },
  Wise: { axes: { reactivity: -HALF_STEP, openness: HALF_STEP } },
  Pensive: { axes: { valence: -HALF_STEP, openness: HALF_STEP } },
  Philosophical: { axes: { openness: FULL_STEP }, tag: "lyrical" },
  Dry: { axes: {}, tag: "dry" },
  Witty: { axes: {}, tag: "banter" },
  Sarcastic: { axes: { communion: -HALF_STEP }, tag: "dry" },
  Playful: { axes: { valence: HALF_STEP }, tag: "banter" },
  Courageous: { axes: { agency: HALF_STEP, attach_anxiety: -HALF_STEP } },
  Authentic: { axes: { honesty_humility: FULL_STEP } },
  Honest: { axes: { honesty_humility: FULL_STEP }, tag: "candor" },
  Loyal: { axes: { communion: HALF_STEP }, tag: "loyalty" },
  Kind: { axes: { communion: FULL_STEP }, tag: "kindness" },
  Compassionate: { axes: { communion: FULL_STEP }, tag: "kindness" },
  Humble: { axes: { honesty_humility: FULL_STEP, agency: -HALF_STEP } },
  Respectful: { axes: { conscientiousness: HALF_STEP } },
  Protective: { axes: { agency: HALF_STEP, communion: HALF_STEP } },
  Encouraging: { axes: { valence: HALF_STEP, communion: HALF_STEP } },
  Steady: { axes: { reactivity: -FULL_STEP } },
  Energetic: { axes: { valence: HALF_STEP, reactivity: HALF_STEP } },
  Intellectual: { axes: { openness: HALF_STEP } },
  Social: { axes: { communion: HALF_STEP }, tag: "connector" },
  Contemplative: { axes: { reactivity: -HALF_STEP, openness: HALF_STEP } },
};

// Every trait word in a template character, in the order the template lists them.
export function traitWordsOf(traits = {}) {
  const words = [];
  for (const groupWords of Object.values(traits)) {
    if (Array.isArray(groupWords)) {
      words.push(...groupWords);
    }
  }
  return words;
}

function knownEffects(traitWords) {
  const effects = traitWords.map((word) => TRAIT_EFFECTS[word]);
  return effects.filter(Boolean);
}

export function dialValuesForTraits(lore, traitWords) {
  const values = {};
  for (const axis of lore.axes) {
    values[axis.id] = 0;
  }
  for (const effect of knownEffects(traitWords)) {
    for (const [axisId, change] of Object.entries(effect.axes)) {
      if (axisId in values) {
        values[axisId] += change;
      }
    }
  }
  for (const axisId of Object.keys(values)) {
    values[axisId] = roundToTenth(clamp(values[axisId]));
  }
  return values;
}

function tagGroupOf(lore, tagId) {
  return lore.tags.findIndex((group) => group.items.some((tag) => tag.id === tagId));
}

// At most one tag per lorebook tag group, the first trait to claim a group wins.
export function tagsForTraits(lore, traitWords) {
  const tags = [];
  const claimedGroups = new Set();
  for (const effect of knownEffects(traitWords)) {
    const group = tagGroupOf(lore, effect.tag);
    if (!effect.tag || group < 0 || claimedGroups.has(group)) {
      continue;
    }
    claimedGroups.add(group);
    tags.push(effect.tag);
  }
  return tags;
}
