// Writes an assistant reply as a stream of events:
//   chat (state before), start, delta…, done | error, chat (saved state).
// Sending a message adds a user turn first; replying again to an assistant turn regenerates it
// as a new alternative version.
import { badRequest, conflict } from "../http/errors.js";
import { profileOf } from "../lore/shift.js";
import { buildContext, conversationTurns } from "./context.js";
import { syncShiftMarker } from "./shiftMarker.js";

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

export function createReplyGenerator({
  lore,
  repository,
  personality,
  settings,
  models,
  describeChat,
  streamingChatIds,
  now,
  newId,
}) {
  function addUserMessage(chat, content) {
    chat.messages.push({ id: newId(), role: "user", content, ts: now() });
    if (chat.title === DEFAULT_CHAT_TITLE) {
      chat.title = titleFromMessage(content);
    }
  }

  function createShiftMarker(summary) {
    return { id: newId(), role: "shift", content: summary, ts: now() };
  }

  function regenerateReply(chat, reply, currentProfile) {
    startNewVersion(reply);
    const before = reply.profileBefore || chat.profile;
    syncShiftMarker({
      lore,
      chat,
      replyIndex: chat.messages.indexOf(reply),
      before,
      current: currentProfile,
      createMarker: createShiftMarker,
    });
    return reply;
  }

  function addEmptyReply(chat, currentProfile) {
    const before = chat.profile;
    const reply = { id: newId(), role: "assistant", content: "", ts: now(), profileBefore: before };
    syncShiftMarker({
      lore,
      chat,
      replyIndex: chat.messages.length,
      before,
      current: currentProfile,
      createMarker: createShiftMarker,
    });
    chat.messages.push(reply);
    return reply;
  }

  // Saves the user turn (if any) and the empty reply slot. Returns the chat and reply id.
  async function prepareReply(chatId, content, currentProfile) {
    let replyId;
    let isRegenerating = false;
    const chat = await repository.updateChat(chatId, (chatToChange) => {
      chatToChange.profile ||= currentProfile;
      if (content !== undefined) {
        addUserMessage(chatToChange, content);
      }
      const turns = conversationTurns(chatToChange.messages);
      const lastTurn = turns[turns.length - 1];
      if (!lastTurn) {
        throw badRequest("There's nothing to reply to yet. Send a message first.");
      }
      let reply;
      if (lastTurn.role === "assistant") {
        isRegenerating = true;
        reply = regenerateReply(chatToChange, lastTurn, currentProfile);
      } else {
        reply = addEmptyReply(chatToChange, currentProfile);
      }
      replyId = reply.id;
    });
    return { chat, replyId, isRegenerating };
  }

  // Streams the model's reply. Returns the text, usage and any error; never throws for
  // provider failures, so the outcome can always be saved.
  async function* streamModelReply(context, replyId, signal) {
    let text = "";
    let usage = null;
    let error = null;
    try {
      const run = await models.stream({
        system: context.system,
        messages: context.messages,
        signal,
      });
      yield {
        type: "start",
        messageId: replyId,
        provider: run.provider,
        model: run.model,
        request: { system: context.system, messages: context.messages },
      };
      for await (const event of run.events) {
        if (event.text) {
          text += event.text;
          yield { type: "delta", text: event.text };
        }
        if (event.usage) {
          usage = event.usage;
        }
      }
      if (!text.trim()) {
        error = emptyReplyError(usage);
      }
    } catch (caughtError) {
      if (signal?.aborted) {
        error = STOPPED_MESSAGE;
      } else {
        error = caughtError.message;
      }
    }
    return { text, usage, error };
  }

  function saveOutcome(chatId, replyId, outcome, currentProfile, isRegenerating) {
    const { text, error } = outcome;
    return repository.updateChat(chatId, (chat) => {
      const replyIndex = chat.messages.findIndex((message) => message.id === replyId);
      if (replyIndex < 0) {
        return;
      }
      const reply = chat.messages[replyIndex];
      reply.content = text;
      if (reply.alts) {
        reply.alts[reply.alt] = text;
      }
      if (shouldKeepError(error, text)) {
        reply.error = error;
      } else {
        delete reply.error;
      }
      // The personality the reply was written with becomes the chat's baseline.
      if (text) {
        chat.profile = currentProfile;
      }
      // A brand-new reply stopped before any text arrived leaves no trace.
      if (!text && error === STOPPED_MESSAGE && !isRegenerating) {
        chat.messages.splice(replyIndex, 1);
      }
    });
  }

  function finishEvent(outcome) {
    if (outcome.error && outcome.error !== STOPPED_MESSAGE) {
      return { type: "error", message: outcome.error };
    }
    return { type: "done", usage: outcome.usage };
  }

  return async function* generateReply(chatId, { content, signal }) {
    if (streamingChatIds.has(chatId)) {
      throw conflict("A reply is already being written in this chat.");
    }
    streamingChatIds.add(chatId);
    let currentPersonality;
    let currentProfile;
    let savedSettings;
    let prepared;
    try {
      currentPersonality = await personality.get();
      currentProfile = profileOf(currentPersonality);
      savedSettings = await settings.load();
      prepared = await prepareReply(chatId, content, currentProfile);
    } catch (error) {
      streamingChatIds.delete(chatId);
      throw error;
    }
    const { replyId, isRegenerating } = prepared;

    let outcome;
    try {
      yield { type: "chat", chat: await describeChat(prepared.chat) };
      const replyIndex = prepared.chat.messages.findIndex((message) => message.id === replyId);
      const earlierMessages = prepared.chat.messages.slice(0, replyIndex);
      const context = buildContext(lore, currentPersonality, earlierMessages, {
        historyWindow: savedSettings.memory.historyWindow,
      });
      outcome = yield* streamModelReply(context, replyId, signal);
    } finally {
      streamingChatIds.delete(chatId);
    }

    const savedChat = await saveOutcome(chatId, replyId, outcome, currentProfile, isRegenerating);
    yield finishEvent(outcome);
    yield { type: "chat", chat: await describeChat(savedChat) };
  };
}
