import type { Stat, Trait, Entity, Dictionary } from './world';
import type { ChatMessage } from './ai';

/** A director-invented character promoted to a persisted, per-playthrough entity (runtime characters,
 *  Slice 2). Save-only: it rolls back with the turn and is never written to the world export. */
export interface DiscoveredEntity {
  entity: Entity;
  /** The location where the character appeared, so it joins that location's roster. */
  locationId?: string;
  /** The turn that first materialized it, for description generation / provenance. */
  sourceTurnId: string;
}

/** A stat during gameplay — a definition Stat whose live `value` is always a number. */
export type PlayerStat = Omit<Stat, 'value'> & { value: number };

/** One row of the live scene list (the Entities tab): who is physically present this turn. `name` is the
 *  real entity name (resolves the portrait) or an ad-hoc/invented name. `alias` is how the player currently
 *  knows a not-yet-named character; it is shown instead of `name` while `revealed` is false. `revealed`
 *  flips true once the real name has appeared in the narration. */
export interface SceneEntity {
  name: string;
  alias?: string;
  revealed: boolean;
}

/** A choice is a single plaintext action line. */
export type Choice = string;

/** One entry in the play log; `repeat` counts consecutive identical entries collapsed into one.
 *
 *  `kind` separates things that happened in the story from things that happened to the app: only a
 *  world entry gets an in-world timestamp, because stamping "Game saved" with a story date claims the
 *  save dialog happened at seven in the evening. Absent on pre-split saves, where everything was stamped
 *  anyway — so undefined reads as `world` and those saves render unchanged. */
export interface LogEntry {
  text: string;
  gameTime: number;
  repeat: number;
  kind?: 'world' | 'system';
}

/** A VRM hair variant: its morph shapekey and whether length is adjustable. */
export interface HairTypeDef {
  shapekey: string;
  canChangeLength: boolean;
}

/** The player character's appearance customization applied to the VRM model. */
export interface CharacterData {
  /** Chosen body-morph influences, keyed by the model's morph name. The value is the absolute morph
   *  influence written to three.js (0 = off, 1 = the model's authored full shape); the customization
   *  slider's range is only a UI clamp, so it can change without touching this stored meaning. Auto-derived
   *  per model, so any morph the model exposes is adjustable — nothing is hardcoded to a fixed field. */
  bodyMorphs: Record<string, number>;
  /** Colors are present only if the player actually changed them; otherwise the model keeps its own. */
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  /** Colors for extra materials (clothing, accessories, …), keyed by material name. */
  extraColors?: Record<string, string>;
  currentHairStyle: string;
  hairLength: number;
  hairTypes?: Record<string, HairTypeDef>;
  /**
   * Which VRM the player picked: a local model-library id, `'default'` (bundled model),
   * or unset/`'world'` (the world's `customPlayerVRM`, else the bundled default).
   */
  playerModelId?: string;
}

/** The stored payload of a library VRM: the file itself plus what we know about it. The `id`, display name,
 *  and library timestamps live on the wrapping record, as with dictionaries and characters. */
export interface VrmData {
  type: string;
  blob: Blob;
  size: number;
  /** Portrait as a data URL: the file's embedded thumbnail, else one rendered on first view. */
  thumbnail?: string;
  /** Absent on records stored before the library read metadata; resolved lazily, then kept. */
  license?: VrmLicense;
  /** Content hash for duplicate detection. Absent on records stored before hashing existed. */
  hash?: string;
  /** Set once a thumbnail render has been attempted and produced nothing, so it isn't retried every view. */
  thumbnailFailed?: boolean;
}

/**
 * A VRM's embedded rights metadata, normalized across the two incompatible VRM meta schemas (0.0's
 * `licenseName`/`commercialUssageName` enums and 1.0's booleans). Every field is optional because VRM 0.0
 * makes them all optional and a plain `.glb` carries none — absent means unknown, never "permitted".
 */
export interface VrmLicense {
  /** `null` when the file carries no VRM meta at all, i.e. a plain glTF. */
  metaVersion: '0' | '1' | null;
  title?: string;
  authors?: string[];
  /** VRM 0.0's license enum, e.g. `CC_BY_NC`. VRM 1.0 has no equivalent and leaves this unset. */
  licenseName?: string;
  licenseUrl?: string;
  allowRedistribution?: boolean;
  commercialUse?: 'allow' | 'disallow' | 'personalNonProfit' | 'personalProfit' | 'corporation';
  creditRequired?: boolean;
}

/** Lightweight preview record for the model library grid and the character-model picker. Carries no blob, so
 *  the grid can render without holding every model's bytes. */
export interface ModelMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  thumbnail?: string;
  license?: VrmLicense;
  createdAt?: string;
  lastAccessed?: string;
}

