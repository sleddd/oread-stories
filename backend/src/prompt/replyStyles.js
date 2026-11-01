// The two ways a story's replies can be written. "conversation" is spoken, short and immediate,
// like texting with someone in the room. "narration" is story prose: the scene told in the
// voice the story's point of view sets, with dialogue in quotation marks. Each story picks one;
// stories saved before the choice existed are conversations.
import { CONDUCT_RULES, TALKING_RULES } from "../lore/prompt.js";

export const CONVERSATION_STYLE = "conversation";
export const NARRATION_STYLE = "narration";
export const REPLY_STYLES = [CONVERSATION_STYLE, NARRATION_STYLE];

const NARRATION_RULES = [
  "Write each reply as a passage of the story:",
  "- Narrate in prose, in the voice the story's point of view sets. Put what {name} says in " +
    "quotation marks, and weave in what they do, what they notice and the feel of the place. " +
    "Never use asterisks, lists, headings or menus of options.",
  "- Usually one to three paragraphs. Let the scene breathe, then stop at the point where the " +
    "other person would act or answer.",
  "- You are inside the story, not advising on it. When something happens in the scene, show " +
    "how {name} meets it.",
  "- Never use emojis or emoticons. Show feelings through what is said and done.",
  ...CONDUCT_RULES,
];

export function replyStyleOf(story) {
  if (REPLY_STYLES.includes(story.replyStyle)) {
    return story.replyStyle;
  }
  return CONVERSATION_STYLE;
}

// The rules for a reply style, with {name} still to be filled in.
export function replyStyleRules(replyStyle) {
  if (replyStyle === NARRATION_STYLE) {
    return NARRATION_RULES;
  }
  return TALKING_RULES;
}
