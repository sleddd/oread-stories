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
    function handleStreamEvent(event, exchange) {
      if (event.type === "chat") {
        const streamingMessageId = event.chat.streaming ? lastAssistantMessageId(event.chat) : null;
        if (streamingMessageId) {
          set({ streamingReply: { messageId: streamingMessageId, text: exchange.text } });
        }
        set({ activeChat: event.chat });
        return;
      }
      if (event.type === "start") {
        exchange.request = event.request;
        exchange.model = `${event.provider} · ${event.model}`;
        return;
      }
      if (event.type === "delta") {
        exchange.text += event.text;
        const streamingReply = get().streamingReply;
        if (streamingReply) {
          set({ streamingReply: { ...streamingReply, text: exchange.text } });
        }
        return;
      }
      if (event.type === "done") {
        exchange.usage = event.usage;
        return;
      }
      if (event.type === "error") {
        get().showToast(event.message, "error");
      }
    }

    // Streams one reply. With content, sends it as a new message first; without, replies to the last turn.
    async function writeReply(content) {
      const chat = get().activeChat;
      if (!chat || get().isReplyStreaming()) {
        return;
      }
      abortController = new AbortController();
      set({ streamingReply: { messageId: null, text: "" } });
      const exchange = { request: null, model: "", text: "", usage: null };
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
        set({ lastExchange: { model: exchange.model, usage: exchange.usage } });
      } catch (error) {
        if (error.name !== "AbortError") {
          get().showError(error);
        }
      } finally {
        await finishReply(chat.id);
      }
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
      get().refreshContext();
    }

    return {
      streamingReply: null,
      lastExchange: null,

      isReplyStreaming: () => get().streamingReply !== null,

      async sendMessage(content) {
        if (get().isReplyStreaming()) {
          return;
        }
        if (!get().activeChat) {
          await get().startNewChat();
        }
        set({ draft: "" });
        await writeReply(content);
      },

      requestReply: () => writeReply(undefined),

      stopReply() {
        abortController?.abort();
      },
    };
  };
}