/** One saved snapshot of a play session (see GameplayContext.saveCurrentGameState). */
export interface GameState {
  playerStats: PlayerStat[];
  playerTraits: Trait[];
  /** The live scene list — who is physically present this turn, with alias/reveal state for the tab. Legacy
   *  saves stored a bare `string[]` of names; those are normalized to `{ name, revealed: true }` on load. */
  visibleEntities: SceneEntity[];
  /** Director-invented characters promoted to persisted entities this playthrough (runtime characters). */
  discoveredEntities?: DiscoveredEntity[];
  /** Names the player deleted from the discovered cast. Removal alone would be whack-a-mole — the next
   *  turn naming them re-promotes them — so a deletion is remembered and blocks every discovery path.
   *  Absent on saves written before the feature, which correctly reads as "nothing suppressed". */
  suppressedCharacterNames?: string[];
  logEntries: LogEntry[];
  gameplayText: string;
  locationId?: string;
  gameTime: number;
  /** Hour of day the story opened at, as read from the first narration by the opening-time pass. Every
   *  clock reading is `gameTime` measured from here, so a midnight ritual no longer reports as morning.
   *  Absent whenever the pass was off, failed, or the save predates it — absent reads as the shipped
   *  `DEFAULT_START_HOUR`, which is exactly how the game behaved before. Never re-asked for an existing
   *  save: a retroactive answer would shift every memory stamp already written. */
  startHour?: number;
  /** A snapshot's own copy of the flat chat history. Live `currentState` carries it in memory, but it is
   *  stripped from persisted snapshots — the canonical history lives once at `SaveObject.messageHistory`.
   *  Absent on migrated/persisted snapshots; present on the in-memory current state. */
  fullMessageHistory?: ChatMessage[];
  characterData: CharacterData | null;
  choices: Choice[];
  isGameStarted: boolean;
  timestamp: string;
  worldName: string | null;
  playerNotes: string;
  previousStateIndex: number | null;
  stateVersion: number;
  /** Present only in legacy nested saves; flattened by the conversion worker. */
  gameStates?: GameState[];
}

/** Versioned save-file envelope persisted to IndexedDB (version 2). */
export interface SaveObject {
  currentState: GameState;
  stateHistory: GameState[];
  /** The single canonical flat chat history for the whole save. Snapshots no longer each embed a copy
   *  (that was O(N²) on disk); the live narration/rollback path slices this. Absent on pre-2.2 saves →
   *  `migrateSave` hoists it from the current snapshot's `fullMessageHistory`. */
  messageHistory?: ChatMessage[];
  /** Legacy envelopes used the numeric `2` (≙ v1.2); current saves stamp the `APP_VERSION` string. */
  version: string | number;
  /** v2.x: the dictionary set chosen at world entry (reordered/toggled books, plus any added library
   *  dictionaries). Absent on older saves → loaders keep the world's current dictionaries. */
  dictionaries?: Dictionary[];
  /** Stable id of the world this save belongs to (`WorldOverview.id`), for grouping saves into per-world
   *  folders. Absent on saves written before folders — those fall back to matching by `worldName`. */
  worldId?: string;
  /** Frozen placeholder rolls for this playthrough (see lib/placeholders). `world` keys by placeholder id
   *  (one shared value across every World chip); `unique` keys by placement id (a per-spot value). Written
   *  lazily on first resolution; absent ⇒ nothing rolled yet. Variables need no roll. */
  placeholderRolls?: PlaceholderRolls;
  /** v2.x milestone memory: the player's memory pins, keyed by turn id — 'keep' force-holds that turn's
   *  digest in long-term memory, 'drop' force-removes it. Absent (or empty) on older saves ⇒ no pins;
   *  the AI selection itself is derived state and is never persisted. */
  memoryPins?: Record<string, 'keep' | 'drop'>;
  /** v2.x incremental milestone memory: the selector's accumulated verdicts — which candidate turn
   *  ids it has judged (`seen`) and which of those it kept (`selected`; null = a legacy malformed
   *  full-vote, treated as keep-everything-seen). Absent on older saves ⇒ the loaded history is
   *  judged fresh in one incremental batch. */
  milestoneSelection?: { seen: string[]; selected: string[] | null };
  /** v2.x memory editing: the player's rewrites, keyed by turn id. `source` separates a hand-written
   *  rewrite (intent — force-kept and top-ranked) from a regeneration (fresher AI text under the usual
   *  verdict). The turn's own `summary` is never overwritten, so clearing an edit restores the original.
   *  Absent (or empty) on older saves ⇒ no rewrites. */
  memoryEdits?: Record<string, { text: string; source: 'player' | 'ai' }>;
  /** v2.x memory editing: tombstoned memories — turn ids and manual-memory ids the player removed. A
   *  tombstone hides the memory and keeps it out of context everywhere, but the underlying summary
   *  survives, so it is restorable. Absent (or empty) on older saves ⇒ nothing deleted. */
  memoryDeleted?: string[];
  /** Scene images by turn id (data URLs), written only when the player opts in on the Save dialog — one
   *  image is over a megabyte. Kept out of the messages on purpose: everything that walks the history
   *  parses those, and a megabyte in one made the narration reveal crawl (see lib/sceneImages). */
  sceneImages?: Record<string, string[]>;
  /** v2.x memory editing: memories the player wrote by hand. `anchorTurn` is the message-history length
   *  at creation, which places the note chronologically among the digests. Never judged by the selector —
   *  a player-written memory rides until deleted. Absent (or empty) on older saves ⇒ none. */
  memoryNotes?: Array<{ id: string; text: string; anchorTurn: number }>;
}

/** Per-playthrough Wildcard rolls, frozen in the save. */
export interface PlaceholderRolls {
  world?: Record<string, string>;
  unique?: Record<string, string>;
}

/** A save as persisted in IndexedDB: the envelope plus the stable record `id` (store keyPath) and the
 *  save's display `name`. `id` is device-local — stripped from the exported `.json`, re-minted on import. */
export interface SaveRecord extends SaveObject {
  id: string;
  name: string;
  /** Device-local: marks the per-world autosave slot (one per world, overwritten each turn). Like `id`, it's
   *  stripped from the exported `.json` — a downloaded autosave re-imports as an ordinary manual save. */
  isAutosave?: boolean;
}

/** v1.2.0: client-side community-browser hide preferences (persisted in localStorage). */
export interface HiddenWorldsPrefs {
  worldIds: string[];
  tags: string[];
}
