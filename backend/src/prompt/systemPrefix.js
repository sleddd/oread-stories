// The stable, cached start of every story request: the cast preamble, the story core, the
// roster, the pinned world notes, the output protocol and the rules on trusting story content.
// Nothing here depends on who speaks this turn or on the moment, so the prefix stays
// byte-identical from turn to turn and providers can cache it. The story passed in has already
// been neutralized (prompt/promptSafety.js).
import { castPreamble } from "./castPreamble.js";
import { describeStoryCore } from "./storyCore.js";
import { buildRoster } from "./roster.js";
import { describePinnedWorldNotes } from "./worldNotes.js";
import { outputProtocol } from "./outputProtocol.js";
import { STORY_CONTENT_RULES } from "./promptSafety.js";

export function playerCharacterOf(story) {
  return story.characters.find((character) => character.role === "player") ?? null;
}

export function buildSystemPrefix(story) {
  const playerName = playerCharacterOf(story)?.name ?? "";
  const sections = [
    castPreamble(playerName),
    describeStoryCore(story),
    buildRoster(story),
    describePinnedWorldNotes(story),
    outputProtocol(playerName),
    STORY_CONTENT_RULES,
  ];
  return sections.filter(Boolean).join("\n\n");
}
