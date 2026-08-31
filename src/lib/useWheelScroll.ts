import { useCallback, useRef } from 'react';

/** Wheel deltas arrive in pixels, lines, or pages (`deltaMode` 0/1/2). Only the first needs no conversion. */
const LINE_HEIGHT = 16;
const PAGE_FRACTION = 0.9;

/**
 * Scroll a pop-up's own list on the wheel, rather than leaving it to the browser.
 *
 * A modal dialog locks the page by cancelling every wheel event that lands outside its own content —
 * `react-remove-scroll`, which Radix's Dialog uses, does that from a listener on `document`, and a pop-up
 * portaled to the body is outside by construction. The list then refuses the wheel while looking perfectly
 * scrollable, and nothing in the pop-up can tell: the cancel happens after the event has left it.
 *
 * Scrolling here is what survives that, because what the lock cancels is the browser's default and this no
 * longer needs it. Vertical only, which is all a dropdown has. Returns a ref callback for the scrolling
 * element itself — not a wrapper, since it is the scroll position that has to move.
 */
export function useWheelScroll<T extends HTMLElement>(): (el: T | null) => void {
  const detach = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    detach.current?.();
    detach.current = null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const step = e.deltaMode === 1 ? LINE_HEIGHT : e.deltaMode === 2 ? el.clientHeight * PAGE_FRACTION : 1;
      const before = el.scrollTop;
      el.scrollTop = before + e.deltaY * step;
      // Claimed only where the list actually moved, so a wheel at either end still reaches whatever is
      // behind it — and so an unlocked page keeps its own scroll chaining.
      if (el.scrollTop !== before) e.preventDefault();
    };
    // Non-passive, or the browser refuses the cancel and scrolls the list a second time itself.
    el.addEventListener('wheel', onWheel, { passive: false });
    detach.current = () => el.removeEventListener('wheel', onWheel);
  }, []);
}
