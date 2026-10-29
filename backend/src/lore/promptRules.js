// The lines of the system prompt, in order. Each rule source in the lorebook has its own
// function: trait text, patterns, voice tags, situational rules, action voice, then mood.
import { bandOf } from "./dials.js";
import { MOOD_AXES, moodLabel } from "./mood.js";
import { activePatterns } from "./patterns.js";

export const CLOSING_RULE =
  "Stay in this character consistently across the conversation. " +
  "Let these traits show through how you speak, not by naming or describing them.";

// A mood dial at or beyond this distance from zero pulls in its low or high line.
const MOOD_POLE_THRESHOLD = 0.6;

function dialValue(personality, axisId) {
  return personality.values[axisId] ?? 0;
}

function axisGroupsInOrder(lore) {
  const groupNames = lore.axes.map((axis) => axis.group);
  return [...new Set(groupNames)];
}

function pushIfPresent(rules, text) {
  if (text) {
    rules.push(text);
  }
}

// Each trait's text for its band, followed by the book's description and reply-language lines.
function traitRules(lore, personality) {
  const rules = [];
  for (const group of axisGroupsInOrder(lore)) {
    const axesInGroup = lore.axes.filter((axis) => axis.group === group);
    for (const axis of axesInGroup) {
      const band = bandOf(lore, dialValue(personality, axis.id));
      const language = lore.language?.[axis.id]?.[band];
      pushIfPresent(rules, axis.text[band]);
      pushIfPresent(rules, language?.d);
      pushIfPresent(rules, language?.r);
    }
  }
  return rules;
}

function patternRules(lore, personality) {
  const patterns = activePatterns(lore, personality.values);
  const behaviourPatterns = patterns.filter((pattern) => pattern.kind === "pattern");
  return behaviourPatterns.map((pattern) => pattern.text);
}

// Tags appear in lorebook order, not the order the user picked them.
function tagRules(lore, personality) {
  const rules = [];
  for (const group of lore.tags) {
    for (const tag of group.items) {
      if (personality.tags.includes(tag.id)) {
        rules.push(tag.text);
      }
    }
  }
  return rules;
}

function directionLabel(axis, direction) {
  if (direction === "high") {
    return axis.high;
  }
  return axis.low;
}

function situationalRules(lore, personality) {
  const rules = [];
  for (const rule of personality.rules) {
    const axis = lore.axes.find((candidate) => candidate.id === rule.axis);
    const situation = lore.situations.find((candidate) => candidate.id === rule.situation);
    if (!axis || !situation) {
      continue;
    }
    const shiftWord = lore.shifts[rule.amount].word;
    const pole = directionLabel(axis, rule.dir).toLowerCase();
    rules.push(`When ${situation.text}, you become ${shiftWord} more ${pole}.`);
  }
  return rules;
}

// Action voice: the intro, then the strongest traits' lines, up to the book's limit.
function actionVoiceRules(lore, personality) {
  const actionVoice = lore.actionVoice;
  if (!actionVoice) {
    return [];
  }
  const candidates = lore.axes.map((axis) => {
    const value = dialValue(personality, axis.id);
    return { strength: Math.abs(value), text: actionVoice[axis.id]?.[bandOf(lore, value)] };
  });
  const withText = candidates.filter((candidate) => candidate.text);
  const strongestFirst = withText.sort((first, second) => second.strength - first.strength);
  const kept = strongestFirst.slice(0, actionVoice.limit ?? Infinity);
  const lines = kept.map((candidate) => candidate.text);
  if (!lines.length) {
    return [];
  }
  return [actionVoice.intro, ...lines];
}

// "low", "high", or null when the mood dial sits near the middle.
function moodPole(mood, moodAxis) {
  if (mood[moodAxis] <= -MOOD_POLE_THRESHOLD) {
    return "low";
  }
  if (mood[moodAxis] >= MOOD_POLE_THRESHOLD) {
    return "high";
  }
  return null;
}

// For each mood dial past the threshold, the matching line from a book section (if any).
function moodPoleLines(mood, linesByAxis) {
  const lines = [];
  for (const moodAxis of MOOD_AXES) {
    const pole = moodPole(mood, moodAxis);
    if (pole) {
      pushIfPresent(lines, linesByAxis?.[moodAxis]?.[pole]);
    }
  }
  return lines;
}

function capitalizeFirstLetter(text) {
  return text[0].toUpperCase() + text.slice(1);
}

// The mood intro, then each dial's line, the mood's own line, the action lines and the mood rule.
function moodRules(lore, personality) {
  const mood = moodLabel(lore, personality);
  const rules = [];
  rules.push(lore.mood.intro.replace("{label}", mood.label).replace("{intensity}", mood.intensity));
  rules.push(...moodPoleLines(personality.mood, lore.mood.axes));
  pushIfPresent(rules, mood.proto?.show);
  rules.push(...moodPoleLines(personality.mood, lore.moodAction?.axes));
  const prototypeAction = lore.moodAction?.proto?.[mood.label];
  if (prototypeAction) {
    rules.push(capitalizeFirstLetter(prototypeAction));
  }
  pushIfPresent(rules, lore.mood.rule);
  return rules;
}

export function promptRules(lore, personality) {
  return [
    ...traitRules(lore, personality),
    ...patternRules(lore, personality),
    ...tagRules(lore, personality),
    ...situationalRules(lore, personality),
    ...actionVoiceRules(lore, personality),
    ...moodRules(lore, personality),
    CLOSING_RULE,
  ];
}
