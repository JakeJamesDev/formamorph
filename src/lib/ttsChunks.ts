// Kokoro caps each generate() call at ~510 tokens and silently truncates beyond it, so long
// narration must be split into chunks that each stay under the budget. maxChars is a conservative
// character proxy for that token budget (narration sentences sit well under it).

/** Split text at sentence boundaries (terminator + whitespace). The last segment may be an
 *  in-progress sentence with no trailing terminator — useful when feeding streaming text. */
export function splitSentenceSegments(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/);
}

/**
 * Strip Markdown syntax so the TTS engine speaks the words, not the punctuation — Kokoro reads a stray
 * `*` as "asterisk". Keeps the readable text and drops the markers: emphasis (*, **, _, __, ~~), inline
 * code and fences (`), links/images ([text](url) → text), and line-start headings, blockquotes, and
 * list bullets. Not a full parser — just enough to keep narration clean for speech.
 */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images ![alt](url) -> alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links [text](url) -> text
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1') // fenced code -> inner text
    .replace(/(\*{1,3}|_{1,3}|~~)(.+?)\1/g, '$2') // paired emphasis/strikethrough -> inner text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s{0,3}[-+*]\s+/gm, '') // unordered list bullets
    .replace(/^\s{0,3}\d+\.\s+/gm, '') // ordered list markers
    .replace(/[*_`~]/g, '') // any leftover/unpaired markers
    .replace(/\|/g, ' ') // table pipes
    .replace(/[ \t]{2,}/g, ' '); // tidy the gaps left behind
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
