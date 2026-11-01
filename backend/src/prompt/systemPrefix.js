// The stable, cached start of every story request: the cast preamble, the story core, the
// roster, the pinned world notes, the output protocol and the rules on trusting story content.
// Nothing here depends on who speaks this turn or on the moment, so the prefix stays
// byte-identical from turn to turn and providers can cache it. The story passed in has already
// been neutralized (prompt/promptSafety.js).
import { castPreamble } from "./castPreamble.js";
import { describeStoryCore } from "./storyCore.js";
import { buildRoster } from "./roster.js";
import { describePinnedWorldNotes } from "./worldNotes.js";
import { outputProtocol, replyOnlyProtocol } from "./outputProtocol.js";
import { REPLY_ONLY_CONTENT_RULES, STORY_CONTENT_RULES } from "./promptSafety.js";
import { replyStyleOf } from "./replyStyles.js";

export function playerCharacterOf(story) {
  return story.characters.find((character) => character.role === "player") ?? null;
}

function protocolFor(playerName, asksForNotes) {
  if (asksForNotes) {
    return outputProtocol(playerName);
  }
  return replyOnlyProtocol(playerName);
}

function contentRulesFor(asksForNotes) {
  if (asksForNotes) {
    return STORY_CONTENT_RULES;
  }
  return REPLY_ONLY_CONTENT_RULES;
}

// `asksForNotes` is false when a separate memory model writes the notes (services/memoryPass.js),
// so the reply model is asked only for the reply.
export function buildSystemPrefix(story, { asksForNotes = true } = {}) {
  const playerName = playerCharacterOf(story)?.name ?? "";
  const sections = [
    castPreamble(playerName, replyStyleOf(story)),
    describeStoryCore(story),
    buildRoster(story),
    describePinnedWorldNotes(story),
    protocolFor(playerName, asksForNotes),
    contentRulesFor(asksForNotes),
  ];
  return sections.filter(Boolean).join("\n\n");
}
