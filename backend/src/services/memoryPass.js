// The memory pass: for Featherless chats, the turn's hidden notes are written before the reply,
// by a model chosen to keep records (memoryModelChoice.js), so the roleplay model only tells the
// story and its reply already reads the new memories. The pass records what happened since the
// last record: the character's previous reply, if there is one, and the newest message. A reply
// is recorded at the start of the next turn, alongside the message that answers it.
import { notesSystemPrompt } from "./missingNotes.js";
import { replyInstruction } from "../prompt/sceneNote.js";

// Roomier than the plain notes request: a memory model that thinks before answering spends
// tokens on that first, and must still reach the notes. The request ends as soon as the memory
// note closes, so the room is only used when needed.
const MEMORY_PASS_MAX_TOKENS = 3_000;

const MEMORY_PASS_CLOSING =
  "Write the three notes for what has just happened: <<updates>>, <<world>> and <<memory>>, " +
  "each on its own line holding JSON. The characters haven't answered the newest message yet, " +
  "so record only what has happened, never a reply. Nothing before the notes and nothing after.";

// previousReply: { speakerName, text } or null, the character reply before the newest message.
// `sceneNote` is the one the reply will be written with; its last line asks for that reply, so
// it is left out here.
export function buildMemoryPassRequest({
  playerName,
  sceneNote,
  speakerName,
  previousReply,
  newestMessage,
}) {
  const sections = [sceneNote.replace(replyInstruction(speakerName), "").trimEnd()];
  if (previousReply) {
    sections.push(`${previousReply.speakerName}'s last reply:\n${previousReply.text}`);
  }
  sections.push(`The newest message:\n${newestMessage}`, MEMORY_PASS_CLOSING);
  return {
    system: notesSystemPrompt(playerName),
    messages: [{ role: "user", content: sections.join("\n\n") }],
    maxTokens: MEMORY_PASS_MAX_TOKENS,
  };
}

// The character reply just before the newest user message in `messages` (the transcript before
// the reply being written), as { speakerName, text }, or null when there's none.
export function previousReplyIn(story, messages) {
  let index = messages.length - 1;
  while (index >= 0 && messages[index].role !== "user") {
    index -= 1;
  }
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const message = messages[earlier];
    if (message.role === "user") {
      return null;
    }
    if (message.role === "assistant" && message.content) {
      const speaker = story.characters.find((character) => character.id === message.speakerId);
      return { speakerName: speaker?.name ?? "", text: message.content };
    }
  }
  return null;
}
