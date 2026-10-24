import { useEffect, type RefObject } from 'react';
import { edgeFadeShare } from '@/lib/scrollEdgeFade';

/**
 * Fades a scroller's content out at its bottom, where the request status strip floats, with no hard edge.
 * `--bottom-fade` is how much of the fade shows, which `useBottomFade` writes from the content left below,
 * so the fade is gone at the end. Unset, the fade shows in full.
 */
export const BOTTOM_FADE = '[mask-image:linear-gradient(to_top,rgb(0_0_0/calc(1_-_var(--bottom-fade,1))),black_3rem)]';

/**
 * While `active`, writes `--bottom-fade` on the scroller from the content below its view, on scroll and as the
 * content grows. `active` also re-attaches when the scroller remounts, such as a switch of narration layout.
 */
export function useBottomFade(viewportRef: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !viewport) return;
    const sync = () => {
      const below = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
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
      viewport.style.removeProperty('--bottom-fade');
    };
  }, [viewportRef, active]);
}
