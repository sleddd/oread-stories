// Some models, roleplay-tuned ones especially, end their turn as soon as the reply is written
// and never get to the three hidden notes, so nothing would be remembered and the scene would
// never move on. When a finished reply has none of its notes, this asks the same model for the
// notes alone, in a short request of their own: the same scene note (with the memories and their
// short ids), the newest message, and the reply just written. That is a narrow, clear task even
// a model that ignored the notes before can do.
import { readHiddenNotes } from "../stream/hiddenNotes.js";
import { notesProtocol } from "../prompt/outputProtocol.js";
import { replyInstruction } from "../prompt/sceneNote.js";

// The notes are short; this leaves room for a long memory note without inviting a story.
export const NOTES_MAX_TOKENS = 700;
// The memory note is the last of the three: once it closes, nothing more is wanted, so the
// request is ended there rather than paying for (and waiting on) whatever the model writes next.
const LAST_NOTE_CLOSING_TAG = "<</memory>>";
const ANY_NOTE_TAG = "<<";
// This much text without a single note tag means the model is writing story instead.
const STORY_DRIFT_CHARACTERS = 400;
const STOPPED_AT_LAST_NOTE = "stop";
const LENGTH_STOP_PATTERN = /length|max_tokens/i;

// Why a notes request came back without notes, said so a person can act on it.
export const NOTES_FAILURES = {
  wroteStory: "wrote story instead of notes",
  ranOutOfRoom: "ran out of room before writing the notes",
  noNotes: "brought back no notes",
};

const NOTES_SYSTEM_INTRODUCTION =
  "You keep the records of an ongoing roleplay. You never write story text, never continue " +
  "the scene, and never speak as a character. You read what just happened and write the " +
  "hidden notes for it, exactly as described below, and nothing else.";

const NOTES_REQUEST_CLOSING =
  "Write the three notes for this turn now: <<updates>>, <<world>> and <<memory>>, each on its " +
  "own line holding JSON. Nothing before them and nothing after.";

// The notes request's opening: shared with the memory pass (services/memoryPass.js).
export function notesSystemPrompt(playerName) {
  return [NOTES_SYSTEM_INTRODUCTION, notesProtocol(playerName)].join("\n\n");
}

// Node's fetch reports a connection that never answered as "fetch failed", with the reason
// (ECONNRESET, a timeout, …) on `cause`.
function isConnectionFailure(error) {
  return error instanceof TypeError && Boolean(error.cause);
}

function describeError(error) {
  const cause = error?.cause;
  if (!cause) {
    return error?.message ?? String(error);
  }
  const reason = [cause.code, cause.message].filter(Boolean).join(" ");
  return `${error.message}: ${reason}`;
}

export function hasAnyNote(hiddenText) {
  const notes = readHiddenNotes(hiddenText);
  return Object.values(notes).some((note) => note !== null);
}

// `sceneNote` and `newestMessage` are as they were sent with the reply. The scene note's last line
// asks for the reply itself, which here is already written: left in, a story-minded model takes
// it at its word and writes another reply instead of the notes.
export function buildNotesRequest({
  playerName,
  sceneNote,
  newestMessage,
  speakerName,
  replyText,
}) {
  const system = notesSystemPrompt(playerName);
  const sceneNoteForNotes = sceneNote.replace(replyInstruction(speakerName), "").trimEnd();
  const content = [
    sceneNoteForNotes,
    `The newest message:\n${newestMessage}`,
    `${speakerName}'s reply, already written:\n${replyText}`,
    NOTES_REQUEST_CLOSING,
  ].join("\n\n");
  return { system, messages: [{ role: "user", content }], maxTokens: NOTES_MAX_TOKENS };
}

// `models` is services/modelService.js.
export function createMissingNotesWriter({ models }) {
  // Reads the notes as they stream, ending the request as soon as the last note closes or the
  // model is plainly writing story. Resolves to { text, stop, failure }. The request is cancelled
  // only after reading stops, and that cancellation is not an error: the notes are already in.
  async function readNotes({ request, target, controller }) {
    const run = await models.stream({ ...request, ...target, signal: controller.signal });
    let text = "";
    let stop = null;
    let endedEarly = null;
    try {
      for await (const event of run.events) {
        if (event.usage) {
          stop = event.usage.stop;
        }
        if (!event.text) {
          continue;
        }
        text += event.text;
        if (text.includes(LAST_NOTE_CLOSING_TAG)) {
          endedEarly = { text, stop: STOPPED_AT_LAST_NOTE };
          break;
        }
        if (text.length > STORY_DRIFT_CHARACTERS && !text.includes(ANY_NOTE_TAG)) {
          endedEarly = { text: "", stop: null, failure: NOTES_FAILURES.wroteStory };
          break;
        }
      }
    } catch (error) {
      if (!endedEarly) {
        throw error;
      }
    } finally {
      controller.abort();
    }
    return endedEarly ?? { text, stop };
  }

  // A dropped connection (no answer from the provider at all) gets one more try with a fresh
  // request; an answer that is an error (a 4xx, say) is not retried.
  async function readNotesRetryingConnection({ request, target, signal, controller }) {
    try {
      return await readNotes({ request, target, controller });
    } catch (error) {
      if (!isConnectionFailure(error) || signal?.aborted) {
        throw error;
      }
      const retryController = new AbortController();
      const stopRetry = () => retryController.abort();
      signal?.addEventListener("abort", stopRetry, { once: true });
      try {
        return await readNotes({ request, target, controller: retryController });
      } finally {
        signal?.removeEventListener("abort", stopRetry);
      }
    }
  }

  function failureOf({ failure, stop }) {
    if (failure) {
      return failure;
    }
    if (LENGTH_STOP_PATTERN.test(String(stop ?? ""))) {
      return NOTES_FAILURES.ranOutOfRoom;
    }
    return NOTES_FAILURES.noNotes;
  }

  // Resolves to { hiddenText, stop, failure }: the notes, or an empty hiddenText and the reason
  // there were none (NOTES_FAILURES, or what the provider said). A turn without notes is never
  // worse than before. Stopping the reply (`signal`) stops this too. `target` ({ provider,
  // model, chatTemplateOptions }) sends it to another model than the chat's.
  async function writeMissingNotes({ request, target = {}, signal }) {
    const controller = new AbortController();
    const stopNotes = () => controller.abort();
    signal?.addEventListener("abort", stopNotes, { once: true });
    try {
      const read = await readNotesRetryingConnection({ request, target, signal, controller });
      if (!hasAnyNote(read.text)) {
        return { hiddenText: "", stop: read.stop, failure: failureOf(read) };
      }
      return { hiddenText: read.text, stop: read.stop, failure: null };
    } catch (error) {
      return { hiddenText: "", stop: null, failure: `failed (${describeError(error)})` };
    } finally {
      signal?.removeEventListener("abort", stopNotes);
    }
  }

  return { writeMissingNotes };
}
