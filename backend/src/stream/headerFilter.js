// Takes the hidden header lines off the start of a streamed reply:
//   [[speaker: Name]]
//   [[recall: what they're trying to remember]]   (optional)
// Text is held back until the header is settled, so the caller can switch speaker or recall
// before anything is shown. Works however the stream is split into chunks.

const MARKER_OPEN = "[[";
const MARKER_CLOSE = "]]";
const MARKER_PATTERN = /^\[\[\s*(speaker|recall)\s*:\s*([\s\S]*?)\s*\]\]/i;
// A header line longer than this isn't a header; the text is shown as written.
const MAX_MARKER_LENGTH = 400;
const MAX_MARKERS = 2;

// Whether `text` could still grow into a marker opening ("[" or "[[").
function couldOpenMarker(text) {
  return MARKER_OPEN.startsWith(text) || text.startsWith(MARKER_OPEN);
}

// Drops spaces and at most one line break after a marker.
function withoutMarkerLineEnd(text) {
  return text.replace(/^[ \t]*\r?\n?/, "");
}

export function createHeaderFilter() {
  let buffer = "";
  let isHeaderSettled = false;
  // The reply never starts with the blank lines that followed the header.
  let hasShownText = false;
  let markerCount = 0;
  const header = { speaker: null, recall: null };

  function showable(text) {
    if (hasShownText) {
      return text;
    }
    const trimmed = text.replace(/^\s+/, "");
    hasShownText = trimmed.length > 0;
    return trimmed;
  }

  function settle() {
    isHeaderSettled = true;
    const text = buffer;
    buffer = "";
    return showable(text);
  }

  // Reads one marker off the front of the buffer. Returns { status, marker }, where status is
  // "wait" (need more text), "read" (marker is { kind, value }) or "none" (no more markers).
  function readMarker() {
    const trimmed = buffer.replace(/^\s+/, "");
    if (!trimmed) {
      return { status: "wait" };
    }
    if (!couldOpenMarker(trimmed)) {
      return { status: "none" };
    }
    if (!trimmed.includes(MARKER_CLOSE)) {
      if (trimmed.length > MAX_MARKER_LENGTH) {
        return { status: "none" };
      }
      return { status: "wait" };
    }
    const match = trimmed.match(MARKER_PATTERN);
    if (!match) {
      return { status: "none" };
    }
    const marker = { kind: match[1].toLowerCase(), value: match[2].trim() };
    header[marker.kind] = marker.value;
    markerCount += 1;
    buffer = withoutMarkerLineEnd(trimmed.slice(match[0].length));
    return { status: "read", marker };
  }

  // Returns { text, markers, isSettled }: text that may now be shown, markers read by this push,
  // and whether the header is complete.
  function push(chunk) {
    if (isHeaderSettled) {
      return { text: showable(chunk), markers: [], isSettled: true };
    }
    buffer += chunk;
    const markers = [];
    while (markerCount < MAX_MARKERS) {
      const result = readMarker();
      if (result.status === "wait") {
        return { text: "", markers, isSettled: false };
      }
      if (result.status === "none") {
        break;
      }
      markers.push(result.marker);
    }
    return { text: settle(), markers, isSettled: true };
  }

  // The stream ended. Anything still held that isn't a marker is reply text.
  function finish() {
    if (isHeaderSettled) {
      return "";
    }
    const held = buffer.replace(/^\s+/, "");
    isHeaderSettled = true;
    buffer = "";
    if (MARKER_PATTERN.test(held) || couldOpenMarker(held)) {
      return "";
    }
    return held;
  }

  return { push, finish, header: () => ({ ...header }) };
}
