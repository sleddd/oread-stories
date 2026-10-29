// Writing replies: sending a message or asking for a (new) reply, following the streamed events,
// stopping a reply, and logging each full exchange to the console for review.

const STOPPED_REPLY_SETTLE_MILLISECONDS = 300;

function lastAssistantMessageId(chat) {
  const lastMessage = chat.messages[chat.messages.length - 1];
  if (lastMessage?.role === "assistant") {
    return lastMessage.id;
  }
  return null;
}

function logExchange(platform, exchange) {
  if (!exchange.request) {
    return;
  }
  const usage = exchange.usage ?? {};
  const transcript = exchange.request.messages
    .map((message) => `[${message.role}]\n${message.content}`)
    .join("\n\n");
  const stopNote = usage.stop ? `, stop: ${usage.stop}` : "";
  const header = `── Oread reply · ${exchange.model} · ${new Date().toLocaleTimeString()} ──`;
  const body =
    `\n\n===== SYSTEM =====\n${exchange.request.system}` +
    `\n\n===== MESSAGES (${exchange.request.messages.length}) =====\n${transcript}` +
    `\n\n===== REPLY =====\n${exchange.text}` +
    `\n\n(tokens in: ${usage.input ?? "?"}, out: ${usage.output ?? "?"}${stopNote})`;
  platform.logToConsole(`%c${header}`, "color:#b8741a;font-weight:bold", body);
}

