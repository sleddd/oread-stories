// A character stores its lorebook personality without a name (the name is the character's own
// field). These join and split the two so the lorebook code sees a whole personality.
import { normalizePersonality } from "../lore/personality.js";

export function personalityOfCharacter(lore, character) {
  return normalizePersonality(lore, { ...character.personality, name: character.name });
}

export function withoutName(personality) {
  const { name, ...dials } = personality;
  return dials;
}
