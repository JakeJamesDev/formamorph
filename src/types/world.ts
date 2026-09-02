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

/** A scalar `number` stat, or a `percentage` stat (a number pinned to 0–100, displayed as `N%`). */
export type StatType = 'number' | 'percentage';

/** A text label surfaced to the AI once the stat's value crosses `threshold`. */
export interface StatDescriptor {
  id: string | number;
  threshold: number;
  description: string;
  /** Placeholders held at a fixed value while the stat sits in this band. */
  placeholderPins?: PlaceholderPin[];
}

/** What a descriptor threshold's number means: the stat's own units, or a percentage of min→max. */
export type ThresholdUnit = 'raw' | 'percent';

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
  /** Live value. */
  value?: number;
  regen: number;
  descriptors: StatDescriptor[];
  /** How this stat's descriptor thresholds read: `raw` in the stat's own units (bands stay put when the
   *  range changes), `percent` as a share of min→max (bands rescale). Absent = raw. */
  thresholdUnit?: ThresholdUnit;
  /** Optional JS executed to derive this stat's value from others. */
  code?: string;
  /** Body-mesh morph target names this stat drives; the value maps linearly across [min, authored max],
   *  so a max raised in play pushes the influence past 1. */
  morphBindings?: string[];
  /** `false` starts the stat inert — hidden from the player and the AI, regen and code paused — until a
   *  trait switches it on. Absent = enabled. */
  enabled?: boolean;
  /** `true` hides the stat from the player (panel, deltas, trait cards) while the AI still reads it and
   *  regen and code keep running. Absent = visible. */
  hidden?: boolean;
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

/** A placeholder its source forces to a fixed value while the source is active, masking that playthrough's
 *  roll. The one shape every source carries: a trait, a location, a stat descriptor, a placeholder value. */
export interface PlaceholderPin {
  placeholderId: string;
  value: string;
  /** The pinned value's id, when the pin names one the placeholder carries. Preferred over `value`, so a
   *  pin picked off the list follows the author re-spelling it. Absent for a value typed off the list. */
  valueId?: string;
}

/** The same pin shape, under the name the trait editor reads it by. */
export type TraitPlaceholderPin = PlaceholderPin;

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
  placeholderPins?: PlaceholderPin[];
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
  /** The entity's gallery, in author order. Slot 0 is the primary — the one picture shown wherever only one
   *  fits (library grid, listing art, character-card pixels) — and in game the player pages through the rest.
   *  Read it through `lib/entityImages`, which also covers records written before the gallery. */
  images?: Base64Data[];
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
  /** Ids of the locations this entity belongs to. The entity is present at every one of them
   *  simultaneously. Read it through `lib/entityPresence`, which inverts it into per-location rosters. */
  locations?: string[];
  /** Editor-only folder this entity lives in; null/absent = ungrouped. Purely organizational — never sent
   *  to the AI (grouping does not change the entity context). Reset to ungrouped on character-card import. */
  groupId?: string | null;
  /** Sibling order among entities sharing the same group; editor-only, never sent to the AI. */
  order?: number;
  /** Placeholders of this entity's own. In a world they are live: every reader sees them beside
   *  `World.placeholders` through the combined view (see lib/placeholderHomes), and they go with the
   *  entity when it is deleted or duplicated. Off-world (export bundle / library) they stay the entity's
   *  own, and an import keeps them so under fresh ids. */
  placeholders?: Placeholder[];
  /** Off-world only: the shared defs this entity's chips use, so they resolve after import. An import
   *  merges them into the world's shared list by name and values and clears the field. */
  sharedPlaceholders?: Placeholder[];
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
  /** v1.2.0: a candidate starting location (one chosen at random on new game). */
  isStarting?: boolean;
  /** Parent location id for sub-location nesting; null/absent = top-level. Editor-only for now — not
   *  sent to the AI (excluded in buildLocationContext). Sibling order is the `locations` array order. */
  parentId?: string | null;
  /** Where the author dragged this location on the Locations canvas — relative to its parent's box when
   *  nested, as the canvas reads a child's position. Editor-only: never sent to the AI. Absent means the
   *  canvas lays it out itself. */
  canvasPosition?: { x: number; y: number };
  /** Placeholders held at a fixed value while the player is here. Released on leaving; a child location
   *  inherits nothing through `parentId`. */
  placeholderPins?: PlaceholderPin[];
}

