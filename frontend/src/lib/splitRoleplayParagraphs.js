// Breaks a roleplay reply into paragraphs for reading: every *action* is its own paragraph, and so
// is every stretch of words between actions. Plain data, so any renderer can draw it.
//
// Two things look alike but aren't:
// - A short *word* in the middle of a sentence is emphasis ("what you'd *want*"), not an action;
//   it stays in the sentence as an "emphasis" piece.
// - Quotes at the start of a stretch or after . : , are dialogue in narration ("She waits.
//   "Fine," she says."). Quotes after a word mid-sentence are the speaker quoting a phrase
//   ("the difference between "useful" and "wanted""); those stay inside the speech, in single
//   quotes.
// Words that are the character speaking get curly double quotes; straight quotes are curled.
//
// Paragraph kinds:
// - "action": { kind, text }
// - "speech": { kind, pieces } — spoken words, quotes already added
// - "mixed": { kind, pieces } — narration ("plain" pieces) around quoted speech ("speech" pieces)
import { parseRoleplayText } from "./parseRoleplayText.js";

const OPEN_QUOTE = "“";
const CLOSE_QUOTE = "”";
const OPEN_INNER_QUOTE = "‘";
const CLOSE_INNER_QUOTE = "’";
const ANY_QUOTE = /["“”]/;
const HAS_WORDS = /[\p{L}\p{N}]/u;
// Text ending like this has finished a sentence (or clause), so what follows starts afresh.
const ENDS_SENTENCE = /[.!?…:;"“”)\]—]$/;
// Text ending like this introduces dialogue: "She waits. "Fine,"" or "he says, "Fine.""
const INTRODUCES_DIALOGUE = /[.!?…:,]$/;
// Emphasis is a word or a few; anything longer between asterisks is an action.
const MAX_EMPHASIS_WORDS = 4;

function curlQuotes(speech) {
  const trimmed = speech.trim();
  const inner = trimmed.replace(/^["“]/, "").replace(/["”]$/, "");
  return OPEN_QUOTE + inner + CLOSE_QUOTE;
}

function piecesText(pieces) {
  return pieces.map((piece) => piece.text).join("");
}

function trimPieces(pieces) {
  const trimmed = pieces.map((piece) => ({ ...piece }));
  if (trimmed.length > 0) {
    trimmed[0].text = trimmed[0].text.trimStart();
    trimmed[trimmed.length - 1].text = trimmed[trimmed.length - 1].text.trimEnd();
  }
  return trimmed.filter((piece) => piece.text !== "");
}

function asInnerQuote(speech) {
  const trimmed = speech.trim();
  const inner = trimmed.replace(/^["“]/, "").replace(/["”]$/, "");
  return OPEN_INNER_QUOTE + inner + CLOSE_INNER_QUOTE;
}

// Phrases the speaker quotes become single-quoted, inside the speech's own double quotes.
function withInnerQuotes(pieces) {
  return pieces.map((piece) => {
    if (piece.kind === "speech") {
      return { kind: "quoted", text: asInnerQuote(piece.text) };
    }
    return piece;
  });
}

function speechParagraph(pieces) {
  const quotedPieces = [
    { kind: "plain", text: OPEN_QUOTE },
    ...withInnerQuotes(pieces),
    { kind: "plain", text: CLOSE_QUOTE },
  ];
  return { kind: "speech", pieces: quotedPieces };
}

function mixedParagraph(pieces) {
  const curledPieces = pieces.map((piece) => {
    if (piece.kind === "speech") {
      return { ...piece, text: curlQuotes(piece.text) };
    }
    return piece;
  });
  return { kind: "mixed", pieces: curledPieces };
}

// Stray punctuation between two actions ("*nods*. *sits*") belongs to the paragraph before it.
function appendToPrevious(paragraphs, text) {
  const previous = paragraphs[paragraphs.length - 1];
  if (!previous) {
    return;
  }
  if (previous.kind === "action") {
    previous.text += text.trim();
    return;
  }
  const lastPiece = previous.pieces[previous.pieces.length - 1];
  lastPiece.text += text.trim();
}

function isDialogueQuote(textBefore) {
  const trimmed = textBefore.trimEnd();
  return trimmed === "" || INTRODUCES_DIALOGUE.test(trimmed);
}

// True when some quote in the stretch is dialogue rather than a phrase the speaker quotes.
function hasDialogue(pieces) {
  let textBefore = "";
  for (const piece of pieces) {
    if (piece.kind === "speech" && isDialogueQuote(textBefore)) {
      return true;
    }
    textBefore += piece.text;
  }
  return false;
}

function flushWords(paragraphs, bufferedPieces) {
  const pieces = trimPieces(bufferedPieces);
  const text = piecesText(pieces);
  if (!text) {
    return;
  }
  if (!HAS_WORDS.test(text)) {
    appendToPrevious(paragraphs, text);
    return;
  }
  if (ANY_QUOTE.test(text) && hasDialogue(pieces)) {
    paragraphs.push(mixedParagraph(pieces));
    return;
  }
  paragraphs.push(speechParagraph(pieces));
}

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

// A short *word* in the middle of a sentence is emphasis: there are words before it in the same
// stretch, and they haven't finished a sentence.
function isInlineEmphasis(actionText, bufferedPieces) {
  const textBefore = piecesText(bufferedPieces).trimEnd();
  if (!textBefore || ENDS_SENTENCE.test(textBefore)) {
    return false;
  }
  return wordCount(actionText) <= MAX_EMPHASIS_WORDS;
}

function splitLine(line, paragraphs) {
  let bufferedPieces = [];
  for (const piece of parseRoleplayText(line)) {
    if (piece.kind !== "action") {
      bufferedPieces.push(piece);
      continue;
    }
    if (isInlineEmphasis(piece.text, bufferedPieces)) {
      bufferedPieces.push({ kind: "emphasis", text: piece.text });
      continue;
    }
    flushWords(paragraphs, bufferedPieces);
    bufferedPieces = [];
    paragraphs.push({ kind: "action", text: piece.text.trim() });
  }
  flushWords(paragraphs, bufferedPieces);
}

export function splitRoleplayParagraphs(text) {
  const paragraphs = [];
  const lines = String(text ?? "").split("\n");
  for (const line of lines) {
    if (line.trim()) {
      splitLine(line, paragraphs);
    }
  }
  return paragraphs;
}
