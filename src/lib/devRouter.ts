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
  /** Second-level tab within a tab (e.g. which prompt under Settings → Prompts). */
  subtab?: string;
  /** Canned world+save to boot mid-game (see `devFixtures.ts`). */
  fixture?: string;
  /** On-screen diagnostic overlay to pin over the app — `viewport` is the only one so far. */
  probe?: string;
  /** World Editor chrome mode — `simple` or `advanced`. */
  mode?: string;
}

/** Parse the current hash into a DevRoute, or null when it isn't a `#dev` hash. */
function parseHash(hash: string): DevRoute | null {
  if (!hash.startsWith('#dev')) return null;
  const params = new URLSearchParams(hash.slice('#dev'.length).replace(/^\?/, ''));
  const route: DevRoute = {};
  const view = params.get('view');
  const modal = params.get('modal');
  const tab = params.get('tab');
  const subtab = params.get('subtab');
  const fixture = params.get('fixture');
  const probe = params.get('probe');
  const mode = params.get('mode');
  if (probe) route.probe = probe;
  if (mode) route.mode = mode;
  if (view) route.view = view;
  if (modal) route.modal = modal;
  if (tab) route.tab = tab;
  if (subtab) route.subtab = subtab;
  if (fixture) route.fixture = fixture;
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
  const w = window as unknown as { __fmDev?: Record<string, unknown> };
  // Merge (don't replace) so imperative hooks registered by mounted providers (e.g. `setImage` from
  // SettingsContext) survive regardless of effect order — child effects run before this parent effect.
  w.__fmDev = Object.assign(w.__fmDev ?? {}, {
    /** Jump to a screen/modal/tab in one call — sets the `#dev` hash the consumers react to. */
    goto(view?: string, opts?: { modal?: string; tab?: string; subtab?: string; fixture?: string; probe?: string; mode?: string }) {
      const params = new URLSearchParams();
      if (view) params.set('view', view);
      if (opts?.modal) params.set('modal', opts.modal);
      if (opts?.tab) params.set('tab', opts.tab);
      if (opts?.subtab) params.set('subtab', opts.subtab);
      if (opts?.mode) params.set('mode', opts.mode);
      if (opts?.fixture) params.set('fixture', opts.fixture);
      // A probe outlives the screen it was turned on over, so it carries across a goto unless replaced.
      const probe = opts?.probe ?? getDevRoute()?.probe;
      if (probe) params.set('probe', probe);
      const qs = params.toString();
      window.location.hash = qs ? `#dev?${qs}` : '#dev';
    },
    /** Pin a diagnostic overlay over whatever is on screen (`'viewport'`), or drop it with no argument. */
    probe(name?: string) {
      const params = new URLSearchParams(window.location.hash.replace(/^#dev\??/, ''));
      if (name) params.set('probe', name);
      else params.delete('probe');
      const qs = params.toString();
      window.location.hash = qs ? `#dev?${qs}` : '#dev';
    },
    /** Boot straight into a running game from a canned fixture (world+save). See `devFixtures.ts`. */
    bootFixture(name: string) {
      window.location.hash = `#dev?view=gameViewer&fixture=${encodeURIComponent(name)}`;
    },
    route: () => getDevRoute(),
    clear() {
      window.location.hash = '';
    },
    /** List stored worlds as `{ id, name }`, so a world can be looked up by name before get/put. */
    async listWorlds() {
      const { default: svc } = await import('@/services/WorldStorageService');
      return (await svc.getWorldMetadata()).map(({ id, name }) => ({ id, name }));
    },
    /** Read a stored world's authored data — the same shape an export writes. */
    async getWorld(id: string) {
      const { default: svc } = await import('@/services/WorldStorageService');
      return svc.getWorldData(id);
    },
    /** Write an exported world straight into storage, replacing any world with the same id. Mirrors the
     *  import path: migrate first, then derive the record's metadata from the migrated overview. */
    async putWorld(world: unknown) {
      const [{ default: svc }, { migrateWorld }] = await Promise.all([
        import('@/services/WorldStorageService'),
        import('@/lib/version'),
      ]);
      const data = migrateWorld(world);
      const id = (world as { id?: string }).id ?? crypto.randomUUID();
      await svc.storeWorld({
        id,
        name: data.worldOverview?.name || 'Untitled',
        description: data.worldOverview?.description || '',
        author: data.worldOverview?.author || '',
        thumbnail: data.worldOverview?.thumbnail || '',
        dirty: true,
        data: data as unknown as { worldOverview: unknown; stats: unknown[]; locations: unknown[];
          entities: unknown[]; traits: unknown[]; statUpdates: unknown[] },
      });
      return id;
    },
  });
  return () => {
    delete (w as { __fmDev?: unknown }).__fmDev;
  };
}

/** DEV-only: attach an imperative helper onto `window.__fmDev` (e.g. a settings setter), so preview
 *  verification can drive app state that has no hash route. Merges into whatever the router installed;
 *  returns a cleanup. No-op (and tree-shaken) outside DEV. */
export function registerDevHook(name: string, fn: (...args: never[]) => unknown): () => void {
  if (!DEV) return () => {};
  const w = window as unknown as { __fmDev?: Record<string, unknown> };
  w.__fmDev = w.__fmDev ?? {};
  w.__fmDev[name] = fn;
  return () => {
    if (w.__fmDev) delete w.__fmDev[name];
  };
}
