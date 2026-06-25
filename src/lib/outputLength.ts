// Rough average tokens in one short narration paragraph (English), with headroom so the model
// tends to finish before the hard max_tokens cap. Heuristic constants — tune as needed.
const AVG_TOKENS_PER_PARAGRAPH = 90;
const HEADROOM = 0.8;

/** How many paragraphs comfortably fit in `maxTokens` of output (at least 1). */
export function paragraphsForTokens(maxTokens: number): number {
  const n = Math.floor(((maxTokens || 0) * HEADROOM) / AVG_TOKENS_PER_PARAGRAPH);
  return Math.max(1, n);
}

/** The length directive injected into the game-text prompt for the chosen mode. */
export function lengthGuidance(mode: string, maxTokens: number): string {
  if (mode === 'single') return 'Write a single paragraph.';
  if (mode === 'auto') {
    const n = paragraphsForTokens(maxTokens);
    return n <= 1 ? 'Write a single paragraph.' : `Write at most ${n} short paragraphs.`;
  }
  return ''; // 'none' — no length constraint
}

// Exclusive end index just past the last sentence terminator (. ! ?) plus any trailing closing
// quotes/brackets, where that terminator is followed by whitespace or end-of-string. -1 if none.
// (Decimals like "3.5" don't match — the '.' is followed by a digit, not whitespace/end.)
function lastSentenceEndIndex(text: string): number {
  const re = /[.!?]+["'”’)\]]*(?=\s|$)/g;
  let end = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    end = m.index + m[0].length;
  }
  return end;
}

/**
 * Text up to the last complete sentence; the full text when no sentence has completed yet (so the
 * forming first sentence still streams). The target the smoothed reveal plays toward — it keeps the
 * live tail from ever showing an incomplete trailing sentence.
 */
export function bufferToSentence(text: string): string {
  const s = text || '';
  const end = lastSentenceEndIndex(s);
  return end === -1 ? s : s.slice(0, end);
}

/** Final value on truncation: trimmed text up to the last complete sentence (whole text if none). */
export function trimToLastSentence(text: string): string {
  const s = text || '';
  const end = lastSentenceEndIndex(s);
  return (end === -1 ? s : s.slice(0, end)).trim();
}
