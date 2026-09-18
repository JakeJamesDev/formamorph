import { useEffect, useRef, type RefObject } from 'react';
import { viewedTurn, type TurnBox } from '@/lib/chatReadingLine';

// A scroll offset within this many pixels of the end counts as the bottom.
const AT_BOTTOM_PX = 2;

interface ReadingLineOptions {
  /** The turn the panels show now, as a zero-based index. */
  viewedIndex: number;
  latestIndex: number;
  /** Called with the new viewed turn, only when it differs from `viewedIndex`. */
  onViewedTurn: (index: number) => void;
  /** True while a scroll the code started is still moving; the barrier waits for it to settle. */
  isProgrammaticScroll?: () => boolean;
}

/** The turn boxes of the mounted `[data-index]` turns, from the scroller's top edge. */
function mountedTurns(scroller: HTMLElement): TurnBox[] {
  const origin = scroller.getBoundingClientRect().top;
  return Array.from(scroller.querySelectorAll<HTMLElement>('[data-index]'), (el) => {
    const rect = el.getBoundingClientRect();
    return { index: Number(el.dataset.index), top: rect.top - origin, bottom: rect.bottom - origin };
  });
}

/**
 * The reading-line barrier: on player scrolls, one time for each animation frame, it finds the turn on the
 * reading line and reports it when the viewed turn changes.
 */
export function useReadingLine(scroller: RefObject<HTMLElement | null>, options: ReadingLineOptions) {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const run = () => {
      frame = 0;
      const { viewedIndex, latestIndex, onViewedTurn, isProgrammaticScroll } = latest.current;
      // Poll until a code-started scroll settles, so its passage through older turns never counts.
      if (isProgrammaticScroll?.()) { frame = requestAnimationFrame(run); return; }
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= AT_BOTTOM_PX;
      const index = viewedTurn(mountedTurns(el), { viewportHeight: el.clientHeight, atBottom, latestIndex });
      if (index !== null && index !== viewedIndex) onViewedTurn(index);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(run); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller]);
}
