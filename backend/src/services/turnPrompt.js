// Builds one story request: the cached system prefix, the working memory (the last few turns,
// word for word) and the per-turn scene note, added after the newest user message.
// Only the speaking character's full sheet is sent; everyone else is a roster line, a mood and
// a thread. See plan/stories-and-memory-plan.md, "Prompt design".
// Everything that goes in is a neutralized copy (prompt/promptSafety.js), so nothing written in
// the story, the conversation or a memory can pass for the app's own markers. Memory search and
// the story engine keep reading the original story.
import { buildSystemPrefix, playerCharacterOf } from "../prompt/systemPrefix.js";
import { buildCharacterSheet } from "../prompt/characterSheet.js";
import { buildSceneNote } from "../prompt/sceneNote.js";
import { sceneText } from "../prompt/describeScene.js";
import { selectWorldNotes } from "../prompt/worldNotes.js";
import { selectWorldState } from "../prompt/worldState.js";
import { selectMemories, recentMemories } from "../prompt/selectMemories.js";
import { describeMemoryLine, assignShortIds } from "../prompt/memoryLines.js";
import { triggeredMemories } from "../memory/triggeredMemories.js";
import { searchMemories } from "../memory/searchMemories.js";
import { presentAiCharacters } from "../stories/predictSpeaker.js";
import { personalityOfCharacter } from "../stories/characterPersonality.js";
import { moodLabel } from "../lore/mood.js";
import { workingMemoryEntries, windowStart, NARRATION_ROLE } from "./context.js";
import { neutralizedForPrompt, neutralizePromptText } from "../prompt/promptSafety.js";

// How many of the newest turns are scanned for keywords and used as the meaning-search query.
const RECENT_TURNS_TO_SCAN = 4;
const MEANING_SEARCH_LIMIT = 5;
// How close in meaning (cosine similarity) a memory must be to the last few turns to come back
// on its own. Unrelated sentences score near zero with the local model; related ones well above.
const MEANING_SEARCH_MINIMUM_SCORE = 0.3;
const RECALL_SEARCH_LIMIT = 6;
const NOTE_SEPARATOR = "\n\n";

function speakerNameOf(story, message) {
  const speaker = story.characters.find((character) => character.id === message.speakerId);
  return speaker?.name ?? "";
}

const NARRATION_LABEL = "(Narration)";

// Replies in the history carry their speaker header, so the model can tell who said what.
// Narration goes in as a user turn, since it sets the scene rather than answering anything.
function historyTurn(story, message) {
  if (message.role === NARRATION_ROLE) {
    return { role: "user", content: `${NARRATION_LABEL}\n${message.content}` };
  }
  const speakerName = speakerNameOf(story, message);
  if (message.role !== "assistant" || !speakerName) {
    return { role: message.role, content: message.content };
  }
  return { role: "assistant", content: `[[speaker: ${speakerName}]]\n${message.content}` };
}

// The working memory: the turns inside the history window, plus an unsent draft if any.
function workingMemory(story, messages, historyWindow, draft) {
  const start = windowStart(messages.length, historyWindow);
  const turns = workingMemoryEntries(messages.slice(start)).map((message) => {
    return historyTurn(story, message);
  });
  if (draft.trim()) {
    turns.push({ role: "user", content: draft.trim() });
  }
  return turns;
}

function recentText(turns) {
  const recentTurns = turns.slice(-RECENT_TURNS_TO_SCAN);
  return recentTurns.map((turn) => turn.content).join("\n");
}

function newestUserText(turns) {
  const userTurns = turns.filter((turn) => turn.role === "user");
  return userTurns[userTurns.length - 1]?.content ?? "";
}

// The scene note goes after the newest user message, so the history before it stays the same
// from turn to turn and can be cached.
function withSceneNote(turns, sceneNote) {
  const messages = turns.map((turn) => ({ ...turn }));
  const lastTurn = messages[messages.length - 1];
  if (lastTurn?.role === "user") {
    lastTurn.content += NOTE_SEPARATOR + sceneNote;
  } else {
    messages.push({ role: "user", content: sceneNote });
  }
  return messages;
}

