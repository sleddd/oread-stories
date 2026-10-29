// Which world state facts go into the turn's scene note: those whose subject or keywords come up
// in the scene or the recent conversation, up to a character budget. The broken window shows up
// when someone is near the window, not every turn.
import { mentionsAnyTerm } from "../stories/termMatching.js";

export const WORLD_STATE_BUDGET = 1_500;

export function describeWorldFact(fact) {
  return `- ${fact.subject}: ${fact.fact}`;
}

function termsOf(fact) {
  return [fact.subject, ...fact.keywords];
}

export function selectWorldState(story, scanText, budget = WORLD_STATE_BUDGET) {
  const selected = [];
  let usedCharacters = 0;
  for (const fact of story.worldState) {
    if (!mentionsAnyTerm(scanText, termsOf(fact))) {
      continue;
    }
    const size = describeWorldFact(fact).length;
    if (usedCharacters + size > budget) {
      continue;
    }
    selected.push(fact);
    usedCharacters += size;
  }
  return selected;
}
