// Reads a newline-delimited JSON (NDJSON) response body, calling onEvent for each event as it arrives.

const LINE_BREAK = "\n";

export async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffered += decoder.decode(value, { stream: true });
    buffered = emitCompleteLines(buffered, onEvent);
  }

  const remaining = buffered.trim();
  if (remaining) {
    onEvent(JSON.parse(remaining));
  }
}

// Emits every complete line in the buffer and returns the unfinished remainder.
function emitCompleteLines(buffered, onEvent) {
  let remainder = buffered;
  let lineBreakIndex = remainder.indexOf(LINE_BREAK);
  while (lineBreakIndex >= 0) {
    const line = remainder.slice(0, lineBreakIndex).trim();
    remainder = remainder.slice(lineBreakIndex + 1);
    if (line) {
      onEvent(JSON.parse(line));
    }
    lineBreakIndex = remainder.indexOf(LINE_BREAK);
  }
  return remainder;
}