// Terms that trigger memories: the place, who's here, what's within reach, the facts in view.
function triggerTerms(scene, worldFacts) {
  const terms = [scene?.location, ...(scene?.present ?? []), ...(scene?.withinReach ?? [])];
  terms.push(...worldFacts.map((fact) => fact.subject));
  return terms.filter(Boolean);
}

export function createTurnPrompt({ lore, storyEngine, memoryIndex }) {
  function effectivePersonalityOf(chat, character) {
    const basePersonality = personalityOfCharacter(lore, character);
    if (!storyEngine) {
      return basePersonality;
    }
    return storyEngine.effectiveFor(chat, character.id, basePersonality);
  }

  async function chooseMemoryLines({ speaker, turns, scene, worldFacts, shortIds }) {
    const triggered = triggeredMemories(speaker.memory, {
      terms: triggerTerms(scene, worldFacts),
      text: newestUserText(turns),
    });
    const searched = await searchMemories({
      memoryIndex,
      entries: speaker.memory,
      query: recentText(turns),
      limit: MEANING_SEARCH_LIMIT,
      minimumScore: MEANING_SEARCH_MINIMUM_SCORE,
    });
    const recent = recentMemories(speaker.memory);
    const selected = selectMemories({ triggered, searched, recent });
    return assignShortIds(selected, shortIds).map(({ shortId, entry }) => {
      return describeMemoryLine(shortId, entry);
    });
  }

  // Searches the speaker's whole memory for what they're reaching for.
  async function recall({ speaker, query, shortIds }) {
    const found = await searchMemories({
      memoryIndex,
      entries: speaker.memory,
      query,
      limit: RECALL_SEARCH_LIMIT,
    });
    const memoryLines = assignShortIds(found, shortIds).map(({ shortId, entry }) => {
      return describeMemoryLine(shortId, entry);
    });
    return {
      characterName: neutralizePromptText(speaker.name),
      query: neutralizePromptText(query),
      memoryLines,
    };
  }

  function describePresentCharacters(story, chat) {
    return presentAiCharacters(story, chat).map((character) => {
      const personality = effectivePersonalityOf(chat, character);
      return { character, moodLabel: moodLabel(lore, personality).label };
    });
  }

  async function buildSceneNoteFor({ story, chat, speaker, turns, shortIds, recalled }) {
    const scanText = sceneText(chat.scene) + "\n" + recentText(turns);
    const worldFacts = selectWorldState(story, scanText);
    const memoryLines = await chooseMemoryLines({
      speaker,
      turns,
      scene: chat.scene,
      worldFacts,
      shortIds,
    });
    const characterSheet = buildCharacterSheet({
      lore,
      character: neutralizedForPrompt(speaker),
      personality: effectivePersonalityOf(chat, speaker),
      memoryLines,
    });
    return buildSceneNote({
      scene: chat.scene,
      presentCharacters: describePresentCharacters(story, chat),
      playerName: playerCharacterOf(story)?.name ?? "",
      worldFacts,
      worldNotes: selectWorldNotes(story, scanText),
      characterSheet,
      speakerName: neutralizePromptText(speaker.name),
      recall: recalled,
    });
  }

  // `messages` are the transcript entries before the reply. `shortIds` collects the short ids
  // given to memories this turn. `recalled` is a recall result to include, or null.
  // Without a speaker (nobody present) the request has no scene note.
  async function build({
    story,
    chat,
    speaker,
    messages,
    historyWindow,
    shortIds = {},
    recalled = null,
    draft = "",
  }) {
    const promptStory = neutralizedForPrompt(story);
    const promptMessages = neutralizedForPrompt(messages);
    const system = buildSystemPrefix(promptStory);
    const turns = workingMemory(
      promptStory,
      promptMessages,
      historyWindow,
      neutralizePromptText(draft),
    );
    if (!speaker) {
      return { system, messages: turns, sceneNote: "", cache: true };
    }
    // The scene snapshot was written by the model; the rest of the chat is engine state.
    const promptChat = { ...chat, scene: neutralizedForPrompt(chat.scene) };
    const sceneNote = await buildSceneNoteFor({
      story: promptStory,
      chat: promptChat,
      speaker,
      turns,
      shortIds,
      recalled,
    });
    return { system, messages: withSceneNote(turns, sceneNote), sceneNote, cache: true };
  }

  return { build, recall };
}
