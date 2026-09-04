import { useEffect, useRef } from 'react';

/**
 * Screens that fill a view without being a modal or a view of their own — the avatar editor, the
 * first-run intro. They are invisible to both the layer check and the view trail, so they say so here.
 * Innermost last, which is the order the back button unwinds them in.
 */
const stops: (() => void)[] = [];

/** The back steps full-screen sub-screens have claimed, innermost last. */
export function backStops(): readonly (() => void)[] {
  return stops;
}

/**
 * Claim the back press for as long as this screen is mounted. Pass `undefined` to claim nothing — a
 * sub-screen with no way back should let the press fall through to the view behind it.
 */
export function useBackStop(onBack: (() => void) | undefined): void {
  // Read through a ref so an inline handler does not re-register the claim on every render.
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });

  const claimed = onBack !== undefined;
  useEffect(() => {
    if (!claimed) return;
    const stop = () => latest.current?.();
    stops.push(stop);
    return () => {
      const at = stops.lastIndexOf(stop);
      if (at >= 0) stops.splice(at, 1);
    };
  }, [claimed]);
}
