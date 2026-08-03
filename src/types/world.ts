import type { ChatMessage } from './ai';

/** A base64 data-URL string, e.g. "data:image/png;base64,...". */
export type Base64Data = string;

/** Uploaded media with its MIME type (entity sound/model, location ambient sound, custom VRM). */
export interface MediaAsset {
  data: Base64Data;
  type: string;
  /** Original filename — the most reliable format hint, since browsers report MIME inconsistently. */
  name?: string;
  size?: number;
}

/** A scalar `number` stat, a `percentage` stat (a number pinned to 0–100, displayed as `N%`), or a `list`
 *  stat whose value is an array of items. */
export type StatType = 'number' | 'percentage' | 'list';

/** A text label surfaced to the AI once the stat's value crosses `threshold`. */
export interface StatDescriptor {
  id: string | number;
  threshold: number;
  description: string;
}

/** An item in a `type: 'list'` stat's value array. */
export interface StatListItem {
  id: string | number;
  name: string;
  description: string;
  number: number;
}

/** A world-defined stat: its schema (type, range, descriptors) plus its live/starting value. */
export interface Stat {
  id: string;
  name: string;
  type: StatType;
  description: string;
  min: number;
  max: number;
  /** Initial value at game start (definition-side). */
  starting?: number;
  /** Live value: a number for 'number' stats, items for 'list' stats. */
  value?: number | StatListItem[];
  regen: number;
  descriptors: StatDescriptor[];
  /** Optional JS executed to derive this stat's value from others. */
  code?: string;
  /** Body-mesh morph target names this stat drives; stat [min,max] maps linearly to influence [0,1]. */
  morphBindings?: string[];
  /** `false` starts the stat inert — hidden from the player and the AI, regen and code paused — until a
   *  trait switches it on. Absent = enabled. */
  enabled?: boolean;
  /** Editor flags that stop the AI from changing this stat in a given direction. */
  noIncrease?: boolean;
  noIncreaseMax?: boolean;
  noDecrease?: boolean;
  noDecreaseMax?: boolean;
}

/** How a trait or stat-update modifies a stat. */
export interface StatChange {
  statId: string;
  value: number;
  /** Trait modifications target a facet of the stat. */
  type?: 'min' | 'max' | 'starting' | 'regen';
  /** Stat-update cadence, e.g. 'hour'. */
  interval?: string;
}

/** A stat this trait switches on or off while active; overrides the stat's own `enabled` default. */
export interface TraitStatToggle {
  statId: string;
  enabled: boolean;
}

/** A placeholder this trait forces to a fixed value while active, masking that playthrough's roll. */
export interface TraitPlaceholderPin {
  placeholderId: string;
  value: string;
}

/** A folder grouping traits in the editor and the selection screen; nestable via `parentId`. */
export interface TraitGroup {
  id: string;
  name: string;
  /** Shown to the player in the trait-selection screen. */
  playerDescription?: string;
  /** Sent to the AI as a header above this group's selected traits. */
  aiDescription?: string;
  /** null = top-level; otherwise the parent group's id. */
  parentId: string | null;
  /** Sibling order among items sharing the same parent. */
  order?: number;
  /** At most one trait in this group may be active — rendered as radio buttons rather than checkboxes. */
  exclusive?: boolean;
}

/** A selectable character trait that applies `statChanges` and adds AI context when chosen at game start. */
export interface Trait {
  id: string;
  name: string;
  /** Shown to the player in the trait-selection screen. */
  playerDescription?: string;
  /** Sent to the AI when this trait is selected. */
  aiDescription?: string;
  statChanges: StatChange[];
  /** Group this trait belongs to; null/absent = ungrouped. */
  groupId?: string | null;
  /** Pre-checked in the selection screen. */
  isDefault?: boolean;
  /** Sibling order among items sharing the same parent/group. */
  order?: number;
  /** The player may switch this trait on and off during play, not only at game start. */
  playerToggle?: boolean;
  /** Stats forced on or off while this trait is active. */
  statToggles?: TraitStatToggle[];
  /** Placeholders held at a fixed value while this trait is active. */
  placeholderPins?: TraitPlaceholderPin[];
}

