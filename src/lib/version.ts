import { randomUUID } from "@/lib/uuid";
import type { World, SaveObject, Stat, GameState, Trait, PlayerStat } from '@/types';
import { normalizeCustomVRM } from './worldImport';
import { autoBindLegacyBodyStats } from './bodyMorphs';
import { appendCurrentToHistory } from './turnHistory';
import { DEFAULT_MODEL_ID, LEGACY_DEFAULT_MODEL_SENTINEL } from './defaultModel';
import { migrateEntityImages } from './entityImages';

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
      world.dictionaries = [{ id: randomUUID(), name: 'Default', enabled: true, entries: [] }];
    }
    return;
  }
  const entries = Array.isArray(world.dictionary) ? world.dictionary : [];
  world.dictionaries = [{ id: randomUUID(), name: 'Default', enabled: true, entries }];
  delete world.dictionary;
}

/**
 * Fold every entity's legacy single `image` into the `images` gallery. Deliberately NOT version-gated, for
 * the same reason as `foldDictionaryIntoBooks`: shipped 2.x worlds carry `version === APP_VERSION` yet
 * predate the gallery, so this must also run on already-current worlds.
 */
function migrateEntityGalleries(world: Record<string, unknown>): void {
  if (!Array.isArray(world.entities)) return;
  world.entities = world.entities.map((e) =>
    e && typeof e === 'object' ? migrateEntityImages(e as Record<string, unknown>) : e,
  );
}

/** Split a legacy comma-joined keyword string into the array shape. */
function splitLegacyKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((k) => String(k)).filter(Boolean);
  return typeof raw === 'string' ? raw.split(',').map((k) => k.trim()).filter(Boolean) : [];
}

/**
 * Move one entry's `key`/`secondaryKeys` from the legacy comma-joined strings to arrays, so a keyword may
 * contain any character (regex patterns need commas). Idempotent — an entry already carrying arrays passes
 * through untouched. Returns the same reference when nothing changed. `secondaryKeys` stays optional: an
 * empty result drops the field rather than storing `[]`.
 */
export function migrateEntryKeys<T extends { key?: unknown; secondaryKeys?: unknown }>(entry: T): T {
  const keyIsArray = Array.isArray(entry.key);
  const secIsArray = entry.secondaryKeys === undefined || Array.isArray(entry.secondaryKeys);
  if (keyIsArray && secIsArray) return entry;
  const secondary = splitLegacyKeys(entry.secondaryKeys);
  const next = { ...entry, key: splitLegacyKeys(entry.key) } as T & { secondaryKeys?: string[] };
  if (secondary.length) next.secondaryKeys = secondary;
  else delete next.secondaryKeys;
  return next;
}

/**
 * Migrate every entry of every book to the array-keyword shape. Deliberately NOT version-gated for the same
 * reason as `foldDictionaryIntoBooks`: shipped 2.x worlds carry `version === APP_VERSION` yet predate the
 * change, so this must also run on already-current worlds.
 */
function migrateDictionaryKeys(world: Record<string, unknown>): void {
  if (!Array.isArray(world.dictionaries)) return;
  world.dictionaries = world.dictionaries.map((book) => {
    const b = book as Record<string, unknown>;
    if (!Array.isArray(b.entries)) return book;
    return { ...b, entries: b.entries.map((e) => migrateEntryKeys(e as Record<string, unknown>)) };
  });
}

/**
 * Retype a stat carrying the removed `list` type as a plain number. Upstream v1.1 defined the type but no
 * runtime path ever consumed it — its array `value` reached gameplay as `NaN` — so the items are dropped
 * and the stat starts at its floor. Idempotent; returns the same reference for anything already numeric.
 */
function coerceLegacyListStats(stats: readonly Stat[]): Stat[] {
  return stats.map((stat) => {
    const isList = (stat.type as string) === 'list' || Array.isArray(stat.value);
    if (!isList) return stat;
    return { ...stat, type: 'number', value: stat.min ?? 0 };
  });
}

