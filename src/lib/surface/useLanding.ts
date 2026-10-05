import { useCallback, useEffect, useRef, useState } from 'react';
import { landingControl, pulseLanding } from '@/lib/landingPulse';
import { findTargetRow } from './surfaceTargets';

/** How many frames (about half a second) a landing looks for its row before it lands nothing. */
const LANDING_FRAMES = 30;

export interface LandingOptions {
  /** Draws the Landing Pulse on the row. */
  pulse?: boolean;
  /** Where the row sits in its scroller after the scroll. */
  block?: ScrollLogicalPosition;
  /** The element in the row to focus. The Landing Pulse's control by default. */
  focus?: (row: HTMLElement) => HTMLElement | null;
}

/**
 * Lands on a row once per call of the returned function. A frame after the call, so a tab panel that mounts
 * a commit late is there, it scrolls the row into view, focuses its control, and pulses its ring. A row
 * that never shows lands nothing.
 */
export function useLanding<T>(find: (target: T) => HTMLElement | null, options: LandingOptions = {}): (target: T) => void {
  // Each call is a new object, so a repeat call for the same target lands again.
  const [request, setRequest] = useState<{ target: T } | null>(null);
  const latest = useRef({ find, options });
  useEffect(() => { latest.current = { find, options }; });
  useEffect(() => {
    if (!request) return;
    let frames = 0;
    let frame = 0;
    let cancelPulse: (() => void) | undefined;
    const look = () => {
      const row = latest.current.find(request.target);
      if (!row) {
        if (++frames < LANDING_FRAMES) frame = requestAnimationFrame(look);
        return;
      }
      const { pulse = false, block = 'nearest', focus = landingControl } = latest.current.options;
      row.scrollIntoView({ block });
      focus(row)?.focus({ preventScroll: true });
      if (pulse) cancelPulse = pulseLanding(row);
    };
    frame = requestAnimationFrame(look);
    return () => {
      cancelAnimationFrame(frame);
      cancelPulse?.();
    };
  }, [request]);
  return useCallback((target: T) => setRequest({ target }), []);
}

const findInDocument = (route: string) => findTargetRow(document, route);

/** The function form of `useTargetLanding`, for a host that lands from an event handler. */
export function useRouteLanding(): (route: string) => void {
  return useLanding(findInDocument, { pulse: true });
}

/**
 * Lands on a route's row anywhere on the page, for a host whose dialogs and tabs all mount under it. A route
 * names its surface, so one lookup serves every dialog the host opens. `requestKey` changes per request, so a
 * repeat request lands again.
 */
export function useTargetLanding(route: string | undefined, requestKey: string | undefined): void {
  const land = useRouteLanding();
  useEffect(() => { if (route) land(route); }, [route, requestKey, land]);
}
