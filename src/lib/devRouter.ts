/**
 * DEV-only hash router for jumping straight to an app state during manual/preview verification —
 * so reaching a deep screen is one call, not a click-and-screenshot crawl. Hash form:
 *
 *   #dev?view=gameViewer&modal=settings&tab=prompts
 *
 * Consumers read the route via `useDevRoute()` and honor it behind their own `import.meta.env.DEV`
 * effect. `window.__fmDev.goto(...)` sets the hash imperatively (what a `preview_eval` call drives).
 *
 * Every export short-circuits when `!import.meta.env.DEV`, so production builds dead-code-eliminate the
 * body and nothing ships (same guard as `baselineTestHook.ts`).
 */
import { useSyncExternalStore } from 'react';

const DEV = import.meta.env.DEV;

/** A parsed dev-route: the location to land on. All fields optional — absent means "leave as-is". */
export interface DevRoute {
  view?: string;
  modal?: string;
  tab?: string;
}

/** Parse the current hash into a DevRoute, or null when it isn't a `#dev` hash. */
function parseHash(hash: string): DevRoute | null {
  if (!hash.startsWith('#dev')) return null;
  const params = new URLSearchParams(hash.slice('#dev'.length).replace(/^\?/, ''));
  const route: DevRoute = {};
  const view = params.get('view');
  const modal = params.get('modal');
  const tab = params.get('tab');
  if (view) route.view = view;
  if (modal) route.modal = modal;
  if (tab) route.tab = tab;
  return route;
}

let current: DevRoute | null = DEV ? parseHash(window.location.hash) : null;
const listeners = new Set<() => void>();

if (DEV) {
  window.addEventListener('hashchange', () => {
    current = parseHash(window.location.hash);
    for (const l of listeners) l();
  });
}

function subscribe(listener: () => void): () => void {
  if (!DEV) return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current dev-route (null outside DEV or when no `#dev` hash is set). */
export function getDevRoute(): DevRoute | null {
  return current;
}

/** React hook: the current dev-route, re-rendering on hash changes. Always null in production. */
export function useDevRoute(): DevRoute | null {
  return useSyncExternalStore(subscribe, getDevRoute, () => null);
}

/** Install `window.__fmDev` (goto/route/clear). Returns a cleanup; a no-op outside DEV. Call once from App. */
export function installDevRouter(): () => void {
  if (!DEV) return () => {};
  const w = window as unknown as { __fmDev?: unknown };
  w.__fmDev = {
    /** Jump to a screen/modal/tab in one call — sets the `#dev` hash the consumers react to. */
    goto(view?: string, opts?: { modal?: string; tab?: string }) {
      const params = new URLSearchParams();
      if (view) params.set('view', view);
      if (opts?.modal) params.set('modal', opts.modal);
      if (opts?.tab) params.set('tab', opts.tab);
      const qs = params.toString();
      window.location.hash = qs ? `#dev?${qs}` : '#dev';
    },
    route: () => getDevRoute(),
    clear() {
      window.location.hash = '';
    },
  };
  return () => {
    delete (w as { __fmDev?: unknown }).__fmDev;
  };
}