const waitFor = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createReplySlice({ api, platform }) {
  let abortController = null;

  return (set, get) => {
    function updateStreamingReply(changes) {
      const streamingReply = get().streamingReply;
      if (streamingReply) {
        set({ streamingReply: { ...streamingReply, ...changes } });
      }
    }

    // One handler per event type in the reply stream.
    const streamEventHandlers = {
      chat(event, exchange) {
        const streamingMessageId = event.chat.streaming ? lastAssistantMessageId(event.chat) : null;
        if (streamingMessageId) {
          updateStreamingReply({ messageId: streamingMessageId, text: exchange.text });
        }
        set({ activeChat: event.chat });
      },
      // The story engine is reading the scene before the reply is written.
      appraising() {
        updateStreamingReply({ phase: "appraising" });
      },
      // The scene moved the cast: show the new engine state straight away, and the new dials if
      // the selected character is one of those moved.
      engine(event) {
        const characters = event.characters ?? [];
        const selected = characters.find((character) => {
          return character.characterId === get().selectedCharacterId;
        });
        if (selected?.personality) {
          set({
            personality: selected.personality.personality,
            derived: selected.personality.derived,
          });
        }
        const chat = get().activeChat;
        if (chat) {
          const engines = { ...(chat.engines ?? {}) };
          for (const character of characters) {
            engines[character.characterId] = character.engine;
          }
          set({ activeChat: { ...chat, engine: event.engine, engines } });
        }
      },
      engine_skipped(event) {
        get().showToast(event.message);
      },
      // Who is answering. It can change once if the model picks someone else.
      speaker(event) {
        updateStreamingReply({ speakerId: event.characterId });
      },
      // The speaker is looking deeper into their memory before answering.
      recall() {
        updateStreamingReply({ phase: "recalling", text: "" });
      },
      // The reply's hidden notes, applied after it was written: kept for "what changed".
      updates(event, exchange) {
        exchange.turnChanges.updates = event.changes;
      },
      memory(event, exchange) {
        exchange.turnChanges.memory = event.changes;
      },
      world(event, exchange) {
        exchange.turnChanges.worldState = event.changes;
      },
      // The reply was written but its hidden notes couldn't be read; the story goes on.
      notes_skipped(event) {
        get().showToast(event.message);
      },
      story(event) {
        if (event.story?.id === get().activeStoryId) {
          set({ activeStory: event.story });
        }
      },
      // Once per provider call. A switch of speaker or a recall starts the reply again, so the
      // text streamed so far is dropped.
      start(event, exchange) {
        exchange.request = event.request;
        exchange.model = `${event.provider} · ${event.model}`;
        exchange.text = "";
        updateStreamingReply({ phase: "writing", text: "" });
      },
      delta(event, exchange) {
        exchange.text += event.text;
        updateStreamingReply({ text: exchange.text });
      },
      done(event, exchange) {
        exchange.usage = event.usage;
      },
      error(event) {
        get().showToast(event.message, "error");
      },
    };

    function handleStreamEvent(event, exchange) {
      const handler = streamEventHandlers[event.type];
      if (handler) {
        handler(event, exchange);
      }
    }

    // Streams one reply. With content, sends it as a new message first; without, replies to the last turn.
    async function writeReply(content) {
      const chat = get().activeChat;
      if (!chat || get().isReplyStreaming()) {
        return;
      }
      abortController = new AbortController();
      set({ streamingReply: { messageId: null, text: "", phase: "writing" } });
      const exchange = { request: null, model: "", text: "", usage: null, turnChanges: {} };
      const options = {
        signal: abortController.signal,
        onEvent: (event) => handleStreamEvent(event, exchange),
      };
      try {
        if (content === undefined) {
          await api.requestReply(chat.id, options);
        } else {
          await api.sendMessage(chat.id, content, options);
        }
        logExchange(platform, exchange);
        rememberTurnChanges(exchange.turnChanges);
        set({ lastExchange: { model: exchange.model, usage: exchange.usage } });
      } catch (error) {
        if (error.name !== "AbortError") {
          get().showError(error);
        }
      } finally {
        await finishReply(chat.id);
      }
    }

    function rememberTurnChanges(turnChanges) {
      const messageId = get().activeChat ? lastAssistantMessageId(get().activeChat) : null;
      if (!messageId || Object.keys(turnChanges).length === 0) {
        return;
      }
      set({
        turnChangesByMessageId: { ...get().turnChangesByMessageId, [messageId]: turnChanges },
      });
    }

    // A turn can change the cast's skills, memories and dials, so reload what is on screen.
    async function refreshStoryAfterTurn() {
      await Promise.all([
        get().refreshActiveStory(),
        get().loadMemory(),
        get().loadSelectedPersonality(),
      ]);
    }

    async function finishReply(chatId) {
      const wasStopped = abortController?.signal.aborted ?? false;
      abortController = null;
      set({ streamingReply: null });
      // A stopped stream ends before the server's final state arrives, so fetch it once it has settled.
      if (wasStopped) {
        await waitFor(STOPPED_REPLY_SETTLE_MILLISECONDS);
      }
      try {
        set({ activeChat: await api.getChat(chatId) });
      } catch {
        // Keep what we have; the next action refreshes it.
      }
      await get().loadChats();
      await refreshStoryAfterTurn();
      get().refreshContext();
    }

    return {
      streamingReply: null,
      lastExchange: null,
      // Changes reported by the stream, for replies whose chat has no turn log entry yet.
      turnChangesByMessageId: {},

      isReplyStreaming: () => get().streamingReply !== null,

      async sendMessage(content) {
        if (get().isReplyStreaming()) {
          return;
        }
        if (!get().activeChat) {
          await get().startNewChat();
        }
        // Waits only when scene edits are waiting, so otherwise the reply streams at once.
        if (get().hasPendingSceneChanges() && !(await get().applyPendingSceneChanges())) {
          return;
        }
        set({ draft: "" });
        await writeReply(content);
      },

      async requestReply() {
        if (get().isReplyStreaming()) {
          return;
        }
        // Waits only when scene edits are waiting, so otherwise the reply streams at once.
        if (get().hasPendingSceneChanges() && !(await get().applyPendingSceneChanges())) {
          return;
        }
        await writeReply(undefined);
      },

      stopReply() {
        abortController?.abort();
      },
    };
  };
}
