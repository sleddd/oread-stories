// Writes an assistant reply as a stream of events. Sending a message adds a user turn first;
// replying again to an assistant turn regenerates it as a new alternative version.
//
// A turn, in order:
//   1. Guess the speaker (stories/predictSpeaker.js).
//   2. With the story engine on, a new scene is appraised once by the local model and played for
//      every AI character present:  chat, appraising, engine | engine_skipped
//   3. Build the request (cached prefix, working memory, scene note with the speaker's sheet) and
//      stream it:  chat, start, speaker, delta…
//      The hidden header and notes never reach the deltas. If the header names a different AI
//      character, or asks to recall something, the call is cancelled before any text is shown
//      and made again (at most once for each, so at most two extra calls):  start, recall?, …
//   4. Save the reply with its speaker:  done | error
//   5. Act on the hidden notes:  updates?, memory?, world?, story?, then the saved chat.
// Regenerating replays the same scene: it doesn't appraise again, and it undoes the old version's
// notes before applying the new ones.
import { badRequest, conflict } from "../http/errors.js";
import { profileOf } from "../lore/shift.js";
import { conversationTurns } from "./context.js";
import { syncShiftMarker } from "./shiftMarker.js";
import { predictSpeaker, presentAiCharacters } from "../stories/predictSpeaker.js";
import { personalityOfCharacter } from "../stories/characterPersonality.js";
import { profileFor, setProfile } from "../stories/chatProfiles.js";
import { sameName } from "../stories/noteValues.js";
import { primaryCharacterOf } from "./characterRecords.js";
import { createHeaderFilter } from "../stream/headerFilter.js";
import { createHiddenNotesFilter } from "../stream/hiddenNotesFilter.js";
import { cleanVisibleText } from "../stream/hiddenNotes.js";

const DEFAULT_CHAT_TITLE = "New chat";
const AUTO_TITLE_LENGTH = 48;
const STOPPED_MESSAGE = "Stopped.";

// A chat still called "New chat" is named after its first message.
function titleFromMessage(content) {
  const title = content.replace(/\s+/g, " ").slice(0, AUTO_TITLE_LENGTH);
  if (content.length > AUTO_TITLE_LENGTH) {
    return title + "…";
  }
  return title;
}

// Shown when a reply reached the length limit before its hidden notes were finished.
export const CUT_OFF_NOTES_MESSAGE =
  "The reply hit the length limit, so some hidden notes were lost. Raise Max reply tokens in " +
  "Settings.";

function emptyReplyError(usage) {
  let stopReason = "";
  if (usage?.stop) {
    stopReason = ` (stop reason: ${usage.stop})`;
  }
  return `The model returned an empty reply${stopReason}.`;
}

// Turns the existing reply into a new, empty alternative version.
function startNewVersion(reply) {
  if (!reply.alts) {
    reply.alts = [reply.content];
    reply.alt = 0;
  }
  reply.alts.push("");
  reply.alt = reply.alts.length - 1;
  reply.content = "";
  delete reply.error;
}

// An error is kept on the reply unless the user stopped it after some text arrived.
function shouldKeepError(error, text) {
  if (!error) {
    return false;
  }
  return !(error === STOPPED_MESSAGE && text);
}

function lastTurnOf(chat) {
  const turns = conversationTurns(chat.messages);
  return turns[turns.length - 1];
}

function noOneToReply() {
  return badRequest("No AI character is in this scene. Add one to the chat first.");
}

// The AI character present whom a [[speaker: …]] header names, or null.
function namedSpeaker(story, chat, name) {
  if (!name) {
    return null;
  }
  const present = presentAiCharacters(story, chat);
  return present.find((character) => sameName(character.name, name)) ?? null;
}

// Whether a header marker means the call should stop and be made again.
// Returns { kind: "switch", speaker } | { kind: "recall", query } | null.
function interruptionFor(markers, { story, chat, speaker, canSwitch, canRecall }) {
  for (const marker of markers) {
    if (marker.kind === "speaker" && canSwitch) {
      const named = namedSpeaker(story, chat, marker.value);
      if (named && named.id !== speaker.id) {
        return { kind: "switch", speaker: named };
      }
    }
    if (marker.kind === "recall" && canRecall && marker.value) {
      return { kind: "recall", query: marker.value };
    }
  }
  return null;
}

// Replies have a turn number: their position among the conversation's turns, from 1.
function turnNumberOf(chat, replyId) {
  const turns = conversationTurns(chat.messages);
  return turns.findIndex((message) => message.id === replyId) + 1;
}

