import { useEffect } from 'react';
import { sentenceRange } from '@/lib/ttsHighlight';

const HIGHLIGHT_NAME = 'tts-active';

// The CSS Custom Highlight API isn't in every browser (Chrome/Edge 105+, Safari 17.2+, Firefox 140+),
// so everything is gated behind this detection and degrades to a clean no-op.
const supported =
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

function clearHighlight() {
  if (supported) CSS.highlights.delete(HIGHLIGHT_NAME);
}

/**
 * Paints a soft highlight over the currently-spoken sentence inside `containerRef`, tracking the TTS
 * playhead (and scrubbing). Uses the CSS Custom Highlight API so Streamdown's DOM is never
 * restructured. Recomputes on active-sentence change or when the narration text mutates (streaming);
 * no-ops when unsupported, disabled, or nothing is playing.
 */
export function useSentenceHighlight(
  containerRef: React.RefObject<HTMLElement>,
  { activeSentenceIndex, sentenceTexts, enabled }: {
    activeSentenceIndex: number;
    sentenceTexts: string[];
    enabled: boolean;
  },
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!supported || !enabled || !container || activeSentenceIndex < 0) {
      clearHighlight();
      return;
    }

    let raf = 0;
    const apply = () => {
      const range = sentenceRange(container, sentenceTexts, activeSentenceIndex);
      // Keep the previous highlight if the sentence isn't in the DOM yet (audio can lead streaming text).
      if (range) CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
    };
    apply();

    // Streamdown re-renders as narration streams; recompute (rAF-coalesced) when the text changes.
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [containerRef, activeSentenceIndex, sentenceTexts, enabled]);

  // Belt-and-suspenders: drop the highlight when the component using this hook unmounts.
  useEffect(() => clearHighlight, []);
}
