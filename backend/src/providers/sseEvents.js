// Parser for text/event-stream bodies (Anthropic, OpenAI, Gemini). Yields {event, data}.
const EVENT_SEPARATOR = /\r?\n\r?\n/;
const LINE_SEPARATOR = /\r?\n/;
const EVENT_FIELD = "event:";
const DATA_FIELD = "data:";

function parseEventBlock(block) {
  let eventName = "message";
  const dataLines = [];
  for (const line of block.split(LINE_SEPARATOR)) {
    if (line.startsWith(EVENT_FIELD)) {
      eventName = line.slice(EVENT_FIELD.length).trim();
    } else if (line.startsWith(DATA_FIELD)) {
      dataLines.push(line.slice(DATA_FIELD.length).replace(/^ /, ""));
    }
  }
  if (!dataLines.length) {
    return null;
  }
  return { event: eventName, data: dataLines.join("\n") };
}

export async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    let separator = EVENT_SEPARATOR.exec(buffered);
    while (separator) {
      const block = buffered.slice(0, separator.index);
      buffered = buffered.slice(separator.index + separator[0].length);
      const event = parseEventBlock(block);
      if (event) {
        yield event;
      }
      separator = EVENT_SEPARATOR.exec(buffered);
    }
  }
}
