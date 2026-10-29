// Shift markers are transcript entries noting how the personality moved between replies.
// Each reply keeps at most one marker, just before the user turn it answers.
import { describeShift } from "../lore/shift.js";

function lastUserTurnBefore(messages, index) {
  let userIndex = index - 1;
  while (userIndex >= 0 && messages[userIndex].role !== "user") {
    userIndex--;
  }
  return userIndex;
}

// Adds, updates or removes the marker so it matches how far the dials moved since `before`.
export function syncShiftMarker({ lore, chat, replyIndex, before, current, createMarker }) {
  const shift = describeShift(lore, before, current);
  const userIndex = lastUserTurnBefore(chat.messages, replyIndex);
  if (userIndex < 0) {
    return;
  }
  const entryBeforeUser = chat.messages[userIndex - 1];
  if (entryBeforeUser?.role === "shift") {
    if (shift) {
      entryBeforeUser.content = shift.summary;
    } else {
      chat.messages.splice(userIndex - 1, 1);
    }
    return;
  }
  if (shift) {
    chat.messages.splice(userIndex, 0, createMarker(shift.summary));
  }
}
