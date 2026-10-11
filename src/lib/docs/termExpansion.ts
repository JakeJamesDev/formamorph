/**
 * Partial-word and close-spelling expansion for the Docs Index: a query word with no exact match maps to the
 * indexed words that start with it or are a few edits away.
 */

/** The fewest letters a query word needs before it expands. */
const MIN_EXPAND_LENGTH = 4;
/** The fewest letters a query word needs to match two edits away instead of one. */
const LONG_WORD_LENGTH = 8;

/**
 * The optimal string alignment distance between two words: insertions, deletions, substitutions and swaps of
 * two neighbors each cost one. Returns `max + 1` once the distance passes `max`.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      row.push(d);
      least = Math.min(least, d);
    }
    if (least > max) return max + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

/**
 * Builds an expander over the index's words, each with its stem. The expander gives the stems of the words
 * that start with the query word. With none, it gives those one edit away (two for a long word), so a word
 * still being typed does not match a close spelling of its first letters. A word under
 * {@link MIN_EXPAND_LENGTH} letters, or one that holds a digit, gives none.
 */
export function createTermExpander(vocabulary: ReadonlyMap<string, string>): (word: string) => string[] {
  const entries = [...vocabulary];
  return (word) => {
    if (word.length < MIN_EXPAND_LENGTH || /\p{N}/u.test(word)) return [];
    const max = word.length >= LONG_WORD_LENGTH ? 2 : 1;
    const started = new Set<string>();
    const close = new Set<string>();
    for (const [known, stem] of entries) {
      if (known.startsWith(word)) started.add(stem);
      else if (started.size === 0 && editDistance(word, known, max) <= max) close.add(stem);
    }
    return [...(started.size > 0 ? started : close)];
  };
}