export function createReplyGenerator({
  lore,
  repository,
  storyRepository,
  settings,
  models,
  storyEngine,
  turnPrompt,
  turnNotes,
  describeChat,
  streamingGuard,
  now,
  newId,
}) {
  function addUserMessage(chat, content) {
    chat.messages.push({ id: newId(), role: "user", content, ts: now() });
    if (chat.title === DEFAULT_CHAT_TITLE) {
      chat.title = titleFromMessage(content);
    }
  }

  // Saves the user turn (if any) and the empty reply slot. Returns the chat and reply id.
  async function prepareReply(chatId, content) {
    let replyId;
    let isRegenerating = false;
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      if (content !== undefined) {
        addUserMessage(chatToChange, content);
      }
      const lastTurn = lastTurnOf(chatToChange);
      if (!lastTurn) {
        throw badRequest("There's nothing to reply to yet. Send a message first.");
      }
      if (lastTurn.role === "assistant") {
        isRegenerating = true;
        startNewVersion(lastTurn);
        replyId = lastTurn.id;
        return;
      }
      const reply = { id: newId(), role: "assistant", content: "", ts: now() };
      chatToChange.messages.push(reply);
      replyId = reply.id;
    });
    return { chat, replyId, isRegenerating };
  }

  // The newest event of a new scene: the message being sent, or the unanswered user message a
  // reply was asked for. Null when the reply would regenerate an existing one.
  function newSceneEvent(chat, content) {
    if (content !== undefined) {
      return content;
    }
    const lastTurn = lastTurnOf(chat);
    if (lastTurn?.role === "user") {
      return lastTurn.content;
    }
    return null;
  }

  // The newest user message, for guessing who answers it.
  function newestUserMessage(chat, content) {
    if (content !== undefined) {
      return content;
    }
    const userTurns = conversationTurns(chat.messages).filter((turn) => turn.role === "user");
    return userTurns[userTurns.length - 1]?.content ?? "";
  }

  // Saves the user turn on its own, so it shows while the scene is being appraised.
  async function saveUserTurn(chatId, content) {
    return repository.updateChat(chatId, (chat) => {
      addUserMessage(chat, content);
    });
  }

  // The engine event keeps the single-character interface working: `personality` is the story's
  // primary character when it was played (that is who /personality stands for), `engine` is the
  // expected speaker's. `characters` has every character played.
  function engineEvent(story, played, speakerId) {
    const primary = primaryCharacterOf(story);
    const shown = played.find((result) => result.characterId === primary?.id) ?? played[0];
    const speakerResult = played.find((result) => result.characterId === speakerId) ?? shown;
    const characters = played.map(({ characterId, name, engine, personalityView }) => {
      return { characterId, name, engine, personality: personalityView };
    });
    return {
      type: "engine",
      engine: speakerResult.engine,
      personality: shown.personalityView,
      characters,
    };
  }

  // Runs the story engine on the scene. Yields its events.
  async function* playScene({ chatId, eventText, story, speakerId }) {
    yield { type: "appraising" };
    try {
      const played = await storyEngine.playScene({ chatId, eventText });
      if (played.length > 0) {
        yield engineEvent(story, played, speakerId);
      }
    } catch (error) {
      const message = `The story engine skipped this scene: ${error.message}`;
      yield { type: "engine_skipped", message };
    }
  }

  async function shouldPlayScene(sceneEvent) {
    if (sceneEvent === null || !storyEngine) {
      return false;
    }
    return storyEngine.isEnabled();
  }

  function errorMessageOf(caughtError, signal) {
    if (signal?.aborted) {
      return STOPPED_MESSAGE;
    }
    return caughtError.message;
  }

  // Streams one call to the model. Returns { kind: "switch" | "recall", … } when the header asks
  // for the call to be made again, or { kind: "finished", text, hiddenText, usage, error,
  // speakerId } when it ran to the end. Never throws for provider failures.
  async function* streamAttempt({ request, replyId, signal, turnState, story, chat }) {
    const attemptController = new AbortController();
    const stopAttempt = () => attemptController.abort();
    signal?.addEventListener("abort", stopAttempt, { once: true });
    const headerFilter = createHeaderFilter();
    const notesFilter = createHiddenNotesFilter();
    let text = "";
    let usage = null;
    let error = null;
    let finalSpeaker = turnState.speaker;
    let isSpeakerAnnounced = false;

    function* announceSpeaker() {
      if (isSpeakerAnnounced) {
        return;
      }
      isSpeakerAnnounced = true;
      finalSpeaker = namedSpeaker(story, chat, headerFilter.header().speaker) ?? turnState.speaker;
      yield {
        type: "speaker",
        characterId: finalSpeaker.id,
        name: finalSpeaker.name,
        switched: turnState.hasSwitched,
      };
    }

    function* showText(visibleChunk) {
      const visibleText = notesFilter.push(visibleChunk);
      if (visibleText) {
        text += visibleText;
        yield { type: "delta", text: visibleText };
      }
    }

    try {
      const run = await models.stream({ ...request, signal: attemptController.signal });
      yield {
        type: "start",
        messageId: replyId,
        provider: run.provider,
        model: run.model,
        request: { system: request.system, messages: request.messages },
      };
      for await (const event of run.events) {
        if (event.usage) {
          usage = event.usage;
        }
        if (!event.text) {
          continue;
        }
        const headerResult = headerFilter.push(event.text);
        const interruption = interruptionFor(headerResult.markers, {
          story,
          chat,
          speaker: turnState.speaker,
          canSwitch: !turnState.hasSwitched,
          canRecall: !turnState.hasRecalled,
        });
        if (interruption) {
          attemptController.abort();
          return interruption;
        }
        if (headerResult.isSettled) {
          yield* announceSpeaker();
          yield* showText(headerResult.text);
        }
      }
      yield* announceSpeaker();
      yield* showText(headerFilter.finish());
      const notesTail = notesFilter.finish();
      yield* showText(notesTail.text);
      text = cleanVisibleText(text);
      if (!text.trim()) {
        error = emptyReplyError(usage);
      }
      return {
        kind: "finished",
        text,
        hiddenText: notesTail.hiddenText,
        usage,
        error,
        speakerId: finalSpeaker.id,
      };
    } catch (caughtError) {
      error = errorMessageOf(caughtError, signal);
      return { kind: "finished", text, hiddenText: "", usage, error, speakerId: finalSpeaker.id };
    } finally {
      signal?.removeEventListener("abort", stopAttempt);
    }
  }

  // Calls the model until the reply is written, switching speaker or recalling at most once each.
  async function* writeReply({ story, chat, speaker, replyId, historyWindow, signal }) {
    const replyIndex = chat.messages.findIndex((message) => message.id === replyId);
    const messages = chat.messages.slice(0, replyIndex);
    const turnState = { speaker, hasSwitched: false, hasRecalled: false, recalled: null };
    const shortIds = {};
    while (true) {
      const request = await turnPrompt.build({
        story,
        chat,
        speaker: turnState.speaker,
        messages,
        historyWindow,
        shortIds,
        recalled: turnState.recalled,
      });
      const result = yield* streamAttempt({ request, replyId, signal, turnState, story, chat });
      if (result.kind === "switch") {
        turnState.hasSwitched = true;
        turnState.speaker = result.speaker;
        turnState.recalled = null;
        continue;
      }
      if (result.kind === "recall") {
        turnState.hasRecalled = true;
        turnState.recalled = await turnPrompt.recall({
          speaker: turnState.speaker,
          query: result.query,
          shortIds,
        });
        yield {
          type: "recall",
          characterId: turnState.speaker.id,
          name: turnState.speaker.name,
          query: result.query,
          found: turnState.recalled.memoryLines.length,
        };
        continue;
      }
      return { ...result, shortIds };
    }
  }

  // Inserts or updates the shift marker for how the speaker's dials moved since they last
  // replied in this chat, then remembers the profile they replied with.
  function recordShift({ story, chat, reply, replyIndex, speaker, isRegenerating }) {
    const currentProfile = profileOf(personalityOfCharacter(lore, speaker));
    let before = profileFor(chat, speaker.id) ?? currentProfile;
    if (isRegenerating && reply.speakerId === speaker.id && reply.profileBefore) {
      before = reply.profileBefore;
    }
    const aiCharacters = story.characters.filter((character) => character.role === "ai");
    const showName = aiCharacters.length > 1;
    syncShiftMarker({
      lore,
      chat,
      replyIndex,
      before,
      current: currentProfile,
      createMarker: (summary) => ({
        id: newId(),
        role: "shift",
        content: showName ? `${speaker.name}: ${summary}` : summary,
        ts: now(),
      }),
    });
    reply.profileBefore = before;
    setProfile(chat, speaker.id, currentProfile);
  }

  // Saves the reply text, its speaker and any error. Returns { chat, turn }.
  async function saveOutcome({ chatId, replyId, outcome, isRegenerating, story }) {
    const { text, error } = outcome;
    const speaker = story.characters.find((character) => character.id === outcome.speakerId);
    let turn = 0;
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      const replyIndex = chatToChange.messages.findIndex((message) => message.id === replyId);
      if (replyIndex < 0) {
        return;
      }
      const reply = chatToChange.messages[replyIndex];
      reply.content = text;
      if (reply.alts) {
        reply.alts[reply.alt] = text;
      }
      if (shouldKeepError(error, text)) {
        reply.error = error;
      } else {
        delete reply.error;
      }
      if (text && speaker) {
        recordShift({ story, chat: chatToChange, reply, replyIndex, speaker, isRegenerating });
        reply.speakerId = speaker.id;
        chatToChange.lastSpeakerId = speaker.id;
        turn = turnNumberOf(chatToChange, replyId);
      }
      // A brand-new reply stopped before any text arrived leaves no trace.
      if (!text && error === STOPPED_MESSAGE && !isRegenerating) {
        chatToChange.messages.splice(replyIndex, 1);
      }
    });
    return { chat, turn };
  }

  function finishEvent(outcome) {
    if (outcome.error && outcome.error !== STOPPED_MESSAGE) {
      return { type: "error", message: outcome.error };
    }
    return { type: "done", usage: outcome.usage };
  }

  // Acts on the hidden notes of a finished reply and yields what changed.
  async function* actOnNotes({ chatId, replyId, outcome, turn }) {
    let applied;
    try {
      applied = await turnNotes.apply({
        chatId,
        hiddenText: outcome.hiddenText,
        turn: {
          replyId,
          turn,
          speakerId: outcome.speakerId,
          shortIds: outcome.shortIds,
          stop: outcome.usage?.stop,
        },
      });
    } catch (error) {
      yield { type: "notes_skipped", message: `This turn's notes weren't saved: ${error.message}` };
      return;
    }
    if (applied.isCutOff) {
      yield { type: "notes_skipped", message: CUT_OFF_NOTES_MESSAGE };
    }
    const hasWorldChange = applied.world.isSceneReplaced || applied.world.changes.length > 0;
    if (applied.updates.length > 0) {
      yield { type: "updates", changes: applied.updates };
    }
    if (applied.memory.length > 0) {
      yield { type: "memory", changes: applied.memory };
    }
    if (hasWorldChange) {
      yield { type: "world", ...applied.world };
    }
    if (applied.updates.length > 0 || applied.memory.length > 0 || hasWorldChange) {
      yield { type: "story", story: applied.story };
    }
  }

  // Loads everything a turn starts from; throws (before anything is saved) if it can't run.
  async function startTurn(chatId, content) {
    const chat = await repository.findChat(chatId);
    const story = await storyRepository.findStory(chat.storyId);
    const predicted = predictSpeaker({
      story,
      chat,
      newestMessage: newestUserMessage(chat, content),
    });
    if (!predicted) {
      throw noOneToReply();
    }
    const savedSettings = await settings.load();
    const sceneEvent = newSceneEvent(chat, content);
    const playsScene = await shouldPlayScene(sceneEvent);
    return { story, predicted, savedSettings, sceneEvent, playsScene };
  }

  return async function* generateReply(chatId, { content, signal }) {
    if (!(await streamingGuard.claim(chatId))) {
      throw conflict("A reply is already being written in this chat.");
    }
    let start;
    try {
      start = await startTurn(chatId, content);
    } catch (error) {
      await streamingGuard.release(chatId);
      throw error;
    }

    let prepared;
    let outcome;
    let story = start.story;
    try {
      let contentStillToAdd = content;
      if (start.playsScene) {
        if (content !== undefined) {
          yield { type: "chat", chat: await describeChat(await saveUserTurn(chatId, content)) };
          contentStillToAdd = undefined;
        }
        yield* playScene({
          chatId,
          eventText: start.sceneEvent,
          story,
          speakerId: start.predicted.id,
        });
        story = await storyRepository.findStory(story.id);
      }
      prepared = await prepareReply(chatId, contentStillToAdd);
      yield { type: "chat", chat: await describeChat(prepared.chat) };
      const speaker = story.characters.find((character) => character.id === start.predicted.id);
      outcome = yield* writeReply({
        story,
        chat: prepared.chat,
        speaker,
        replyId: prepared.replyId,
        historyWindow: start.savedSettings.memory.historyWindow,
        signal,
      });
    } finally {
      await streamingGuard.release(chatId);
    }
    const { replyId, isRegenerating } = prepared;

    const saved = await saveOutcome({ chatId, replyId, outcome, isRegenerating, story });
    yield finishEvent(outcome);
    let finalChat = saved.chat;
    if (outcome.text && !outcome.error) {
      yield* actOnNotes({ chatId, replyId, outcome, turn: saved.turn });
      finalChat = await repository.findChat(chatId);
    }
    yield { type: "chat", chat: await describeChat(finalChat) };
  };
}
