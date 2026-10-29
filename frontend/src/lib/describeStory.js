// Turns story records into short readable text: where a memory came from, an ability modifier,
// one line per change in a turn, and the pre-built stories in the new-story picker.
import { formatDialValue } from "./format.js";
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_SOURCE_LABEL } from "../content/story.js";

const ABILITY_MODIFIER_BASE = 10;

// Like a tabletop modifier: 10–11 is +0, 14 is +2, 8 is −1.
export function abilityModifier(score) {
  const modifier = Math.floor((score - ABILITY_MODIFIER_BASE) / 2);
  if (modifier === 0) {
    return "+0";
  }
  return formatDialValue(modifier, 0);
}

// lookups: { characterNameFor(characterId), chatTitleFor(chatId) }
export function describeMemorySource(source, lookups) {
  if (!source || source === "user") {
    return "Written by you";
  }
  if (source === "template") {
    return TEMPLATE_SOURCE_LABEL;
  }
  const turnText = source.turn ? `, turn ${source.turn}` : "";
  const chatText = `${lookups.chatTitleFor(source.chatId)}${turnText}`;
  if (source.toldBy) {
    return `Told by ${lookups.characterNameFor(source.toldBy)} · ${chatText}`;
  }
  return chatText;
}

function describeStepChange(change) {
  if (change.from === null || change.from === undefined) {
    return `${change.characterName} learned ${change.name} (${change.to})`;
  }
  const direction = change.to > change.from ? "rose" : "fell";
  return `${change.characterName}'s ${change.name} ${direction} ${change.from} → ${change.to}`;
}

// Memory changes come in two shapes: from the stream { op, before, after } and from the chat's
// turn log { op, text }.
function memoryTextOf(change) {
  return change.text ?? change.after?.text ?? change.before?.text ?? "";
}

function describeMemoryChange(change) {
  const text = memoryTextOf(change);
  if (change.op === "remove") {
    return `${change.characterName} forgot: ${text}`;
  }
  if (change.op === "add") {
    return `${change.characterName} remembered: ${text}`;
  }
  return `${change.characterName} now remembers: ${text}`;
}

// World changes: from the stream { op, subject, before, after }; from the turn log
// { op, subject, fact }.
function describeWorldChange(change) {
  if (change.op === "remove") {
    return `No longer true: ${change.subject}`;
  }
  const fact = change.fact ?? change.after?.fact ?? "";
  return `${change.subject}: ${fact}`;
}

// turnChanges: { updates?, memory?, worldState? } → [{ id, group, text }]
export function describeTurnChanges(turnChanges) {
  const lines = [];
  (turnChanges.updates ?? []).forEach((change, index) => {
    lines.push({
      id: `update-${index}`,
      group: "Skills and abilities",
      text: describeStepChange(change),
    });
  });
  (turnChanges.memory ?? []).forEach((change, index) => {
    lines.push({ id: `memory-${index}`, group: "Memories", text: describeMemoryChange(change) });
  });
  (turnChanges.worldState ?? []).forEach((change, index) => {
    lines.push({ id: `world-${index}`, group: "The world", text: describeWorldChange(change) });
  });
  return lines;
}

// "Whodunnit Manor · Mystery", for the pre-built story dropdown.
export function describeTemplateOption(template) {
  const categoryLabel = TEMPLATE_CATEGORY_LABELS[template.category];
  if (!categoryLabel) {
    return template.title;
  }
  return `${template.title} · ${categoryLabel}`;
}

// "With Ann, Bea and Cal."
export function describeCastNames(names) {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return `With ${names[0]}.`;
  }
  const allButLast = names.slice(0, -1).join(", ");
  return `With ${allButLast} and ${names[names.length - 1]}.`;
}
