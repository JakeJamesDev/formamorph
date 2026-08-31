import { randomUUID } from "@/lib/uuid";
import type {
  World, SaveObject, Stat, GameState, Trait, PlayerStat, Connection, GameLocation, Placeholder, PlaceholderValue,
} from '@/types';
import { implicitPairs, pairKey } from './locationGraph';
import { normalizeCustomVRM } from './worldImport';
import { autoBindLegacyBodyStats } from './bodyMorphs';
import { appendCurrentToHistory } from './turnHistory';
import { DEFAULT_AVATAR_ID, LEGACY_DEFAULT_AVATAR_ID, LEGACY_DEFAULT_AVATAR_SENTINEL } from './defaultAvatar';
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

/**
 * Flip location-owned presence to entity-owned membership (ADR-0003): every id a location listed becomes a
 * location id on that entity, and the location-side list is dropped. Reads both the current `entities` key
 * and the pre-audience-split `entity` alias, which migration never folded. Ids naming no entity are dropped
 * rather than carried — the AI feed already skipped them, and an entity-side list has nowhere to put them.
 *
 * Idempotent: a world whose locations no longer carry a roster contributes nothing, so a second run leaves
 * the memberships exactly as the first left them. Deliberately NOT version-gated, for the same reason as
 * `foldDictionaryIntoBooks`: shipped 2.x worlds carry `version === APP_VERSION` yet predate the flip.
 */
function flipEntityLocationMembership(world: Record<string, unknown>): void {
  // Both arrays are required before anything is stripped: a world with rosters but no entities array has
  // nowhere to move them to, and stripping first would delete the only copy.
  if (!Array.isArray(world.locations) || !Array.isArray(world.entities)) return;
  const membership = new Map<string, string[]>();
  world.locations = world.locations.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const { entities, entity, ...rest } = raw as Record<string, unknown> & { id?: string };
    const listed = [...(Array.isArray(entities) ? entities : []), ...(Array.isArray(entity) ? entity : [])];
    if (rest.id) {
      for (const id of listed) {
        if (typeof id !== 'string') continue;
        const at = membership.get(id) ?? [];
        at.push(rest.id);
        membership.set(id, at);
      }
    }
    return rest;
  });
  if (membership.size === 0) return;
  world.entities = world.entities.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const e = raw as Record<string, unknown> & { id?: string; locations?: unknown };
    const added = e.id ? membership.get(e.id) ?? [] : [];
    if (added.length === 0) return raw;
    const existing = Array.isArray(e.locations) ? (e.locations as string[]) : [];
    return { ...e, locations: [...new Set([...existing, ...added])] };
  });
}

/**
 * Convert the legacy per-location `connections` name lists into world-level Connection records (ADR-0002),
 * pair-merged: a pair each side declared becomes one two-way record, a pair only one side declared becomes a
 * one-way record from the declaring end, and a name matching no location is dropped (it reached nowhere
 * before, and a record needs two real endpoints). Names match case-insensitively on the trimmed name, the
 * same way the old destinations builder resolved them, so effective navigation is unchanged by the move —
 * which is also why a one-sided declaration between tree-adjacent locations is recorded two-way (see below).
 *
 * Idempotent: a world whose locations no longer carry name lists produces no records and leaves the existing
 * `connections` array alone. Deliberately NOT version-gated, for the same reason as `foldDictionaryIntoBooks`:
 * shipped 2.x worlds carry `version === APP_VERSION` yet predate the records.
 */
function migrateLocationConnections(world: Record<string, unknown>): void {
  if (!Array.isArray(world.locations)) return;
  const byLowerName = new Map<string, string>();
  for (const raw of world.locations) {
    const loc = raw as { id?: unknown; name?: unknown } | null;
    if (loc && typeof loc.id === 'string' && typeof loc.name === 'string') {
      byLowerName.set(loc.name.trim().toLowerCase(), loc.id);
    }
  }
  // Declared direction pairs, keyed by ordered `from|to`, so the reciprocal lookup is one probe per name.
  const declared = new Set<string>();
  world.locations = world.locations.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const { connections, ...rest } = raw as Record<string, unknown> & { id?: string };
    if (!Array.isArray(connections)) return raw; // nothing to move — keep the reference
    if (typeof rest.id === 'string') {
      for (const name of connections) {
        if (typeof name !== 'string') continue;
        const to = byLowerName.get(name.trim().toLowerCase());
        if (to && to !== rest.id) declared.add(`${rest.id}|${to}`);
      }
    }
    return rest;
  });
  if (declared.size === 0) return;
  // Pairs the containment tree already linked. A record replaces that link (ADR-0002), so a one-sided
  // declaration between two such locations has to be recorded two-way or the *other* end silently loses a
  // trip it used to have for free — the migration would narrow navigation the author never narrowed.
  const implicit = new Set(implicitPairs(world.locations as GameLocation[]).map(([a, b]) => pairKey(a, b)));
  const records: Connection[] = [];
  const done = new Set<string>();
  for (const key of declared) {
    if (done.has(key)) continue;
    const [from, to] = key.split('|');
    const reciprocal = `${to}|${from}`;
    done.add(key);
    done.add(reciprocal);
    records.push({
      id: randomUUID(),
      from,
      to,
      twoWay: declared.has(reciprocal) || implicit.has(pairKey(from, to)),
    });
  }
  const existing = Array.isArray(world.connections) ? (world.connections as Connection[]) : [];
  world.connections = [...existing, ...records];
}