/** A character or object in the world, with separate player-facing and AI-facing descriptions plus optional media. */
export interface Entity {
  id: string;
  name: string;
  /** Author-defined nicknames/other names (e.g. "Matron", "Em"). Detected in narration like the name
   *  (case-sensitive, word-bounded, plural-tolerant) and surfaced to the AI as "also known as". */
  aliases?: string[];
  type?: string;
  /** Shown to the player in-game. */
  playerDescription?: string;
  /** Full description sent to the AI. */
  aiDescription?: string;
  /** Short description sent to the AI where the full one is too long. */
  aiSummary?: string;
  image?: Base64Data;
  /**
   * Listing tags, the same kind a world carries — how somebody browsing Community Creations finds this.
   *
   * Not to be confused with `imageTags` below, which is a comma-separated booru string for the image
   * generator. These are semantic and player-facing; those describe a picture.
   */
  tags?: string[];
  /** Booru tags used for AI image generation; editor-only, not sent to the narrative AI. */
  imageTags?: string;
  sound?: MediaAsset;
  model?: MediaAsset;
  /** Editor-only folder this entity lives in; null/absent = ungrouped. Purely organizational — never sent
   *  to the AI (grouping does not change the entity context). Reset to ungrouped on character-card import. */
  groupId?: string | null;
  /** Sibling order among entities sharing the same group; editor-only, never sent to the AI. */
  order?: number;
  /** Placeholder defs this standalone/library item carries so its `{{ph…}}` chips resolve after import
   *  (see lib/placeholders). Populated only off-world (export bundle / library); absent while the entity
   *  lives in a world, where `World.placeholders` is authoritative — it's absorbed there on import. */
  placeholders?: Placeholder[];
}

/** An editor-only folder for organizing entities, nestable via `parentId`. Just a name — never sent to the
 *  AI (entities feed the AI exactly as if ungrouped). Mirrors `TraitGroup` minus the AI-facing fields. */
export interface EntityGroup {
  id: string;
  name: string;
  /** null = top-level; otherwise the parent group's id. */
  parentId: string | null;
  /** Sibling order among items sharing the same parent. */
  order?: number;
}

/** Named `GameLocation` to avoid clashing with the DOM `Location` global. */
export interface GameLocation {
  id: string;
  name: string;
  /** Shown to the player in-game. */
  playerDescription?: string;
  /** Full description sent to the AI. */
  aiDescription?: string;
  /** Short description sent to the AI where the full one is too long. */
  aiSummary?: string;
  /** Legacy alias some views fall back to when `playerDescription` is absent. */
  description?: string;
  backgroundImage?: Base64Data;
  /** Booru tags used for AI image generation; editor-only, not sent to the narrative AI. */
  imageTags?: string;
  ambientSound?: MediaAsset;
  /** Entity ids present at this location. */
  entities?: string[];
  /** Optional names of connected locations (shown in the gameplay location panel). */
  connections?: string[];
  /** v1.2.0: a candidate starting location (one chosen at random on new game). */
  isStarting?: boolean;
  /** Parent location id for sub-location nesting; null/absent = top-level. Editor-only for now — not
   *  sent to the AI (excluded in buildLocationContext). Sibling order is the `locations` array order. */
  parentId?: string | null;
}

/** A world-defined rule that periodically asks the AI to adjust a set of stats via its own prompt. */
export interface StatUpdate {
  id: string;
  name: string;
  /** AI prompt sent to evaluate this update. */
  prompt: string;
  /** Names of the stats this update can change. */
  stats: string[];
  messageHistory: ChatMessage[];
}

