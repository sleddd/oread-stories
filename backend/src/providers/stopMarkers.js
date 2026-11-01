// Ends a reply at the model's own end-of-turn markers. Open-weight models are trained on chat
// templates (ChatML's <|im_end|>, Llama 3's <|eot_id|>, …); when a server doesn't treat the
// marker as the end, the model writes straight past it, plays the other person's turn and keeps
// going until the length limit. The markers go to the server as stop sequences, and this filter
// cuts the stream at the first one in case the server lets one through anyway.

export const CHAT_TEMPLATE_STOP_MARKERS = [
  "<|im_end|>",
  "<|im_start|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|start_header_id|>",
  "</s>",
  "<|endoftext|>",
];

// The length of the longest end of `text` that could be the start of a marker.
function partialMarkerLength(text, markers) {
  const longestMarker = Math.max(...markers.map((marker) => marker.length));
  const longestCheck = Math.min(longestMarker - 1, text.length);
  for (let length = longestCheck; length > 0; length--) {
    const ending = text.slice(text.length - length);
    if (markers.some((marker) => marker.startsWith(ending))) {
      return length;
    }
  }
  return 0;
}

function firstMarkerIndex(text, markers) {
  const positions = markers.map((marker) => text.indexOf(marker));
  const found = positions.filter((position) => position >= 0);
  if (found.length === 0) {
    return -1;
  }
  return Math.min(...found);
}

// push(chunk) → { text, hasStopped }: the text that may be shown now, and whether a marker was
// reached (nothing after it is ever shown). finish() → the text held back at the very end.
export function createStopMarkerFilter(markers = CHAT_TEMPLATE_STOP_MARKERS) {
  let held = "";
  let hasStopped = false;

  function push(chunk) {
    if (hasStopped) {
      return { text: "", hasStopped };
    }
    const text = held + chunk;
    held = "";
    const markerIndex = firstMarkerIndex(text, markers);
    if (markerIndex >= 0) {
      hasStopped = true;
      return { text: text.slice(0, markerIndex), hasStopped };
    }
    const heldLength = partialMarkerLength(text, markers);
    held = text.slice(text.length - heldLength);
    return { text: text.slice(0, text.length - heldLength), hasStopped };
  }

  function finish() {
    const text = held;
    held = "";
    return text;
  }

  return { push, finish };
}
