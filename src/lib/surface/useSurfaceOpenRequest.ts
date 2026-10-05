import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { endpointTabForRoute, type SettingsTabId } from '@/components/modals/settingsTabs';
import { randomUUID } from '@/lib/uuid';
import { opensInHelpWindow, resolveSurface, stepTab, targetRoute, type SurfaceSteps, type TabKey } from './surfaceRoute';

/**
 * Acts on a pending `requestSurface(...)` once per request. `open` gets the steps and `clear`, which it
 * calls once the request is answered; a view that hands the request to another screen leaves it pending.
 * Requests the help window opens itself are left for it, and an id that opens nothing is cleared.
 */
export function useSurfaceOpenRequest(open: (steps: SurfaceSteps, clear: () => void) => void) {
  const { surfaceRequest, clearSurfaceRequest } = useSettings();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!surfaceRequest || handled.current === surfaceRequest.nonce) return;
    const steps = resolveSurface(surfaceRequest.id, surfaceRequest.target);
    if (steps && opensInHelpWindow(steps)) return;
    handled.current = surfaceRequest.nonce;
    const clear = () => clearSurfaceRequest(surfaceRequest.nonce);
    if (steps) open(steps, clear);
    else clear();
    // `open` is out of the deps: the nonce check above already runs each request once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceRequest, clearSurfaceRequest]);
}

/**
 * The landing of the last answered request, for the tab hosts to read in the commit that opens them. It
 * clears on the next commit, so a later mount opens on its own default.
 */
export function useSurfaceNav() {
  const [nav, setNav] = useState<{ key: string; steps: SurfaceSteps } | null>(null);
  useEffect(() => { if (nav) setNav(null); }, [nav]);
  const land = useCallback((steps: SurfaceSteps) => setNav({ key: randomUUID(), steps }), []);
  return {
    land,
    /** Changes with each request, so a repeat request selects its tab again. */
    key: nav?.key,
    tab: <L extends TabKey>(ledger: L) => (nav ? stepTab(nav.steps, ledger) : undefined),
    settings: nav ? settingsLanding(nav.steps) : undefined,
    /** The route text of the row the request lands on, for the surfaces the page lands itself. Settings and the World Editor land their own. */
    pageTarget: nav && landsOnPage(nav.steps) ? targetRoute(nav.steps) : undefined,
    /** The route text of the row the request names, for a host to hand to the surface it opens. */
    target: nav ? targetRoute(nav.steps) : undefined,
  };
}

function landsOnPage(steps: SurfaceSteps): boolean {
  return steps.dialog !== 'settings' && steps.dialog !== 'worldEditor';
}

/** Where a set of steps lands in Settings, in the shape the Settings modal's props take. */
export interface SettingsLanding {
  tab?: SettingsTabId;
  endpointTab?: string;
  promptTab?: string;
  promptSurface?: string;
  /** The route text of the row to land on. */
  target?: string;
}

export function settingsLanding(steps: SurfaceSteps): SettingsLanding {
  return {
    tab: stepTab(steps, 'settings'),
    endpointTab: endpointTabForRoute(stepTab(steps, 'settingsEndpoints')),
    promptTab: stepTab(steps, 'settingsPrompts') ?? stepTab(steps, 'settingsPromptPreset'),
    promptSurface: stepTab(steps, 'settingsPromptSurfaces'),
    target: targetRoute(steps),
  };
}

/** Whether opening these steps closes the World Editor. Settings and the help window open over it. */
export function closesWorldEditor(steps: SurfaceSteps): boolean {
  return steps.dialog !== 'worldEditor' && steps.dialog !== 'settings';
}
