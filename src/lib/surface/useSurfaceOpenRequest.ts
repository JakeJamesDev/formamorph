import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { endpointTabForRoute, type SettingsTabId } from '@/components/modals/settingsTabs';
import { randomUUID } from '@/lib/uuid';
import { useTargetLanding } from './useLanding';
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
 * clears on the next commit, so a later mount opens on its own default. It also lands the request's row,
 * except in Settings and the World Editor, which land their own.
 */
export function useSurfaceNav() {
  const [nav, setNav] = useState<{ key: string; steps: SurfaceSteps } | null>(null);
  useEffect(() => { if (nav) setNav(null); }, [nav]);
  const land = useCallback((steps: SurfaceSteps) => setNav({ key: randomUUID(), steps }), []);
  const target = nav ? targetRoute(nav.steps) : undefined;
  useTargetLanding(nav && landsOnPage(nav.steps) ? target : undefined, nav?.key);
  return {
    land,
    /** Changes with each request, so a repeat request selects its tab again. */
    key: nav?.key,
    tab: <L extends TabKey>(ledger: L) => (nav ? stepTab(nav.steps, ledger) : undefined),
    settings: nav ? settingsLanding(nav.steps) : undefined,
    /** The route text of the row the request names, for Settings and the World Editor, which land their own. */
    target,
  };
}

/**
 * Whether the page lands these steps' row. Settings and the World Editor land their own and open over the
 * World Editor, so every other request closes it.
 */
export function landsOnPage(steps: SurfaceSteps): boolean {
  return steps.dialog !== 'settings' && steps.dialog !== 'worldEditor';
}

/** Where a set of steps lands in Settings, in the shape the Settings modal's props take. */
export interface SettingsLanding {
  tab?: SettingsTabId;
  endpointTab?: string;
  promptTab?: string;
  promptSurface?: string;
}

export function settingsLanding(steps: SurfaceSteps): SettingsLanding {
  return {
    tab: stepTab(steps, 'settings'),
    endpointTab: endpointTabForRoute(stepTab(steps, 'settingsEndpoints')),
    promptTab: stepTab(steps, 'settingsPrompts') ?? stepTab(steps, 'settingsPromptPreset'),
    promptSurface: stepTab(steps, 'settingsPromptSurfaces'),
  };
}
