// Kokoro caps each generate() call at ~510 tokens and silently truncates beyond it, so long
// narration must be split into chunks that each stay under the budget. maxChars is a conservative
// character proxy for that token budget (narration sentences sit well under it).

/** Split text at sentence boundaries (terminator + whitespace). The last segment may be an
 *  in-progress sentence with no trailing terminator — useful when feeding streaming text. */
export function splitSentenceSegments(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/);
}

/** Split `text` into sentence-packed chunks, each at most `maxChars` long. */
export function splitForTTS(text: string, maxChars = 400): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  // Keep terminators with their sentence; a trailing fragment (no terminator) is its own piece.
  const sentences = normalized.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g) ?? [normalized];

  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (!current) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= maxChars) {
      current += ' ' + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