/**
 * Move the pre-rebuild `isStartLocation` flag onto the live `isStarting` field. The rebuild implemented the
 * feature under a new name without knowing the old one, so worlds authored in 1.x reach us with their start
 * intent in a field nothing reads — a new game then picks any location at random. Every truthy leftover
 * becomes a start candidate (the feature has always allowed several), and the field is dropped either way.
 *
 * A location already flagged `isStarting` means the world has been touched since the rename, so its author's
 * choice stands and the leftovers are only deleted — promoting them would re-add candidates that author
 * didn't pick. Idempotent: nothing carries the field after a run. Deliberately NOT version-gated, for the
 * same reason as `foldDictionaryIntoBooks`: shipped 2.x worlds carry `version === APP_VERSION` yet can still
 * hold the flag, since nothing stripped it before now.
 */
function migrateStartLocationFlag(world: Record<string, unknown>): void {
  if (!Array.isArray(world.locations)) return;
  const locations = world.locations as Array<Record<string, unknown>>;
  if (!locations.some((l) => l && typeof l === 'object' && 'isStartLocation' in l)) return;
  const hasLiveStart = locations.some((l) => l && typeof l === 'object' && l.isStarting);
  world.locations = locations.map((raw) => {
    if (!raw || typeof raw !== 'object' || !('isStartLocation' in raw)) return raw;
    const { isStartLocation: legacy, ...rest } = raw;
    return legacy && !hasLiveStart ? { ...rest, isStarting: true } : rest;
  });
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
 * Convert one placeholder's `values` from the legacy list of strings to the list of `{ id, text }` records,
 * rekeying its weight map from value text to the id each text was minted under. Idempotent by element type:
 * a value already carrying a record passes through with its id, so a second run is a no-op and a
 * half-converted list (hand-edited world JSON) converts only the strings in it. A *text* key naming no value
 * is dropped at the conversion — its key space is gone, so nothing could read it again — while an
 * already-id-keyed map is left exactly as written, dead keys and all.
 */
function migratePlaceholderValues(ph: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(ph.values)) return ph;
  const isRecord = (v: unknown): v is PlaceholderValue =>
    !!v && typeof v === 'object' && typeof (v as PlaceholderValue).id === 'string'
    && typeof (v as PlaceholderValue).text === 'string';
  // A list that is already all records has an already-id-keyed map, so there is nothing to convert — and
  // rekeying it anyway would drop the weights naming no value, quietly repairing the exact condition the
  // Bench's `placeholder-weight-unknown-value` rule exists to report.
  if (ph.values.every(isRecord)) return ph;
  const values: PlaceholderValue[] = ph.values.map((v) =>
    (isRecord(v) ? v : { id: randomUUID(), text: typeof v === 'string' ? v : String(v ?? '') }));
  const next: Record<string, unknown> = { ...ph, values };
  const weights = ph.weights;
  if (!weights || typeof weights !== 'object') return next;
  // Keyed by text before, by id now. A text naming two values cannot exist — the editors collapse repeats —
  // so the first match is the only match.
  const byText = new Map(values.map((v) => [v.text, v.id]));
  const live = new Set(values.map((v) => v.id));
  const rekeyed: Record<string, number> = {};
  for (const [key, w] of Object.entries(weights as Record<string, unknown>)) {
    if (typeof w !== 'number') continue;
    const id = live.has(key) ? key : byText.get(key);
    if (id) rekeyed[id] = w;
  }
  if (Object.keys(rekeyed).length) next.weights = rekeyed;
  else delete next.weights;
  return next;
}

/**
 * Give every placeholder's values their stable ids. Deliberately NOT version-gated, for the same reason as
 * `foldDictionaryIntoBooks`: shipped 2.x worlds carry `version === APP_VERSION` yet predate the records.
 */
function migrateWorldPlaceholders(world: Record<string, unknown>): void {
  if (!Array.isArray(world.placeholders)) return;
  world.placeholders = world.placeholders.map((ph) =>
    (ph && typeof ph === 'object' ? migratePlaceholderValues(ph as Record<string, unknown>) : ph));
}

/** {@link migratePlaceholderValues} over a carried def list — what an entity card or a dictionary file
 *  brings with it, which never passes through `migrateWorld`. */
export function migrateCarriedPlaceholders(raw: unknown): Placeholder[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((ph) =>
    (ph && typeof ph === 'object' ? migratePlaceholderValues(ph as Record<string, unknown>) : ph)) as Placeholder[];
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
 * fold, the keyword-array migration, the entity-gallery fold, the entity-location flip, the
 * connection-record pair-merge, the start-flag rename and the placeholder value-record conversion run
 * unconditionally (they aren't
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
  flipEntityLocationMembership(world);
  migrateLocationConnections(world);
  migrateStartLocationFlag(world);
  migrateWorldPlaceholders(world);
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
 * Point a snapshot's player avatar at the seeded library record, from either older value: the pre-library
 * `'default'` sentinel, which has no referent now that the bundled avatar is an ordinary library entry, and
 * the `'default-model'` id it was seeded under before the library was renamed to avatars. Every other
 * value — a library id, `'world'`, or unset — is already meaningful and passes through.
 */
const LEGACY_DEFAULT_AVATAR_VALUES: readonly string[] = [LEGACY_DEFAULT_AVATAR_SENTINEL, LEGACY_DEFAULT_AVATAR_ID];

function migrateDefaultAvatarId(state: GameState): GameState {
  const character = state?.characterData;
  const current = character?.playerModelId;
  if (!character || !current || !LEGACY_DEFAULT_AVATAR_VALUES.includes(current)) return state;
  return { ...state, characterData: { ...character, playerModelId: DEFAULT_AVATAR_ID } };
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
  const normalizeSnapshot = (s: GameState) => migrateBodyMorphs(migrateDefaultAvatarId(s));
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
