// Per-token fade for the streaming narration reveal, shared by the renderer (which runs Streamdown's
// animation) and the sentence pacer (which spaces releases to match it) so the two can't drift apart.
export const REVEAL_ANIMATION = {
  animation: 'fadeIn' as const,
  sep: 'word' as const,
  duration: 400, // ms for one word to fade in
  stagger: 40, // ms between consecutive words in a released sentence
};

/** ms for a `wordCount`-word sentence to finish cascading in — the pacer waits this long before
 *  releasing the next sentence, so sentences never animate over one another. */
export function sentenceRevealMs(wordCount: number): number {
  return Math.max(0, wordCount - 1) * REVEAL_ANIMATION.stagger + REVEAL_ANIMATION.duration;
}
