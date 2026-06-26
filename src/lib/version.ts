import type { World, SaveObject, Stat } from '@/types';
import { normalizeCustomVRM } from './worldImport';
import { autoBindLegacyBodyStats } from './bodyMorphs';

/** Current app version, derived from package.json (see vite.config.js `define`). User-managed. */
export const APP_VERSION = __APP_VERSION__;

/** The era of pre-2.0 files: worlds had no `version`; saves used the numeric `version: 2`. */
export const LEGACY_VERSION = '1.2';

/**
 * Bring an imported world up to the current format and stamp it with `APP_VERSION`. Idempotent —
 * a world already at `APP_VERSION` is returned unchanged.
 *
 * Legacy (pre-2.0 / v1.2) → 2.0: the custom VRM was stored at the **root** as a bare data-URL
 * string; move it into `worldOverview.customPlayerVRM` as our `{ data, type }` MediaAsset. Body stats
 * (Stomach/Fatness/Breastsize) get auto-bound to the body morphs the runtime used to drive by name, so
 * they keep working under the user-assignable slider system. Other field defaults are left to
 * `loadWorldData`. Add further `2.0 → 2.x` steps here when the shape changes (a version bump is the
 * user's call — see the export-shape-versioning note).
 */
export function migrateWorld(raw: unknown): World {
  const world = { ...(raw as Record<string, unknown>) };
  if (world.version === APP_VERSION) return world as unknown as World;

  const overview = { ...((world.worldOverview as Record<string, unknown>) ?? {}) };
  overview.customPlayerVRM = normalizeCustomVRM(overview.customPlayerVRM ?? world.customPlayerVRM);
  world.worldOverview = overview;
  delete world.customPlayerVRM; // drop the stray v1.2 root key

  if (Array.isArray(world.stats)) {
    world.stats = autoBindLegacyBodyStats(world.stats as Stat[]);
  }

  world.version = APP_VERSION;
  return world as unknown as World;
}

/**
 * True when a save is in our flat envelope shape (`{ currentState, stateHistory }`) — covers both
 * the legacy numeric `version: 2` and current `APP_VERSION` saves. Deep-nested legacy saves lack
 * `currentState` and still need the conversion worker.
 */
export function isSaveEnvelope(raw: unknown): raw is SaveObject {
  return !!raw && typeof raw === 'object' && 'currentState' in raw && 'stateHistory' in raw;
}
