// Fixtures for stories and memory tests.

const FAKE_DIMENSIONS = 32;

function wordsOf(text) {
  const lowered = text.toLowerCase();
  return lowered.match(/[a-z]+/g) ?? [];
}

function bucketFor(word) {
  let total = 0;
  for (const character of word) {
    total += character.charCodeAt(0);
  }
  return total % FAKE_DIMENSIONS;
}

// A stand-in for the local embedding model: a bag of words hashed into a small vector, so texts
// sharing words come out similar. It records every text it embeds.
export function fakeEmbedder() {
  const embeddedTexts = [];
  return {
    dimensions: FAKE_DIMENSIONS,
    embeddedTexts,
    async embed(texts) {
      embeddedTexts.push(...texts);
      return texts.map((text) => {
        const vector = new Array(FAKE_DIMENSIONS).fill(0);
        for (const word of wordsOf(text)) {
          vector[bucketFor(word)] += 1;
        }
        return vector;
      });
    },
  };
}

function abortError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

// A provider that answers each call with the next scripted reply (a list of text chunks); the
// last reply repeats. It records every request, and stops a reply when its call is cancelled.
// `stop` is the stop reason it reports, e.g. "max_tokens" for a reply cut off at the limit.
export function scriptedProvider(replies, { stop = "end_turn" } = {}) {
  const calls = [];
  return {
    calls,
    async *stream(config, request) {
      const reply = replies[Math.min(calls.length, replies.length - 1)];
      calls.push({ config, request });
      for (const chunk of reply) {
        if (request.signal?.aborted) {
          throw abortError();
        }
        yield { text: chunk };
      }
      yield { usage: { input: 10, output: 5, stop } };
    },
    async listModels() {
      return [{ id: "fake-1", label: "Fake 1" }];
    },
  };
}

// Builds a full reply the way the output protocol asks for it, split into small chunks.
export function protocolReply({ speaker, recall, text, updates = {}, memory = {}, world = {} }) {
  let header = `[[speaker: ${speaker}]]\n`;
  if (recall) {
    header += `[[recall: ${recall}]]\n`;
  }
  const notes =
    `\n<<updates>>${JSON.stringify(updates)}<</updates>>` +
    `\n<<world>>${JSON.stringify(world)}<</world>>` +
    `\n<<memory>>${JSON.stringify(memory)}<</memory>>`;
  const full = header + text + notes;
  const chunks = [];
  const chunkSize = 7;
  for (let start = 0; start < full.length; start += chunkSize) {
    chunks.push(full.slice(start, start + chunkSize));
  }
  return chunks;
}
