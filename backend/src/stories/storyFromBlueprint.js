// Makes a new, independent story from a template's blueprint: fresh ids and times on the story,
// its characters, skills, memories, world notes and world state facts. The blueprint itself is
// never changed, so editing the story never touches the template.
import { newStory, newCharacter, newMemoryEntry } from "./factories.js";

export const TEMPLATE_SOURCE = "template";

function skillsWithIds(skills, newId) {
  return skills.map((skill) => ({ id: newId(), ...skill }));
}

function characterFrom(blueprintCharacter, { newId, timestamp }) {
  const character = newCharacter({
    id: newId(),
    name: blueprintCharacter.name,
    role: "ai",
    personality: structuredClone(blueprintCharacter.personality),
    fields: {
      summary: blueprintCharacter.summary,
      backstory: blueprintCharacter.backstory,
      abilities: { ...blueprintCharacter.abilities },
      skills: skillsWithIds(blueprintCharacter.skills, newId),
    },
  });
  character.memory = blueprintCharacter.memory.map((input) => {
    const ownInput = structuredClone(input);
    return newMemoryEntry({ id: newId(), input: ownInput, source: TEMPLATE_SOURCE, timestamp });
  });
  return character;
}

function worldNoteFrom(note, newId) {
  return { id: newId(), ...structuredClone(note) };
}

function worldStateFactFrom(fact, { newId, timestamp }) {
  return { id: newId(), ...structuredClone(fact), updated: timestamp };
}

export function storyFromBlueprint({ blueprint, newId, timestamp }) {
  const { title, theme, plot, conflict, pointOfView, rules, openingScene } = blueprint;
  const story = newStory({
    id: newId(),
    title,
    timestamp,
    fields: { theme, plot, conflict, pointOfView, rules: [...rules], openingScene },
  });
  const stamp = { newId, timestamp };
  story.characters = blueprint.characters.map((character) => characterFrom(character, stamp));
  story.worldNotes = blueprint.worldNotes.map((note) => worldNoteFrom(note, newId));
  story.worldState = blueprint.worldState.map((fact) => worldStateFactFrom(fact, stamp));
  return story;
}