/**
 * An authored travel link between two locations (ADR-0002). Endpoints are location ids, so renaming a
 * location never breaks a link. A Connection between a pair **replaces** that pair's implicit navigation
 * (parent/children/siblings): its own directions are all the travel that remains for the pair, which is what
 * makes a one-way link between tree-adjacent locations mean one-way.
 */
export interface Connection {
  id: string;
  /** The location travel departs from — the only direction offered unless `twoWay`. */
  from: string;
  to: string;
  /** Travelable in both directions. A newly authored Connection defaults to true. */
  twoWay: boolean;
  /** Optional note on *how* the trip is made ("through the shimmering portal"), rendered as a `— via …`
   *  suffix on the destination line. Direction-neutral: one hint serves both directions. */
  aiHint?: string;
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
  /** Placeholders of this book's own. In a world they are live beside `World.placeholders` through the
   *  combined view (see lib/placeholderHomes) and go with the book when it is deleted. Off-world
   *  (export file / library) they stay the book's own, and an import keeps them so under fresh ids. */
  placeholders?: Placeholder[];
  /** Off-world only: the shared defs this book's entries use, so they resolve after import. An import
   *  merges them into the world's shared list by name and values and clears the field. */
  sharedPlaceholders?: Placeholder[];
}

/**
 * Prompt text a world supplies in place of the player's own. Only the narration, choices, and stat-update
 * system prompts are honored; every other AI pass (planning, memory, the clock) and every user-message
 * template comes from the player's preset, so a world can restyle the storytelling and the mechanics around
 * it without being able to break the machinery itself.
 *
 * An object rather than a bare string so later keys need no further export-shape change. The player can
 * decline the lot per world — see `lib/useWorldPromptOptOut`.
 */
export interface WorldPromptOverrides {
  /** Replaces the active preset's narration system prompt, chips and all, while playing this world. */
  systemPrompt?: string;
  /** `false` keeps the authored `systemPrompt` on the world without applying it, so switching the editor's
   *  toggle off is not what destroys the text. Absent/`true` = applied, so a world authored before this
   *  flag existed still uses its prompt. */
  systemPromptEnabled?: boolean;
  /** Replaces the active preset's choices system prompt. */
  choicesPrompt?: string;
  /** `false` keeps `choicesPrompt` on the world without applying it. */
  choicesPromptEnabled?: boolean;
  /** Replaces the active preset's stat-updates system prompt. */
  statUpdatesPrompt?: string;
  /** `false` keeps `statUpdatesPrompt` on the world without applying it. */
  statUpdatesPromptEnabled?: boolean;
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
  /** Optional markdown shown to the player on entering gameplay (per-world "Show Readme" toggle). */
  readme?: string;
  /** Optional markdown shown over the first enter-world setup screen, before any choice is made. Shares
   *  `readme`'s per-world toggle. Absent ⇒ setup opens straight onto its first step. */
  introReadme?: string;
  /** Prompt text this world supplies in place of the player's preset. Absent = the player's preset alone. */
  promptOverrides?: WorldPromptOverrides;
  /** The text the input box opens pre-filled with at Start Game, in place of the shipped cue. Placeholder
   *  chips resolve at pre-fill time; the player edits the result before submitting (see lib/openingCue). */
  openingCue?: string;
  /** `false` keeps `openingCue` on the world without applying it. Absent = stored text is applied, so a
   *  world hand-authored without the flag still opens with its cue. */
  openingCueEnabled?: boolean;
}

