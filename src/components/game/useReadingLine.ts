import { useEffect, useRef, type RefObject } from 'react';
import { AT_BOTTOM_PX, viewedTurn, type TurnBox } from '@/lib/chatReadingLine';

interface ReadingLineOptions {
  /** The turn the panels show now, as a zero-based index. */
  viewedIndex: number;
  latestIndex: number;
  /** Called with the new viewed turn, only when it differs from `viewedIndex`. */
  onViewedTurn: (index: number) => void;
  /** True while a scroll the code started is still moving; the barrier waits for it to settle. */
  isProgrammaticScroll: () => boolean;
  /** True while scrolls place the list on purpose; the barrier drops them. */
  isPlacing: () => boolean;
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
      if (isProgrammaticScroll()) { frame = requestAnimationFrame(run); return; }
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= AT_BOTTOM_PX;
      const index = viewedTurn(mountedTurns(el), { viewportHeight: el.clientHeight, atBottom, latestIndex });
      if (index !== null && index !== viewedIndex) onViewedTurn(index);
    };
    const onScroll = () => { if (!frame && !latest.current.isPlacing()) frame = requestAnimationFrame(run); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller]);
}
