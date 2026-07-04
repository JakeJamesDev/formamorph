import type { World, SaveObject, Stat } from '@/types';
import { normalizeCustomVRM } from './worldImport';
import { autoBindLegacyBodyStats } from './bodyMorphs';

/** Current app version, derived from package.json (see vite.config.js `define`). User-managed. */
export const APP_VERSION = __APP_VERSION__;

/** The era of pre-2.0 files: worlds had no `version`; saves used the numeric `version: 2`. */
export const LEGACY_VERSION = '1.2';

/** Audience-based description rename: old key → new key (entities and locations). */
const DESCRIPTION_KEY_RENAMES: Record<string, string> = {
  inGameDescription: 'playerDescription',
  detailedDescription: 'aiDescription',
};

/** Rename legacy description keys on one item; idempotent, prefers an already-present new key. */
function renameDescriptionKeys(item: Record<string, unknown>): Record<string, unknown> {
  const next = { ...item };
  for (const [oldKey, newKey] of Object.entries(DESCRIPTION_KEY_RENAMES)) {
    if (oldKey in next) {
      if (next[newKey] === undefined) next[newKey] = next[oldKey];
      delete next[oldKey];
    }
  }
  return next;
}

/** Apply the description rename across an entities/locations array (leaves non-arrays untouched). */
function renameItemDescriptions(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((it) =>
    it && typeof it === 'object' ? renameDescriptionKeys(it as Record<string, unknown>) : it,
  );
}

/** Rename a trait's single legacy `description` to `playerDescription` (idempotent, prefers existing). */
function renameTraitDescriptions(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((it) => {
    if (!it || typeof it !== 'object' || !('description' in it)) return it;
    const { description, ...rest } = it as Record<string, unknown>;
    return { ...rest, playerDescription: rest.playerDescription ?? description };
  });
}

/**
 * Bring an imported world up to the current format and stamp it with `APP_VERSION`. Idempotent — a
 * world already at `APP_VERSION` is returned unchanged. Moves the legacy root `customPlayerVRM` bare
 * data-URL into `worldOverview.customPlayerVRM` as a `MediaAsset`, auto-binds legacy body stats to
 * body morphs, and renames v1.2 description keys on entities/locations/traits to the audience-based
 * keys. Remaining field defaults are left to `loadWorldData`. Add further 2.0 → 2.x steps here when the
 * shape changes — a version bump is the user's call (see the export-shape-versioning note).
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

  // v1.2 used `inGameDescription`/`detailedDescription`; rename to the audience-based keys.
  if (Array.isArray(world.entities)) world.entities = renameItemDescriptions(world.entities);
  if (Array.isArray(world.locations)) world.locations = renameItemDescriptions(world.locations);

  // v1.2 traits had a single `description` (player-facing); rename to `playerDescription`.
  if (Array.isArray(world.traits)) world.traits = renameTraitDescriptions(world.traits);

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