/**
 * Dictionary / lorebook entry. `key` lists the trigger keywords, one per element, so a keyword may contain
 * any character (commas included — regex patterns need them); `value` is the content injected into the AI
 * prompt when a keyword is in scope; `name` is the author's free label for the entry, shown in the list and
 * used to prefix the value in the prompt (blank falls back to the first keyword). Every field
 * below `value` is an optional lorebook control — all absent ⇒ the original v1.2 behavior (a plain
 * keyword→value entry rendered in the single late block), so already-shipped worlds are unaffected.
 */
export interface DictionaryEntry {
  id: string;
  name: string;
  key: string[];
  value: string;
  /** `false` disables the entry entirely (never injected); absent/`true` = active. */
  enabled?: boolean;
  /** Always inject, regardless of keyword matches. */
  constant?: boolean;
  /** Secondary keywords, one per element; when set, they gate activation alongside a primary hit (see
   *  `secondaryAll`/`secondaryExclude`; default is "at least one secondary must also appear"). */
  secondaryKeys?: string[];
  /** Require ALL secondary keywords rather than any one of them. */
  secondaryAll?: boolean;
  /** Invert the secondary test: activate only when the secondary keywords are ABSENT (with `secondaryAll`,
   *  when not all are present). Lets an entry fire *unless* certain words appear. */
  secondaryExclude?: boolean;
  /** Treat the keywords as regular expressions instead of plain substrings. */
  useRegex?: boolean;
  /** Match keywords as whole words (word boundaries) instead of substrings; ignored when `useRegex`. */
  matchWholeWords?: boolean;
  /** Match keywords case-sensitively (default: case-insensitive). */
  caseSensitive?: boolean;
  /** May be activated recursively by other activated entries' content. */
  recursive?: boolean;
  /** Which block the entry renders in: `before` ("Background Lore", early) or `after` ("Foreground Lore", late — default). Order within a block is the `dictionary` array order. */
  position?: 'before' | 'after';
  /** Cap the history lookback to the last N messages (the current scene is always scanned); absent = all history. */
  scanDepth?: number;
  /** Imported lorebook drop-priority when over budget — stored for round-trip (higher = kept). */
  priority?: number;
  /** Imported lorebook token budget — stored for round-trip. */
  tokenBudget?: number;
  /** Unmapped imported lorebook fields, preserved for lossless re-export. */
  extensions?: Record<string, unknown>;
}

/**
 * A "book": an ordered, individually-toggleable group of lorebook entries. A world holds several in
 * order; book order sets injection order within each prompt block, and a disabled book contributes none
 * of its entries (independent of each entry's own `enabled`). Entries keep their per-entry `position`.
 */
export interface Dictionary {
  id: string;
  name: string;
  /** Human-facing note about the book (not sent to the AI); round-trips imported lorebook descriptions. */
  description?: string;
  /** `false` mutes the whole book (all entries); absent/`true` = active. */
  enabled?: boolean;
  /** Listing tags, the same kind a world carries — how somebody browsing Community Creations finds this. */
  tags?: string[];
  /** Cover art for the listing. Decorative only; a book with none publishes with the server's stand-in. */
  thumbnail?: Base64Data | null;
  entries: DictionaryEntry[];
  /** Placeholder defs this standalone/library book carries so its entries' `{{ph…}}` chips resolve after
   *  import (see lib/placeholders). Off-world only; absorbed into `World.placeholders` on import to a world. */
  placeholders?: Placeholder[];
}

/** World-level metadata and global settings (system prompt, media, 3D toggle) shared across all saves. */
export interface WorldOverview {
  name: string;
  description: string;
  author: string;
  thumbnail: Base64Data | null;
  bgm: Base64Data | null;
  systemPrompt: string;
  use3DModel: boolean;
  tags: string[];
  /** v1.2.0: optional per-world custom player VRM model. */
  customPlayerVRM?: MediaAsset | null;
  /** Optional markdown shown to the player on entering the world (per-world "Show Readme" toggle). */
  readme?: string;
}