/**
 * Bring an imported world up to the current format and stamp it with `APP_VERSION`. The dictionary→books
 * fold, the keyword-array migration and the entity-gallery fold run unconditionally (they aren't
 * version-gated — see `foldDictionaryIntoBooks`); the rest is skipped for a world already at `APP_VERSION`. Moves the legacy root `customPlayerVRM` bare data-URL into
 * `worldOverview.customPlayerVRM` as a `MediaAsset`, auto-binds legacy body stats to body morphs, and
 * renames v1.2 description keys on entities/locations/traits to the audience-based keys. Remaining field
 * defaults are left to `loadWorldData`. Add further 2.0 → 2.x steps here when the shape changes — a version
 * bump is the user's call (see the export-shape-versioning note); shipped worlds are only reshaped through
 * this load-time path, never autonomously re-persisted.
 */
export function migrateWorld(raw: unknown): World {
  const world = { ...(raw as Record<string, unknown>) };
  foldDictionaryIntoBooks(world);
  migrateDictionaryKeys(world);
  migrateEntityGalleries(world);
  if (world.version === APP_VERSION) return world as unknown as World;

  const overview = { ...((world.worldOverview as Record<string, unknown>) ?? {}) };
  overview.customPlayerVRM = normalizeCustomVRM(overview.customPlayerVRM ?? world.customPlayerVRM);
  world.worldOverview = overview;
  delete world.customPlayerVRM; // drop the stray v1.2 root key

  if (Array.isArray(world.stats)) {
    world.stats = autoBindLegacyBodyStats(coerceLegacyListStats(world.stats as Stat[]));
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
 * `migrateWorld` steps, applied to the save copies. Also stamps an empty `discoveredEntities` (a v2-only
 * field absent in v1.2) so every persisted snapshot carries it, not just the one `loadGameState` defaults
 * on read. Idempotent — the rename prefers an existing new key, the bind skips a stat that already carries
 * `morphBindings`, and the stamp leaves an existing array untouched. (`game_text` narration is normalized
 * separately on read by parseTurnContent.)
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
  if (!Array.isArray(next.discoveredEntities)) next.discoveredEntities = [];
  return next;
}

/** Drop a snapshot's own `fullMessageHistory` copy — the canonical history lives once at
 *  `SaveObject.messageHistory`. Returns the same reference when there's nothing to strip (idempotent). */
export function stripSnapshotHistory(state: GameState): GameState {
  if (state.fullMessageHistory === undefined) return state;
  const { fullMessageHistory: _drop, ...rest } = state;
  return rest as GameState;
}

/**
 * Point a snapshot's player model at the seeded library record instead of the old `'default'` sentinel. The
 * bundled model is an ordinary library entry now, so the sentinel has no referent; every other value —
 * a library id, `'world'`, or unset — is already meaningful and passes through.
 */
function migrateDefaultModelId(state: GameState): GameState {
  const character = state?.characterData;
  if (!character || character.playerModelId !== LEGACY_DEFAULT_MODEL_SENTINEL) return state;
  return { ...state, characterData: { ...character, playerModelId: DEFAULT_MODEL_ID } };
}

/** The legacy fixed body fields, before they were folded into the generic `bodyMorphs` map. */
type LegacyCharacterBody = {
  bodyShape?: { pear?: number; apple?: number; hourglass?: number };
  bellySize?: number;
  breastsSize?: number;
  bodyWeight?: number;
};

/** Legacy fixed body field → the morph name it drove. */
const LEGACY_BODY_MORPHS: Array<[keyof Omit<LegacyCharacterBody, 'bodyShape'>, string]> = [
  ['bellySize', 'Belly'],
  ['bodyWeight', 'Fat'],
  ['breastsSize', 'Breasts'],
];
const LEGACY_SHAPE_MORPHS: Array<[keyof NonNullable<LegacyCharacterBody['bodyShape']>, string]> = [
  ['pear', 'B_Pear'],
  ['hourglass', 'B_HourGlass'],
  ['apple', 'B_Apple'],
];

/**
 * Fold a legacy character's fixed body fields (`bellySize`/`bodyWeight`/`breastsSize` and the `bodyShape`
 * trio) into the generic `bodyMorphs` map, keyed by the morph each drove. Presence-based and idempotent: a
 * character already carrying `bodyMorphs` is returned untouched. Only nonzero values are carried (0 = off =
 * absent), and the old fields are dropped from the result. The stored numbers are unchanged — they were
 * already raw morph influences — so the map renders identically to the old fixed fields.
 */
function migrateBodyMorphs(state: GameState): GameState {
  const character = state?.characterData as (typeof state.characterData & LegacyCharacterBody) | null;
  if (!character || character.bodyMorphs) return state;
  const bodyMorphs: Record<string, number> = {};
  for (const [field, morph] of LEGACY_BODY_MORPHS) {
    const v = character[field];
    if (typeof v === 'number' && v !== 0) bodyMorphs[morph] = v;
  }
  for (const [field, morph] of LEGACY_SHAPE_MORPHS) {
    const v = character.bodyShape?.[field];
    if (typeof v === 'number' && v !== 0) bodyMorphs[morph] = v;
  }
  const { bodyShape: _s, bellySize: _b, breastsSize: _br, bodyWeight: _w, ...rest } = character;
  return { ...state, characterData: { ...rest, bodyMorphs } };
}

/**
 * Migrate a save envelope to the current shape — the single path both the file-import boundary and the load
 * path run, so they can't drift. Three concerns, each idempotent:
 *   1. Legacy field migration (numeric `version: 2` ≙ v1.2): migrate trait/stat/discovered copies on every
 *      snapshot, realign the one-slot-short state history (append current), and re-stamp `APP_VERSION`.
 *   2. Storage cleanup (presence-based, every envelope): hoist the one canonical flat history to top-level
 *      `messageHistory` and strip the per-snapshot `fullMessageHistory` copies. Old saves (any version) carry
 *      the history on `currentState`; already-migrated saves already have `messageHistory` and stripped
 *      snapshots, so this is a no-op for them.
 *   3. Player model (presence-based, every envelope): rewrite the `'default'` sentinel to the seeded model's
 *      library id. A save that never used it is untouched, and a rewritten one no longer matches.
 *   4. Body morphs (presence-based, every snapshot): fold the legacy fixed body fields into the generic
 *      `bodyMorphs` map. A character already carrying the map is untouched.
 * The appended current page stays `=== currentState`, so `gameStates[page - 1]` resolves the current page
 * identically. Pure — callers decide whether to persist the result (import) or just load it (load).
 */
export function migrateSave(save: SaveObject): SaveObject {
  const isLegacy = typeof save.version === 'number';
  const migratedCurrent = isLegacy ? migrateLegacySaveState(save.currentState) : save.currentState;
  const migratedHistory = isLegacy ? save.stateHistory.map(migrateLegacySaveState) : save.stateHistory;
  // Canonical flat history: an already-hoisted top-level copy, else the current snapshot's own copy.
  const messageHistory = save.messageHistory ?? migratedCurrent.fullMessageHistory ?? [];
  const normalizeSnapshot = (s: GameState) => migrateBodyMorphs(migrateDefaultModelId(s));
  const currentState = normalizeSnapshot(stripSnapshotHistory(migratedCurrent));
  const history = isLegacy
    ? appendCurrentToHistory(migratedHistory.map(stripSnapshotHistory), currentState)
    : migratedHistory.map(stripSnapshotHistory);
  const stateHistory = history.map(normalizeSnapshot);
  // The save carries its own copy of the playthrough's books, so it needs the keyword-array migration too —
  // ungated for the same reason as the world's (a save stamped APP_VERSION can still predate the change).
  const dictionaries = save.dictionaries?.map((book) => ({
    ...book,
    entries: (book.entries ?? []).map(migrateEntryKeys),
  }));
  return {
    ...save,
    currentState,
    stateHistory,
    messageHistory,
    ...(dictionaries ? { dictionaries } : {}),
    version: isLegacy ? APP_VERSION : save.version,
  };
}
