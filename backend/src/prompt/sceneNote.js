// The per-turn scene note, added after the newest user message. It carries everything about this
// moment: the scene snapshot, who is here and how they feel, what each AI character is in the
// middle of, the world facts and notes that came up, the main speaker's full sheet and anything
// they recalled. It changes every turn, so it stays out of the cached prefix.
import { describeScene } from "./describeScene.js";
import { describeWorldNote } from "./worldNotes.js";
import { describeWorldFact } from "./worldState.js";

const NOTE_OPENING = "[Scene note: for you only. Never quote it or mention it.]";

function describePresent({ presentCharacters, playerName }) {
  const descriptions = presentCharacters.map(({ character, moodLabel }) => {
    return `${character.name} (feeling ${moodLabel})`;
  });
  let line = `Characters you play in this scene: ${descriptions.join(", ")}.`;
  if (playerName) {
    line += ` ${playerName} is here too.`;
  }
  return line;
}

function describeThreads(presentCharacters) {
  const lines = [];
  for (const { character } of presentCharacters) {
    const thread = character.memory.find((entry) => entry.kind === "thread");
    if (thread) {
      lines.push(`- ${character.name}: ${thread.text}`);
    }
  }
  if (lines.length === 0) {
    return "";
  }
  return ["What each of them is in the middle of:", ...lines].join("\n");
}

function describeList(heading, items, describeItem) {
  if (items.length === 0) {
    return "";
  }
  return [heading, ...items.map(describeItem)].join("\n");
}

function describeRecall(recall) {
  if (!recall) {
    return "";
  }
  const heading = `What ${recall.characterName} finds when reaching for "${recall.query}":`;
  if (recall.memoryLines.length === 0) {
    return `${heading}\nNothing comes back. Don't write a recall line again this turn.`;
  }
  return [heading, ...recall.memoryLines, "Don't write a recall line again this turn."].join("\n");
}

function closingInstruction(speakerName) {
  return `Write this reply as ${speakerName}. Begin with [[speaker: ${speakerName}]].`;
}

// presentCharacters: [{ character, moodLabel }] for the AI characters in the scene.
// recall: { characterName, query, memoryLines } or null.
export function buildSceneNote({
  scene,
  presentCharacters,
  playerName,
  worldFacts,
  worldNotes,
  characterSheet,
  speakerName,
  recall = null,
}) {
  const sections = [
    NOTE_OPENING,
    describeScene(scene),
    describePresent({ presentCharacters, playerName }),
    describeThreads(presentCharacters),
    describeList("How the world stands:", worldFacts, describeWorldFact),
    describeList("From the world notes:", worldNotes, describeWorldNote),
    characterSheet,
    describeRecall(recall),
    closingInstruction(speakerName),
  ];
  return sections.filter(Boolean).join("\n\n");
}
