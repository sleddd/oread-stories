// Wording for stories: memory kinds, world note categories, abilities and section notes. The
// ids match the backend's allowed values.

export const MEMORY_KINDS = [
  { id: "identity", label: "Identity", description: "Who I am, who I want to be, who I was." },
  {
    id: "thread",
    label: "In the middle of",
    description: "Doing, waiting for, decided but not done.",
  },
  { id: "self", label: "About myself" },
  { id: "introspection", label: "Introspection" },
  { id: "person", label: "People" },
  { id: "event", label: "Events" },
  { id: "place", label: "Places" },
  { id: "world", label: "The world" },
  { id: "goal", label: "Goals" },
  { id: "opinion", label: "Opinions" },
];

// One entry each per character, rewritten in place.
export const SINGLE_MEMORY_KINDS = ["identity", "thread"];

export const WORLD_NOTE_CATEGORIES = [
  { id: "general", label: "Lore & history" },
  { id: "setting", label: "Setting & Geography" },
  { id: "culture", label: "Culture & Daily Life" },
  { id: "government", label: "Government & Politics" },
  { id: "economy", label: "Economy & Trade" },
  { id: "history", label: "History & Lore" },
  { id: "technology", label: "Technology or Magic Systems" },
];

export const ABILITIES = [
  { id: "strength", label: "Strength" },
  { id: "dexterity", label: "Dexterity" },
  { id: "constitution", label: "Constitution" },
  { id: "intelligence", label: "Intelligence" },
  { id: "wisdom", label: "Wisdom" },
  { id: "charisma", label: "Charisma" },
];

export const ABILITY_LIMITS = { minimum: 1, maximum: 20 };
export const SKILL_LIMITS = { minimum: 0, maximum: 10 };
export const IMPORTANCE_LIMITS = { minimum: 1, maximum: 5 };
export const DEFAULT_IMPORTANCE = 3;

export const CHARACTER_ROLES = [
  { id: "ai", label: "AI character" },
  { id: "player", label: "Played by you" },
];

export const STORIES_INTRO =
  "A story holds its cast, its world and its chats. Each character remembers the story in their " +
  "own way, and their memory carries across every chat in the story.";

export const MEMORY_NOTE =
  "What this character remembers, in their own words. The story writes to it as it goes; you can " +
  "edit, remove or add anything. Memories follow the character into every chat in this story.";

export const WORLD_NOTES_NOTE =
  "Background you write. Pinned notes go with every reply; the rest are brought in when their " +
  "keywords come up.";

export const WORLD_STATE_NOTE =
  "Lasting facts about places and things, like a broken window or a letter on the table. The " +
  "story keeps these up to date; it changes a fact rather than adding a new one.";

export const ABILITIES_NOTE =
  "The story judges each scene like a dice check and nudges these up or down, one step at a time.";

export const SCENE_NOTE = "What is true right now. The story rewrites this every turn.";

export const EMPTY_SCENE_NOTE = "The scene fills in as the story is played.";

export const PENDING_SCENE_NOTE = "Applies with your next message.";

export const MAX_TOKENS_WARNING = "Story turns need about 2048 so the hidden notes fit.";

export const RECALLING_STATUS = "Remembering…";

export const BLANK_STORY_LABEL = "A blank story";

export const NARRATION_LABEL = "Narration";

export const TEMPLATE_SOURCE_LABEL = "From the story template";

export const TEMPLATE_CATEGORY_LABELS = {
  mystery: "Mystery",
  romance: "Romance",
  "sci-fi": "Sci-fi",
  fantasy: "Fantasy",
  historical: "Historical",
  companion: "Companion",
};
