import { useEffect, useRef, type RefObject } from 'react';

/** One claimed back step, and the element the claiming screen lives in when it has one. */
export interface BackStop {
  run: () => void;
  /** Set when the screen sits inside a layer, so the back button can tell the layer's own step apart. */
  within?: RefObject<HTMLElement | null>;
}

/**
 * Screens that fill a view without being a modal or a view of their own — the avatar editor, the
 * first-run intro. They are invisible to both the layer check and the view trail, so they say so here.
 * Innermost last, which is the order the back button unwinds them in.
 */
const stops: BackStop[] = [];

/** The back steps full-screen sub-screens have claimed, innermost last. */
export function backStops(): readonly BackStop[] {
  return stops;
}

/**
 * Claim the back press for as long as this screen is mounted. Pass `undefined` to claim nothing — a
 * sub-screen with no way back should let the press fall through to the view behind it. Pass `within`
 * when the screen is the body of a dialog that refuses Escape, so back runs this step instead.
 */
export function useBackStop(onBack: (() => void) | undefined, within?: RefObject<HTMLElement | null>): void {
  // Read through a ref so an inline handler does not re-register the claim on every render.
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });

  const claimed = onBack !== undefined;
  useEffect(() => {
    if (!claimed) return;
    const stop: BackStop = { run: () => latest.current?.(), within };
    stops.push(stop);
    return () => {
      const at = stops.lastIndexOf(stop);
      if (at >= 0) stops.splice(at, 1);
    };
  }, [claimed, within]);
}
