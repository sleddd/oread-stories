// The stable, cached start of every story request: the cast preamble, the story core, the
// roster, the pinned world notes and the output protocol. Nothing here depends on who speaks
// this turn or on the moment, so the prefix stays byte-identical from turn to turn and providers
// can cache it.
import { castPreamble } from "./castPreamble.js";
import { describeStoryCore } from "./storyCore.js";
import { buildRoster } from "./roster.js";
import { describePinnedWorldNotes } from "./worldNotes.js";
import { outputProtocol } from "./outputProtocol.js";

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
  ];
  return sections.filter(Boolean).join("\n\n");
}
