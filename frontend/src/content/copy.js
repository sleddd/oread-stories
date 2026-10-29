// Interface wording that isn't part of the lorebook.

export const MOOD_AXES = [
  { id: "p", name: "Pleasure", low: "Displeased", high: "Pleased" },
  { id: "a", name: "Arousal", low: "Subdued", high: "Energized" },
  { id: "d", name: "Dominance", low: "Out of control", high: "In control" },
];

export const MOOD_NOTE =
  "A passing state on the pleasure, arousal and dominance axes. It shifts tone without changing the character.";

export const GROUP_NOTES = {
  Temperament: "How this character feels and works on average.",
  Social: "How it positions itself toward the person it talks to.",
  Attachment: "How it handles closeness and the fear of losing it.",
};

export const MASTER_DIALS_NOTE =
  "Stability and Plasticity sit above the nine traits. Moving one shifts all of its traits together, " +
  "and moving a single trait moves its master dial in turn.";

export const VOICE_TAGS_NOTE = "Lore entries that add style on top of the traits. Pick any combination.";

export const SITUATIONAL_SHIFTS_NOTE =
  "If-then signatures: two characters with the same dials still differ in what moves them. " +
  "Each rule nudges one trait in one situation.";

export const LOREBOOK_INTRO =
  "Tune nine trait dials, set a passing mood, add voice tags and situational shifts. Changes reshape the " +
  "character from their next reply, mid-story, and show up in the chat as a personality shift.";

export const LOREBOOK_FOOTER =
  "Trait axes merge HEXACO, the interpersonal circumplex, adult attachment dimensions and Mehrabian’s PAD model. " +
  "Contrast pairs follow the persona-vector recipe (a trait plus a natural-language description, written as " +
  "opposing instructions) so each axis can also be extracted as an activation direction. Steering directions " +
  "are coupled in real models, so extreme values on several axes at once can interfere.";

export const COMPOSER_HINT = "Enter to send · Shift+Enter for a new line";

export const CONTEXT_NOTE =
  "Exactly what the model will receive if you send now: the lorebook prompt and the recent messages, " +
  "including your draft.";