/** A complete authored world: overview plus all stats, locations, entities, traits, and updates. */
export interface World {
  id: string;
  /** App/world format version stamped on save/export (see lib/version `APP_VERSION`). Absent ⇒ legacy. */
  version?: string;
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  entities: Entity[];
  /** Editor-only folders organizing entities (name only; not reflected to the AI). */
  entityGroups?: EntityGroup[];
  traits: Trait[];
  /** Folders organizing traits in the editor and selection screen. */
  traitGroups?: TraitGroup[];
  statUpdates: StatUpdate[];
  /** v2.x: ordered books of lorebook entries (replaces the flat `dictionary`; legacy worlds fold to one
   *  "Default" book on load via `migrateWorld`). Guaranteed ≥1 book after that normalization. */
  dictionaries: Dictionary[];
  /** Author-defined named values dropped into world text as inline chips. Type is inferred from `values`:
   *  1 value = a fixed Variable (reused, edited in one place); 2+ = a random Wildcard (chips pick World or
   *  Unique). Resolved at gameplay boundaries (see lib/placeholders); the name/token never reaches runtime. */
  placeholders?: Placeholder[];
}

/** One author-defined placeholder. `values.length`: 0 ⇒ empty (resolves to ""), 1 ⇒ Variable (fixed), 2+ ⇒
 *  Wildcard (random). `id` is stable — in-text chips reference it, so renaming `name` never breaks a chip. */
export interface Placeholder {
  id: string;
  name: string;
  values: string[];
  /** Relative draw weight per value; a value absent from the map weighs 1. Weight 0 benches a value without
   *  deleting it. Absent map (or all-1 weights) = a uniform draw. */
  weights?: Record<string, number>;
}

/** Lightweight preview record used by the main-menu world grid. */
/**
 * A local copy's link back to the community listing it came from. Identical for all three kinds, so the
 * refresh/update machinery (see lib/downloadState) reads any of them without knowing which it holds.
 * Every field is local-only: none is ever exported or published.
 */
export interface CommunityLink {
  /** Server `_id` of the community listing this local copy was downloaded from, if any. */
  sourceId?: string;
  /** True if a downloaded copy has been edited locally and so diverges from its source. */
  dirty?: boolean;
  /** Wall-clock time of the most recent editor save; unset until first edited. */
  editedAt?: string;
  /** Wall-clock time this copy was (re)downloaded. */
  downloadedAt?: string;
  /** The listing's `updated_at` captured at download — the source version this copy holds. */
  sourceUpdatedAt?: string;
  /** The account that published the listing, captured at download. The authored `author` string is free
   *  text and names nobody in particular; this is who actually put it on Community Creations. */
  sourceAuthorId?: string;
}

export interface WorldMetadata extends CommunityLink {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: Base64Data;
  createdAt?: string;
  lastAccessed?: string;
  tags?: string[];
}

/** Lightweight preview record used by the main-menu dictionary-library grid (no entries). */
export interface DictionaryMetadata extends CommunityLink {
  id: string;
  name: string;
  /** The book's note, shown on the detailed library card. */
  description?: string;
  /** Cover art for the library card. Absent for a book that has none, which draws the empty tile. */
  thumbnail?: Base64Data;
  entryCount?: number;
  createdAt?: string;
  lastAccessed?: string;
  /** Listing tags, shown on the library card the way a world's are. */
  tags?: string[];
}

/** Lightweight preview record used by the main-menu character-library grid; `image` is the card portrait. */
export interface EntityMetadata extends CommunityLink {
  id: string;
  name: string;
  /** The player-facing blurb, shown on the detailed library card — the same one a listing publishes. */
  description?: string;
  image?: Base64Data;
  createdAt?: string;
  lastAccessed?: string;
  /** Listing tags, shown on the library card the way a world's are. */
  tags?: string[];
}