/** A complete authored world: overview plus all stats, locations, entities, traits, and updates. */
export interface World {
  id: string;
  /** App/world format version stamped on save/export (see lib/version `APP_VERSION`). Absent ⇒ legacy. */
  version?: string;
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  /** Authored travel links between locations (see `Connection`). Absent/empty ⇒ navigation is entirely
   *  implicit, exactly as before the graph existed. */
  connections?: Connection[];
  entities: Entity[];
  /** Editor-only folders organizing entities (name only; not reflected to the AI). */
  entityGroups?: EntityGroup[];
  /** Editor-only folders organizing the world's shared placeholders on the Placeholders tab. */
  placeholderGroups?: PlaceholderGroup[];
  traits: Trait[];
  /** Folders organizing traits in the editor and selection screen. */
  traitGroups?: TraitGroup[];
  statUpdates: StatUpdate[];
  /** v2.x: ordered books of lorebook entries (replaces the flat `dictionary`; legacy worlds fold to one
   *  "Default" book on load via `migrateWorld`). Guaranteed ≥1 book after that normalization. */
  dictionaries: Dictionary[];
  /** Author-defined named values dropped into world text as inline chips. A Wildcard picks one of its values
   *  (chips pick World or Unique); an Object shows all of them; one value is a Variable either way. Resolved
   *  at gameplay boundaries (see lib/placeholders); the name/token never reaches runtime. */
  placeholders?: Placeholder[];
}

/** One authored value: a stable id and the author's text. The id is minted once and never changes, so a
 *  draw weight or a trait pin keyed by it survives the author re-spelling the value; `text` is what
 *  resolves and what the editor edits. Values stay unique by text within one placeholder. */
export interface PlaceholderValue {
  id: string;
  text: string;
  /** Placeholders held at a fixed value while this placeholder's effective world value is this one: its
   *  roll, or whatever pin masks it. Sits below every other pin source. */
  pins?: PlaceholderPin[];
}

/** One author-defined placeholder. Empty `values` resolves to `""`; one value is a Variable, fixed whatever
 *  the kind says. `id` is stable — in-text chips reference it, so renaming `name` never breaks a chip. A
 *  value that is exactly one chip is a structural child, addressable by path from world text. */
export interface Placeholder {
  id: string;
  name: string;
  values: PlaceholderValue[];
  /** Relative draw weight per value id; a value absent from the map weighs 1. Weight 0 benches a value
   *  without deleting it. Absent map (or all-1 weights) = a uniform draw. */
  weights?: Record<string, number>;
  /** The kind, as the author declared it: `true` ⇒ a Wildcard, one value drawn per playthrough; `false` ⇒
   *  an Object, whose whole placement joins every value with `", "`. Absent ⇒ inferred from the value count
   *  (2+ draws), which is how every placeholder authored before the selector existed reads. */
  roll?: boolean;
  /** The placeholder this one belongs to: present ⇒ owned and private to it, absent ⇒ top level. Purely
   *  organizational — it decides where the row sits and which insert surfaces offer it, and the resolver
   *  never reads it. An owned placeholder is always also a chip value of its owner, so the owner dropping
   *  that value releases it (see lib/placeholderTree). */
  ownerId?: string;
  /** Draw weights this placeholder sets on the shared rows it reaches, laid over each original's own map.
   *  The outer key is the id of the value holding the shared chip, plus the id of every placeholder walked
   *  below it, joined with `/`; the inner map keys by value id like `weights`. Deny-list: a value in
   *  neither map weighs 1, so a value added to the original later rolls here too. */
  sharedWeights?: Record<string, Record<string, number>>;
  /** The editor folder this placeholder sits in on the Placeholders tab; null/absent = ungrouped. Only a
   *  shared placeholder is grouped: a scoped one sits under its entity or book, an owned one under its
   *  holder. Editor-only, never sent to the AI, and dropped from card and dictionary exports. */
  groupId?: string | null;
}

/** An editor-only folder for organizing shared placeholders, nestable via `parentId`. Just a name — never
 *  sent to the AI. Mirrors `EntityGroup`. */
export interface PlaceholderGroup {
  id: string;
  name: string;
  /** null = top-level; otherwise the parent group's id. */
  parentId: string | null;
  /** Sibling order among groups sharing the same parent. */
  order?: number;
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
