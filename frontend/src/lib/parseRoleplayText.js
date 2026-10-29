// Splits roleplay text into styled pieces: *actions*, **bold**, "speech" and `code`.
// Returns plain data ({ kind, text }) rather than HTML, so any renderer (web or native) can draw it.

const PATTERNS = [
  { kind: "code", expression: /`([^`\n]+)`/ },
  { kind: "bold", expression: /\*\*([^*\n]+)\*\*/ },
  { kind: "action", expression: /\*([^*\n]+)\*/ },
  { kind: "speech", expression: /(["“][^"”\n]*["”])/ },
];

function findEarliestMatch(text) {
  let earliest = null;
  for (const pattern of PATTERNS) {
    const match = pattern.expression.exec(text);
    if (!match) {
      continue;
    }
    if (earliest === null || match.index < earliest.index) {
      earliest = {
        kind: pattern.kind,
        index: match.index,
        fullLength: match[0].length,
        content: match[1],
      };
    }
  }
  return earliest;
}

export function parseRoleplayText(text) {
  const pieces = [];
  let remaining = String(text ?? "");
  while (remaining) {
    const match = findEarliestMatch(remaining);
    if (!match) {
      pieces.push({ kind: "plain", text: remaining });
      break;
    }
    if (match.index > 0) {
      pieces.push({ kind: "plain", text: remaining.slice(0, match.index) });
    }
    pieces.push({ kind: match.kind, text: match.content });
    remaining = remaining.slice(match.index + match.fullLength);
  }
  return pieces;
}
