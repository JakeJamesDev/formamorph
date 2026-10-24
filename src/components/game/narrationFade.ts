import { useEffect, type RefObject } from 'react';
import { edgeFadeShare } from '@/lib/scrollEdgeFade';

// Tailwind generates only class names written out in full, so each mask stays one literal.

/**
 * Content past either edge of the narration scroller fades out, with no hard edge. `--top-fade` and
 * `--bottom-fade` are how much of each fade shows, which `useEdgeFades` writes from the scroll, so each fade
 * is gone at its own edge. Unset, neither shows.
 */
export const NARRATION_FADE =
  '[mask-image:linear-gradient(to_bottom,rgb(0_0_0/calc(1_-_var(--top-fade,0))),black_2rem,black_calc(100%_-_2rem),rgb(0_0_0/calc(1_-_var(--bottom-fade,0))))]';

/** The top fade, and a fixed fade above the request status strip, which floats over the bottom 1rem. */
export const NARRATION_FADE_UNDER_STRIP =
  '[mask-image:linear-gradient(to_bottom,rgb(0_0_0/calc(1_-_var(--top-fade,0))),black_2rem,black_calc(100%_-_3.5rem),transparent_calc(100%_-_1rem))]';

/** Writes each edge's fade share on the scroller from the content past it, on scroll and as the content grows. */
export function useEdgeFades(viewportRef: RefObject<HTMLElement | null>, remountKey?: unknown) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const sync = () => {
      const below = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      viewport.style.setProperty('--top-fade', edgeFadeShare(viewport.scrollTop).toFixed(3));
      viewport.style.setProperty('--bottom-fade', edgeFadeShare(below).toFixed(3));
    };
    sync();
    viewport.addEventListener('scroll', sync, { passive: true });
    // Streamed text grows the content without a scroll event.
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [viewportRef, remountKey]);
}
