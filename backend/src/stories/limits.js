// Size limits and allowed values for stories, characters, world notes, world state, memory and
// scenes. Kept in one place so validation, migration and the prompt budget agree.

export const DEFAULT_STORY_ID = "my-story";
export const DEFAULT_STORY_TITLE = "My story";

export const MAX_STORY_TITLE_LENGTH = 120;
export const MAX_STORY_FIELD_LENGTH = 4_000;
export const MAX_STORY_RULES = 30;
export const MAX_STORY_RULE_LENGTH = 1_500;
export const MAX_OPENING_SCENE_LENGTH = 8_000;

export const MAX_CHARACTER_NAME_LENGTH = 60;
export const MAX_SUMMARY_LENGTH = 400;
export const MAX_BACKSTORY_LENGTH = 8_000;
export const CHARACTER_ROLES = ["ai", "player"];

export const ABILITY_NAMES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];
export const MIN_ABILITY_SCORE = 1;
export const MAX_ABILITY_SCORE = 20;
export const DEFAULT_ABILITY_SCORE = 10;

export const MAX_SKILLS = 40;
export const MAX_SKILL_NAME_LENGTH = 60;
export const MAX_SKILL_NOTE_LENGTH = 300;
export const MIN_SKILL_LEVEL = 0;
export const MAX_SKILL_LEVEL = 10;

export const MEMORY_KINDS = [
  "identity",
  "thread",
  "self",
  "introspection",
  "person",
  "event",
  "place",
  "world",
  "goal",
  "opinion",
];
// Each character has at most one of these; writing another rewrites it in place.
export const SINGLE_MEMORY_KINDS = ["identity", "thread"];
export const MAX_MEMORY_TEXT_LENGTH = 1_000;
export const MAX_MEMORY_ABOUT_ITEMS = 12;
export const MAX_MEMORY_ABOUT_LENGTH = 80;
export const MIN_MEMORY_IMPORTANCE = 1;
export const MAX_MEMORY_IMPORTANCE = 5;
export const DEFAULT_MEMORY_IMPORTANCE = 3;

export const WORLD_NOTE_CATEGORIES = [
  "general",
  "setting",
  "culture",
  "government",
  "economy",
  "history",
  "technology",
];
export const MAX_WORLD_NOTE_TITLE_LENGTH = 120;
export const MAX_WORLD_NOTE_TEXT_LENGTH = 8_000;
export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;

// World state is a short list of standing facts, never a log, so it is capped hard.
export const MAX_WORLD_STATE_FACTS = 40;
export const MAX_WORLD_STATE_SUBJECT_LENGTH = 80;
export const MAX_WORLD_STATE_FACT_LENGTH = 300;

export const MAX_SCENE_FIELD_LENGTH = 300;
export const MAX_SCENE_LIST_ITEMS = 20;
export const MAX_SCENE_LIST_ITEM_LENGTH = 80;
