import { useEffect, type RefObject } from 'react';
import { edgeFadeShare } from '@/lib/scrollEdgeFade';

/** The narration's top fade: content scrolled past the top fades out, with no hard edge. Gone at the top. */
const TOP = 'rgb(0_0_0/calc(1_-_var(--top-fade,0))),black_2rem';

/** The narration scroller's mask: the top fade alone. */
export const NARRATION_FADE = `[mask-image:linear-gradient(to_bottom,${TOP})]`;

/** The top fade, plus a fixed fade above the request status strip, which floats over the bottom 1rem. */
export const NARRATION_FADE_UNDER_STRIP =
  `[mask-image:linear-gradient(to_bottom,${TOP},black_calc(100%_-_3.5rem),transparent_calc(100%_-_1rem))]`;

/** Writes `--top-fade` on the scroller from how far it has scrolled, so the top fade grows in over the first pixels. */
export function useTopFade(viewportRef: RefObject<HTMLElement>, remountKey?: unknown) {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const sync = () => viewport.style.setProperty('--top-fade', edgeFadeShare(viewport.scrollTop).toFixed(3));
    sync();
    viewport.addEventListener('scroll', sync, { passive: true });
    return () => viewport.removeEventListener('scroll', sync);
  }, [viewportRef, remountKey]);
}
