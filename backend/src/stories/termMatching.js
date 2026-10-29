// Whether a short term (a keyword, a place, a name) is mentioned in a piece of text. Matches
// whole words only, ignoring case, extra spaces and a leading "the", "a" or "an", so "The old
// house" is found in "back at the old house".

const LEADING_ARTICLE = /^(the|a|an)\s+/;
const PATTERN_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const WORD_EDGE = "[^\\p{L}\\p{N}]";

export function normalizeTerm(term) {
  const lowered = String(term ?? "").toLowerCase();
  const singleSpaced = lowered.replace(/\s+/g, " ").trim();
  return singleSpaced.replace(LEADING_ARTICLE, "");
}

function escapeForPattern(text) {
  return text.replace(PATTERN_SPECIAL_CHARACTERS, "\\$&");
}

export function mentionsTerm(text, term) {
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm) {
    return false;
  }
  const escapedTerm = escapeForPattern(normalizedTerm);
  const pattern = new RegExp(`(^|${WORD_EDGE})${escapedTerm}($|${WORD_EDGE})`, "u");
  const normalizedText = String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  return pattern.test(normalizedText);
}

// True when either term contains the other as whole words ("old house" and "the house").
export function termsOverlap(firstTerm, secondTerm) {
  return mentionsTerm(firstTerm, secondTerm) || mentionsTerm(secondTerm, firstTerm);
}

export function mentionsAnyTerm(text, terms) {
  return terms.some((term) => mentionsTerm(text, term));
}
