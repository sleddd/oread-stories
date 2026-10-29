// Builds new stories, characters and scenes with every field filled, so stored data always has
// the same shape.
import { ABILITY_NAMES, DEFAULT_ABILITY_SCORE, DEFAULT_MEMORY_IMPORTANCE } from "./limits.js";

export function defaultAbilities() {
  const abilities = {};
  for (const abilityName of ABILITY_NAMES) {
    abilities[abilityName] = DEFAULT_ABILITY_SCORE;
  }
  return abilities;
}

// What is true right now in a chat. Overwritten every turn, so it never grows.
export function emptyScene() {
  return {
    location: "",
    present: [],
    withinReach: [],
    timeOfDay: "",
    lastSaid: "",
    inMotion: "",
  };
}

export function newStory({ id, title, timestamp, fields = {} }) {
  return {
    id,
    title,
    theme: "",
    plot: "",
    conflict: "",
    pointOfView: "",
    rules: [],
    openingScene: "",
    ...fields,
    characters: [],
    worldNotes: [],
    worldState: [],
    created: timestamp,
    updated: timestamp,
  };
}

// `personality` is the lorebook personality without its name; the name lives on the character.
export function newCharacter({ id, name, role, personality, fields = {} }) {
  return {
    id,
    name,
    role,
    summary: "",
    backstory: "",
    abilities: defaultAbilities(),
    skills: [],
    ...fields,
    personality,
    memory: [],
  };
}

export function newMemoryEntry({ id, input, source, timestamp }) {
  return {
    id,
    kind: input.kind,
    text: input.text,
    about: input.about ?? [],
    importance: input.importance ?? DEFAULT_MEMORY_IMPORTANCE,
    source,
    created: timestamp,
    updated: timestamp,
  };
}

// The story's opening scene as the first entry of a new chat. It is narration, not a character's
// line, so it carries no speaker.
export function openingNarration({ id, text, timestamp }) {
  return { id, role: "narration", content: text, ts: timestamp };
}
