/** DEV only: flags three catalog worlds as Hidden Gems while the dev route has `fixture=hiddenGems`. */
import { getDevRoute } from '@/lib/devRouter';
import WorldStorageService, { type CatalogFetch } from '@/services/WorldStorageService';
import { kindOf } from '@/lib/catalogKinds';
import { isPinned } from '@/lib/pinning';
import type { WorldRecord } from '@/components/WorldDetails';

const FIXTURE = 'hiddenGems';

/** Flags the three public worlds with the fewest downloads, in place of the server's picks. */
function flagGems(rows: unknown[]): unknown[] {
  const worlds = (rows as WorldRecord[]).filter((w) => kindOf(w) === 'world' && !isPinned(w) && !w.supporter_only && !w.contest_event_id);
  const picks = new Set([...worlds].sort((a, b) => (a.downloads || 0) - (b.downloads || 0)).slice(0, 3));
  return (rows as WorldRecord[]).map((w) => ({ ...w, hidden_gem: picks.has(w) }));
}

async function fetchDevCatalog(): Promise<CatalogFetch> {
  const real = await Object.getPrototypeOf(WorldStorageService).fetchCatalog.call(WorldStorageService, null) as CatalogFetch;
  // No tag, so the next fetch after the fixture ends reads the server's own flags.
  return real.status === 'fresh' ? { ...real, data: flagGems(real.data), tag: null } : real;
}

let stubbed = false;

/** Shadows `fetchCatalog` while the route asks for it; deleting the shadow restores it. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) Object.assign(WorldStorageService, { fetchCatalog: fetchDevCatalog });
  // Another fixture's shadow may have replaced this one; leave that in place.
  else if (Object.getOwnPropertyDescriptor(WorldStorageService, 'fetchCatalog')?.value === fetchDevCatalog) {
    delete (WorldStorageService as Partial<typeof WorldStorageService>).fetchCatalog;
  }
  stubbed = wanted;
}

/** Watches the dev route for `fixture=hiddenGems`. A no-op outside DEV. */
export function installDevHiddenGemsStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
