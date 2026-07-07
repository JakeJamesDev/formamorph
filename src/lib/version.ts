import type { World, SaveObject, Stat, GameState, Trait, PlayerStat } from '@/types';
import { normalizeCustomVRM } from './worldImport';
import { autoBindLegacyBodyStats } from './bodyMorphs';
import { realignLegacyStateHistory } from './turnHistory';

/** Current app version, derived from package.json (see vite.config.js `define`). User-managed. */
export const APP_VERSION = __APP_VERSION__;

/** The era of pre-2.0 files: worlds had no `version`; saves used the numeric `version: 2`. */
export const LEGACY_VERSION = '1.2';

/** Optional self-identifying tag stamped on exported files. `dictionary` (see `dictionaryFile.ts`) is
 *  load-bearing; `world`/`save` are additive labels — import still works without them (structural
 *  detection stays authoritative), they just enable friendlier "wrong file" messages. */
export const WORLD_FILE_KIND = 'world';
export const SAVE_FILE_KIND = 'save';

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

/** Copy a trait's single legacy `description` — which v1.2 showed to both player and AI — into both
 *  `playerDescription` and `aiDescription` (idempotent, prefers an already-present new key). */
function renameTraitDescriptions(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((it) => {
    if (!it || typeof it !== 'object' || !('description' in it)) return it;
    const { description, ...rest } = it as Record<string, unknown>;
    return {
      ...rest,
      playerDescription: rest.playerDescription ?? description,
      aiDescription: rest.aiDescription ?? description,
    };
  });
}

/**
 * Fold the legacy flat `dictionary` into a single "Default" book (`dictionaries`). Idempotent: if
 * `dictionaries` already exists it is kept (and any stray `dictionary` dropped); otherwise the old
 * entries — positions preserved — become one enabled "Default" book. Always leaves at least one book.
 * This shape change is deliberately NOT version-gated: shipped 2.x worlds carry `version === APP_VERSION`
 * yet predate the book model, so the fold must also run on already-current worlds.
 */
function foldDictionaryIntoBooks(world: Record<string, unknown>): void {
  if (Array.isArray(world.dictionaries)) {
    delete world.dictionary; // drop a stray legacy key if both somehow present
    if ((world.dictionaries as unknown[]).length === 0) {
      world.dictionaries = [{ id: crypto.randomUUID(), name: 'Default', enabled: true, entries: [] }];
    }
    return;
  }
  const entries = Array.isArray(world.dictionary) ? world.dictionary : [];
  world.dictionaries = [{ id: crypto.randomUUID(), name: 'Default', enabled: true, entries }];
  delete world.dictionary;
}

/**
 * Bring an imported world up to the current format and stamp it with `APP_VERSION`. The dictionary→books
 * fold runs unconditionally (it isn't version-gated — see `foldDictionaryIntoBooks`); the rest is skipped
 * for a world already at `APP_VERSION`. Moves the legacy root `customPlayerVRM` bare data-URL into
 * `worldOverview.customPlayerVRM` as a `MediaAsset`, auto-binds legacy body stats to body morphs, and
 * renames v1.2 description keys on entities/locations/traits to the audience-based keys. Remaining field
 * defaults are left to `loadWorldData`. Add further 2.0 → 2.x steps here when the shape changes — a version
 * bump is the user's call (see the export-shape-versioning note); shipped worlds are only reshaped through
 * this load-time path, never autonomously re-persisted.
 */
export function migrateWorld(raw: unknown): World {
  const world = { ...(raw as Record<string, unknown>) };
  foldDictionaryIntoBooks(world);
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

  // v1.2 traits had a single `description` read by both player and AI; copy it to both new keys.
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

/**
 * Bring one v1.2 save snapshot's frozen field copies up to the current shape. A save stores its own copies
 * of the player's traits and stats: traits still keyed by the single legacy `description` (the trait
 * context builder reads `aiDescription`, so without this they reach the AI as bare names), and body stats
 * (Stomach/Fatness/Breastsize) with no `morphBindings` (so they don't drive the VRM). Mirrors the matching
 * `migrateWorld` steps, applied to the save copies. Idempotent — the rename prefers an existing new key and
 * the bind skips a stat that already carries `morphBindings`. Other legacy quirks (`game_text` narration,
 * absent `discoveredEntities`) are already normalized on read (parseTurnContent / loadGameState's `?? []`).
 */
export function migrateLegacySaveState(state: GameState): GameState {
  const next = { ...state };
  if (Array.isArray(next.playerTraits)) {
    // renameTraitDescriptions returns loosened records; the shape matches Trait (new keys added, legacy
    // `description` dropped), so cast back.
    next.playerTraits = renameTraitDescriptions(next.playerTraits) as unknown as Trait[];
  }
  if (Array.isArray(next.playerStats)) {
    // autoBindLegacyBodyStats preserves each stat's value, so the (narrower) PlayerStat shape is intact.
    next.playerStats = autoBindLegacyBodyStats(next.playerStats) as unknown as PlayerStat[];
  }
  return next;
}

/**
 * Migrate a whole v1.2 save envelope to the current shape and stamp it with `APP_VERSION` — the single path
 * both the file-import boundary and the load path run, so they can't drift. Legacy is detected by the
 * numeric `version` (v1.2 stamped `2`); a save already carrying a string version has the current shape and
 * is returned untouched. Migrates the field copies on every snapshot (currentState + history), then
 * realigns the off-by-one, one-slot-short state history. Pure — callers decide whether to persist the
 * result (import) or just load it (load).
 */
export function migrateSave(save: SaveObject): SaveObject {
  if (typeof save.version !== 'number') return save;
  const currentState = migrateLegacySaveState(save.currentState);
  const stateHistory = realignLegacyStateHistory(save.stateHistory.map(migrateLegacySaveState), currentState);
  return { ...save, currentState, stateHistory, version: APP_VERSION };
}
