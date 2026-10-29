// Turns emotion scores (GoEmotions labels, each 0..1) into an appraisal of the scene:
//   goal_impact  -1..1  helps (+) or hurts (−) what the character wants
//   novelty       0..1  how unexpected the events are
//   control      -1..1  how much the character can influence what happens
//   social        the strongest social meaning ("kindness", "rejection", …) or "none"
//   threat        0..1  danger or harm, physical or emotional
//   safety        0..1  how safe and supported the character is
// The appraisal judges the event only; it never sets personality values.

const SIGNED_FIELDS = new Set(["goal_impact", "control"]);
const NO_SOCIAL_MEANING = "none";
const DECIMALS = 2;

function clampBetween(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value) {
  return Number(value.toFixed(DECIMALS));
}

function weightedSum(weights, emotionScores) {
  let total = 0;
  for (const [emotion, weight] of Object.entries(weights)) {
    total += weight * (emotionScores[emotion] ?? 0);
  }
  return total;
}

// Classifiers often call short roleplay lines mostly "neutral", which drowns the emotional
// signal. Rescaling the other emotions by the non-neutral share lets that signal count.
export function discountNeutral(emotionScores, { neutralLabel, maximumNeutralShare }) {
  const neutralShare = Math.min(emotionScores[neutralLabel] ?? 0, maximumNeutralShare);
  const emotionalShare = 1 - neutralShare;
  const rescaled = {};
  for (const [emotion, score] of Object.entries(emotionScores)) {
    if (emotion === neutralLabel) {
      continue;
    }
    rescaled[emotion] = Math.min(1, score / emotionalShare);
  }
  return rescaled;
}

function appraisalField(fieldName, weights, emotionScores) {
  const total = weightedSum(weights, emotionScores);
  if (SIGNED_FIELDS.has(fieldName)) {
    return rounded(clampBetween(total, -1, 1));
  }
  return rounded(clampBetween(total, 0, 1));
}

function strongestSocialMeaning(emotionMap, emotionScores) {
  let strongestMeaning = NO_SOCIAL_MEANING;
  let strongestScore = emotionMap.socialThreshold;
  for (const [meaning, weights] of Object.entries(emotionMap.socialMeanings)) {
    const score = weightedSum(weights, emotionScores);
    if (score > strongestScore) {
      strongestScore = score;
      strongestMeaning = meaning;
    }
  }
  return strongestMeaning;
}

export function topEmotions(emotionScores, count) {
  const ranked = Object.entries(emotionScores).sort(([, first], [, second]) => second - first);
  return ranked.slice(0, count).map(([label, score]) => ({ label, score: rounded(score) }));
}

// emotionScores: the classifier's raw { label: score } for all labels.
export function emotionsToAppraisal(storyConfig, emotionScores) {
  const emotionMap = storyConfig.emotionMap;
  const emotional = discountNeutral(emotionScores, storyConfig.emotionModel);
  const appraisal = {};
  for (const [fieldName, weights] of Object.entries(emotionMap.fields)) {
    appraisal[fieldName] = appraisalField(fieldName, weights, emotional);
  }
  appraisal.social = strongestSocialMeaning(emotionMap, emotional);
  appraisal.emotions = topEmotions(emotionScores, emotionMap.topEmotionCount);
  return appraisal;
}
