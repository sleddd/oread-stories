// Finds a character's memories closest in meaning to a query, with the local embedding model
// when it is available. Without it (or if it fails), memories sharing the most words with the
// query come first, so recall still works, only less well.
const MIN_SHARED_WORD_LENGTH = 4;

function wordsOf(text) {
  const words =
    String(text)
      .toLowerCase()
      .match(/[\p{L}\p{N}']+/gu) ?? [];
  return new Set(words.filter((word) => word.length >= MIN_SHARED_WORD_LENGTH));
}

function sharedWordCount(firstWords, secondWords) {
  let count = 0;
  for (const word of firstWords) {
    if (secondWords.has(word)) {
      count += 1;
    }
  }
  return count;
}

export function searchByWords(entries, query, limit) {
  const queryWords = wordsOf(query);
  const scored = entries.map((entry) => ({
    entry,
    score: sharedWordCount(queryWords, wordsOf(entry.text + " " + entry.about.join(" "))),
  }));
  const matching = scored.filter((result) => result.score > 0);
  matching.sort((first, second) => second.score - first.score);
  return matching.slice(0, limit).map((result) => result.entry);
}

// Returns up to `limit` entries, closest first. With the embedding model, entries less similar
// than `minimumScore` are left out, so an unrelated moment doesn't drag in random memories.
export async function searchMemories({ memoryIndex, entries, query, limit, minimumScore = 0 }) {
  if (entries.length === 0 || !query.trim()) {
    return [];
  }
  if (!memoryIndex?.isAvailable()) {
    return searchByWords(entries, query, limit);
  }
  try {
    const results = await memoryIndex.search({ entries, query, limit });
    const closeEnough = results.filter((result) => result.score >= minimumScore);
    return closeEnough.map((result) => result.entry);
  } catch {
    return searchByWords(entries, query, limit);
  }
}
