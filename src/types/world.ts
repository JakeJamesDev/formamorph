import type { ChatMessage, Tool } from './ai';

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

/** The span the editor shows Regen per. `regen` itself is always per hour. */
export type RegenUnit = 'minutes' | 'hours' | 'days' | 'weeks';

/** When a script runs: before the turn's AI calls, after the AI's asks and regen land, on each completed
 *  narration sentence, once at a new playthrough's start, or when a trait switches in play. */
export type ScriptTiming = 'before' | 'after' | 'output' | 'start' | 'switch';

/** One box of code with a timing, on a stat, a trait or the world. */
export interface Script {
  id: string;
  /** Absent or blank = the owner and timing name it. */
  name?: string;
  timing: ScriptTiming;
  code: string;
  /** Run position within the timing; absent = after every ordered script, in owner then stat order. */
  order?: number;
}

/** A world-defined stat: its schema (type, range, descriptors) plus its live/starting value. */
export interface Stat {
  id: string;
  name: string;
  type: StatType;
  description: string;
  min: number;
  max: number;
  /** Base Value at game start (definition-side), before traits apply. */
  starting?: number;
  /** Live value. */
  value?: number;
  /** The change per story hour. */
  regen: number;
  /** The span the editor shows `regen` per. Absent = hours. */
  regenUnit?: RegenUnit;
  descriptors: StatDescriptor[];
  /** How this stat's descriptor thresholds read: `raw` in the stat's own units (bands stay put when the
   *  range changes), `percent` as a share of min→max (bands rescale). Absent = raw. */
  thresholdUnit?: ThresholdUnit;
  /** Scripts with this stat as `self`, run while the stat is enabled. Absent = none. */
  scripts?: Script[];
  /** Body-mesh morph target names this stat drives; the value maps linearly across [min, authored max],
   *  so a max raised during the game pushes the influence past 1. */
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
  /** The stat group this stat sits in; null or absent = top level. A group the owner lacks reads as top level. */
  groupId?: string | null;
  /** Sibling order among the stats and groups sharing the same parent. */
  order?: number;
}

/** A folder grouping stats in the editor and the stat panel; nestable via `parentId`. Organization only: a
 *  group has no modes, pick counts or gates. */
export interface StatGroup {
  id: string;
  name: string;
  /** Sent to the AI as the group's heading text. */
  aiDescription?: string;
  /** `false` hides the heading from the AI and moves the group's stats up one level. Absent = visible. */
  aiVisible?: boolean;
  /** null = top-level; otherwise the parent group's id. */
  parentId: string | null;
  /** Sibling order among the stats and groups sharing the same parent. */
  order?: number;
  /** `blueprints` marks the world's Blueprints group: its stats are not the player's and reach play only through
   *  entity links. At most one world group carries it. Never set on an entity's own group. */
  system?: 'blueprints';
}

/** A node under an entity that points at a Blueprint stat or stat group, the original, and reads it live. It
 *  stores only its own place and its overrides. In play each linked stat runs under the original stat's id, with
 *  this entity's own value. */
export interface StatLink {
  id: string;
  /** The original's id: a world stat or stat group inside the Blueprints group. */
  originalId: string;
  kind: 'stat' | 'group';
  /** The original's name when the link was stored, so it travels off-world and rebinds by name. */
  originalName: string;
  /** null = the entity's top level; otherwise one of the entity's own stat groups. */
  groupId: string | null;
  /** Sibling order among the entity's stats, links and groups sharing the same parent. */
  order?: number;
  /** Original stat id → this link's overrides on that stat. A stat absent here, or a field absent in its map,
   *  reads the original live. A linked group keys its stats here. */
  overrides?: Record<string, StatLinkOverrides>;
  /** Off-world only: stat id → name for each stat below the original that `overrides` keys, so the keys rebind
   *  by name when the original does. Dropped when the link binds to a world. */
  keyNames?: Record<string, string>;
}

/** The fields a stat link may override, absent ones on the original read as off or empty. The name stays the
 *  original's; `value` is the Base Value. */
export interface StatLinkFields {
  type: StatType;
  description: string;
  min: number;
  max: number;
  value: number;
  regen: number;
  regenUnit: RegenUnit;
  descriptors: StatDescriptor[];
  thresholdUnit: ThresholdUnit;
  scripts: Script[];
  morphBindings: string[];
  enabled: boolean;
  hidden: boolean;
  noIncrease: boolean;
  noIncreaseMax: boolean;
  noDecrease: boolean;
  noDecreaseMax: boolean;
}

export type StatLinkOverrides = BlueprintOverrides<StatLinkFields>;

/** How a trait or stat-update modifies a stat. */
export interface StatChange {
  statId: string;
  value: number;
  /** Trait modifications target a facet of the stat. */
  type?: 'min' | 'max' | 'starting' | 'regen';
  /** Stat-update cadence, e.g. 'hour'. */
  interval?: string;
  /** On an owner's trait, the global stat, even where the owner has its own stat with this id. */
  target?: StatRowTarget;
}

/** Whose stat an owner's trait row names when the id alone could mean two. */
export type StatRowTarget = 'global';

/** A stat this trait switches on or off while active; overrides the stat's own `enabled` default. */
export interface TraitStatToggle {
  statId: string;
  enabled: boolean;
  /** As on {@link StatChange}. */
  target?: StatRowTarget;
}

/** A placeholder its source forces to a fixed value while the source is active, masking that playthrough's
 *  roll. The one shape every source carries: a trait, a location, a stat descriptor, a placeholder value. */
export interface PlaceholderPin {
  /** The target's id. A trait pin may name a blueprint placeholder: on each owner it then traces to that
   *  owner's copy (see lib/blueprints). */
  placeholderId: string;
  value: string;
  /** The pinned value's id, when the pin names one the placeholder carries. Preferred over `value`, so a
   *  pin picked off the list follows the author re-spelling it. Absent for a value typed off the list. */
  valueId?: string;
}

/** One overridden field on a blueprint-origin record: the value set here and the blueprint's value it was
 *  made against. The blueprint changing that field since marks the override stale. */
export interface BlueprintOverride<V> {
  value: V;
  blueprint: V;
}

/** A sparse override map over a blueprint's fields. An absent key reads the blueprint live. */
export type BlueprintOverrides<T> = { [K in keyof T]?: BlueprintOverride<T[K]> };

/** Whose active set a requirement reads: the played persona's, or a named entity's. `name` is the entity's
 *  name when it was stored, so an unresolved one still reads. Absent on a requirement = the same owner. */
export type RequirementOwner =
  | { kind: 'you' }
  | { kind: 'entity'; id: string; name?: string };

/** How a stat Condition compares the stat to its number. */
export type StatComparison = '>' | '<' | '>=' | '<=' | '=' | '≠';

/** One Condition of a gate: a trait is active, any trait below a group is active, the player plays as a
 *  world entity, or an owner's stat compares to a number. `name` is the target's name when it was stored, so
 *  an unresolved one still reads. `not` flips it: the Condition holds while its target is off, or while a stat
 *  fails its comparison. A stat Condition's `value` is in the stat's own units under `raw`, or a share of its
 *  min→max span under `percent`. */
export type TraitRequirement =
  | { kind: 'trait'; id: string; name?: string; owner?: RequirementOwner; not?: true }
  | { kind: 'group'; id: string; name?: string; owner?: RequirementOwner; not?: true }
  | { kind: 'playingAs'; id: string; name?: string; not?: true }
  | StatRequirement
  | TimeRequirement;

/** A coarse time of day, as the story clock splits its day by fractions. */
export type Daypart = 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening';

/** A time Condition: it holds while the story clock's daypart is one of `dayparts`. It names no target and
 *  no owner. */
export interface TimeRequirement {
  kind: 'time';
  dayparts: Daypart[];
  // Absent, so code that reads any Condition's target finds none here.
  id?: undefined;
  name?: undefined;
  owner?: undefined;
  not?: undefined;
}

/** A stat Condition: see {@link TraitRequirement}. */
export interface StatRequirement {
  kind: 'stat';
  id: string;
  name?: string;
  owner?: RequirementOwner;
  operator: StatComparison;
  value: number;
  unit: ThresholdUnit;
  not?: true;
}

/** One Requirement Row: it holds when every Condition in it holds. Never empty. */
export interface TraitRequirementRow {
  all: TraitRequirement[];
}

/** A folder grouping traits in the editor and the selection screen; nestable via `parentId`. */
export interface TraitGroup {
  id: string;
  name: string;
  /** Shown to the player in the trait-selection screen. */
  playerDescription?: string;
  /** Sent to the AI as a header above this group's selected traits. */
  aiDescription?: string;
  /** `false` hides the heading from the AI and moves the group's traits up one level. Absent = visible. */
  aiVisible?: boolean;
  /** null = top-level; otherwise the parent group's id. */
  parentId: string | null;
  /** Sibling order among items sharing the same parent. */
  order?: number;
  /** The fewest traits placed directly in this group that must be active; absent = 0. */
  minPicks?: number;
  /** The most traits placed directly in this group that may be active; absent = no limit. A max of 1 renders
   *  radio buttons. */
  maxPicks?: number;
  /** `blueprints` marks the world's Blueprints group: it holds originals that reach play only through links.
   *  At most one world group carries it. Never set on an entity's own group. */
  system?: 'blueprints';
}

/** An entity node's place in the world's Traits or Stats tree. The parent is a world group, never an entity's own
 *  and never Blueprints: a placement that names Blueprints or a group below it reads as the top level. */
export interface TreePlacement {
  /** null = top level. */
  groupId: string | null;
  order: number;
}

/** A node under an owner that points at a world trait or group, the original, and reads it live. It stores
 *  only its own place and per-link data; the original's text, gates and pins reach every link. */
export interface TraitLink {
  id: string;
  /** The original's id: a world trait or group at the root or under Blueprints. */
  originalId: string;
  kind: 'trait' | 'group';
  /** The original's name when the link was stored, so it travels off-world and rebinds by name. */
  originalName: string;
  /** null = the owner's root; otherwise one of the owner's own groups. */
  groupId: string | null;
  /** Sibling order among the owner's items sharing the same parent. */
  order?: number;
  /** Original trait id → this link's overrides on that trait. A trait absent here, or a field absent in its
   *  map, reads the original live. A linked group keys its children here. */
  overrides?: Record<string, TraitLinkOverrides>;
  /** Off-world only: trait id → name for each trait below the original that `overrides` keys, so the keys
   *  rebind by name when the original does. Dropped when the link binds to a world. */
  keyNames?: Record<string, string>;
}

/** The fields a link may override on a trait its original brings. Name and descriptions stay the original's. */
export interface TraitLinkFields {
  isDefault: boolean;
  requires: TraitRequirementRow[];
  placeholderPins: PlaceholderPin[];
  playerToggle: boolean;
  statChanges: StatChange[];
  /** 'optional' stands for an absent `Trait.mode`, so an override to Optional survives the JSON export. */
  mode: 'optional' | TraitMode;
  /** One override for the whole list, as a stat link's. */
  scripts: Script[];
}

export type TraitLinkOverrides = BlueprintOverrides<TraitLinkFields>;

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
  /** The player may switch this trait on and off during the game, not only at game start. */
  playerToggle?: boolean;
  /** Stats forced on or off while this trait is active. */
  statToggles?: TraitStatToggle[];
  /** Placeholders held at a fixed value while this trait is active. */
  placeholderPins?: PlaceholderPin[];
  /** Any one row that holds unlocks the trait. Absent or empty = always available. */
  requires?: TraitRequirementRow[];
  /** Absent = Optional. Automatic (stored `alwaysOn`) is active exactly while its gate holds, and the player never
   *  switches it. Hidden acts as Automatic. Both ignore `isDefault` and `playerToggle`. */
  mode?: TraitMode;
  /** Scripts with this trait as `self`. Absent = none. */
  scripts?: Script[];
}

/** A trait's non-Optional mode. */
export type TraitMode = 'alwaysOn' | 'hidden';

/** One picture in an entity's gallery. */
export interface GalleryImage {
  data: Base64Data;
  /** The Visibility rule: in play any one row that holds shows the image. Absent or empty = always shown. */
  requires?: TraitRequirementRow[];
}

/** A character or object in the world, with separate player-facing and AI-facing descriptions plus optional media. */
export interface Entity {
  id: string;
  name: string;
  /** Author-defined nicknames/other names (e.g. "Matron", "Em"). Detected in narration like the name
   *  (case-sensitive, word-bounded, plural-tolerant) and surfaced to the AI as "also known as". */
  aliases?: string[];
  /** Free text, such as "she/her". The AI's entity context shows it for any entity that has it. */
  pronouns?: string;
  /** Marks the entity as a Persona. In the library it is one of the player's personas; in a world the
   *  player can play as it. */
  persona?: boolean;
  /** The entity exists only while it is the picked persona: unpicked, it leaves the cast and never joins a
   *  scene. Read only with the Persona mark. */
  personaOnly?: boolean;
  /** Marks the entity as the Custom Persona: the player's own entity under None and under a library persona,
   *  never in the cast (see lib/owners). At most one per world, at the root. Excludes the Persona marks and
   *  implies persona-only. */
  customPersona?: boolean;
  type?: string;
  /** Shown to the player in game. */
  playerDescription?: string;
  /** Full description sent to the AI. */
  aiDescription?: string;
  /** Short description sent to the AI where the full one is too long. */
  aiSummary?: string;
  /** The entity's gallery, in author order. Slot 0 is the primary — the one picture shown wherever only one
   *  fits (library grid, listing art, character-card pixels) — and in game the player pages through the rest.
   *  Read it through `lib/entityImages`, which also covers records written before the gallery. */
  images?: GalleryImage[];
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
  /** The entity's Avatar. Absent = none. */
  vrmPick?: VrmPick;
  /** Ids of the locations this entity belongs to. The entity is present at every one of them
   *  simultaneously. Read it through `lib/entityPresence`, which inverts it into per-location rosters. Under
   *  the Persona mark they are also where the player can start as it (see `lib/personaPick`). */
  locations?: string[];
  /** `random`: one individual, placed at one of `locations` at random in each new game. Absent = present at
   *  every listed location at once. The persona ignores it. */
  presence?: EntityPresence;
  /** How the entity moves during play. Absent = Free: no position, no AI request. The persona ignores it. */
  movement?: EntityMovement;
  /** Where the AI knows of the entity while it isn't present: `nowhere`, or the picked location ids, each
   *  covering its whole subtree. Absent = Nearby, one step from where it is. */
  knownIn?: 'nowhere' | string[];
  /** The entity's links to other entities, at most one per target, in author order. Absent or empty = none. */
  relationships?: EntityRelationship[];
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
  /** This entity's own openings, in authored order. They join the world's pool when the entity stands at the
   *  player's starting location (see lib/openings). Entities have no switch of their own. */
  openings?: Opening[];
  /** Relative draw weight per opening id; an opening absent from the map weighs 1, and 0 benches it. */
  openingWeights?: Record<string, number>;
  /** Traits this entity owns. They describe it to the AI, and are the persona's traits when the player plays
   *  as it. Their stat changes and toggles act on the entity's own stats, and on the global stats where the
   *  entity does not own the stat or the row targets global. Ids are unique across the world and every entity. */
  traits?: Trait[];
  /** Groups for this entity's own traits, nestable via `parentId` like the world's. */
  traitGroups?: TraitGroup[];
  /** Links to world traits and groups, placed among the entity's own items (see lib/owners). Each original
   *  appears at most once in the entity's tree, directly or through a linked group. */
  traitLinks?: TraitLink[];
  /** Where this entity's node sits in the world's Traits tree: a world group and a sibling order. Absent,
   *  or a group that no longer exists, = the end of the top level. */
  traitPlacement?: TreePlacement;
  /** Stats this entity owns: the world stat type, every field. Order is list order. Absent = none. In play
   *  they are the entity's own values, and the persona's stats when the entity is played. */
  stats?: Stat[];
  /** Groups for this entity's own stats, nestable via `parentId` like the world's. */
  statGroups?: StatGroup[];
  /** Links to the world's Blueprint stats and stat groups, placed among the entity's own stats (see
   *  lib/statLinks). No two links bring the same stat. */
  statLinks?: StatLink[];
  /** Where this entity's node sits in the world's Stats tree: a world stat group and a sibling order. Absent,
   *  or a group that no longer exists, = the end of the top level. */
  statPlacement?: TreePlacement;
  /** Off-world only: the shared placeholders this entity's chips use, so they resolve after import. An import
   *  merges them into the world's shared list by name and values and clears the field. */
  sharedPlaceholders?: Placeholder[];
  /** Off-world only: the blueprints this entity's copies read, so a receiving world can bind each copy to its
   *  own blueprint by id, then by name (see lib/blueprintTravel). Binding clears the field. */
  blueprints?: Placeholder[];
  /** Off-world only: the locations this entity stood in, named so a receiving world can connect each one
   *  to a location of its own. The entity keeps ownership of the references; `locations` holds them once
   *  the world resolves them, and an import clears this field. */
  locationRefs?: ContentLocationRef[];
  /** What this copy follows, where it follows anything (see `ContentLink`). Absent = independent copy. */
  link?: ContentLink;
}

/** An entity's Presence beyond the default, Everywhere Listed. */
export type EntityPresence = 'random';

/** An entity's Movement beyond the default, Free. */
export type EntityMovement = 'stays' | 'between' | 'follow';

/** One authored link from an entity to another. `label` is the target's role toward the owner, read as
 *  "<target> is <owner>'s <label>". */
export interface EntityRelationship {
  targetId: string;
  label: string;
}

/** One location a piece of off-world content expects, as the world it left named it. The id is the key its
 *  connection is stored under, so the source renaming the location keeps the connection. */
export interface ContentLocationRef {
  id: string;
  name: string;
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
  /** Shown to the player in game. */
  playerDescription?: string;
  /** Full description sent to the AI. */
  aiDescription?: string;
  /** Short description sent to the AI where the full one is too long. */
  aiSummary?: string;
  /** Legacy alias some views fall back to when `playerDescription` is absent. */
  description?: string;
  /** The location's gallery, in author order. In play the backdrop shows the first visible image. A rule's
   *  owner-less Condition reads the played persona. Read it through `lib/locationImages`, which also covers
   *  records written before the gallery. */
  images?: GalleryImage[];
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
  /** `true`: the entities reachable from here are the ones at the router's effective destinations (tree
   *  neighbors plus Connection legs). Absent = the parent and siblings only. */
  nearbyUsesConnections?: boolean;
  /** Placeholders held at a fixed value while the player is here. Released on leaving; a child location
   *  inherits nothing through `parentId`. */
  placeholderPins?: PlaceholderPin[];
  /** This location's own openings, in authored order. They join the world's pool when a new game starts at
   *  this exact location (see lib/openings); a child location draws none of its parent's. */
  openings?: Opening[];
  /** Relative draw weight per opening id; an opening absent from the map weighs 1, and 0 benches it. */
  openingWeights?: Record<string, number>;
}

/**
 * An authored travel link between two locations (ADR-0002). Endpoints are location ids, so renaming a
 * location never breaks a link. A Connection between a pair **replaces** that pair's implicit navigation
 * (parent/children/siblings): its own directions are all the travel that remains for the pair, which is what
 * makes a one-way link between tree-adjacent locations mean one-way.
 */
export interface Connection {
  id: string;
  /** One end. `a` and `b` are neutral: travel may run only `b → a`. */
  a: string;
  b: string;
  /** Present when travel runs `a → b`. At least one leg is present. */
  aToB?: ConnectionLeg;
  /** Present when travel runs `b → a`. */
  bToA?: ConnectionLeg;
}

/** Which direction of a Connection a leg is. */
export type LegKey = 'aToB' | 'bToA';

/** One direction of a Connection. */
export interface ConnectionLeg {
  /** How this trip is made ("through the shimmering portal"), rendered as a `— via …` suffix on the
   *  destination line. Blank is stored as absent. */
  hint?: string;
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
  /** Match keywords as whole words (word boundaries) instead of substrings, regex keywords included. */
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
  /** Off-world only: the shared placeholders this book's entries use, so they resolve after import. An import
   *  merges them into the world's shared list by name and values and clears the field. */
  sharedPlaceholders?: Placeholder[];
  /** What this copy follows, where it follows anything (see `ContentLink`). Absent = independent copy. */
  link?: ContentLink;
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

/** One Avatar in a world's store: its display name and the embedded file. */
export interface WorldVrm {
  name: string;
  file: MediaAsset;
  /** The file's content hash, which matches it to a library Avatar. Absent on entries added before it; read
   *  through `lib/libraryVrm`, which computes it. */
  hash?: string;
}

/** A world's Avatars, keyed by id. */
export type WorldVrmStore = Record<string, WorldVrm>;

/** Which Avatar an entity shows: the player's default, one from the world's store, or one from the player's
 *  Avatar library (library entities). Absent = none. */
export type VrmPick = { kind: 'default' } | { kind: 'world'; id: string } | { kind: 'library'; id: string };

/** World-level metadata and global settings (system prompt, media, Avatars) shared across all saves. */
export interface WorldOverview {
  name: string;
  description: string;
  author: string;
  thumbnail: Base64Data | null;
  bgm: Base64Data | null;
  systemPrompt: string;
  tags: string[];
  /** The world's Avatars, keyed by id. Entities refer to one through `Entity.vrmPick`. */
  vrmStore?: WorldVrmStore;
  /** The played side's last resort, set only by the migration of a world whose old 3D Player Avatar flag
   *  was on (see lib/legacyVrm). Never shown in the editor. */
  legacyVrmFallback?: VrmPick;
  /** Optional markdown shown to the player on entering gameplay (per-world "Show Readme" toggle). */
  readme?: string;
  /** Optional markdown shown over the first enter-world setup screen, before any choice is made. Shares
   *  `readme`'s per-world toggle. Absent ⇒ setup opens straight onto its first step. */
  introReadme?: string;
  /** Prompt text this world supplies in place of the player's preset. Absent = the player's preset alone. */
  promptOverrides?: WorldPromptOverrides;
  /** The world's own openings, in authored order. One is drawn by weight at Start Game (see lib/openings). */
  openings?: Opening[];
  /** Relative draw weight per opening id; an opening absent from the map weighs 1, and 0 benches it. */
  openingWeights?: Record<string, number>;
  /** `false` keeps `openings` on the world without drawing them. Absent = on. */
  openingsEnabled?: boolean;
  /** Which personas the player can pick. Absent = any. */
  allowedPersonas?: AllowedPersonas;
  /** The persona a new player starts on. Absent = the player's default persona. */
  startPersona?: StartPersona;
  /** The picture behind the Locations canvas and the player's Map. Absent = none. */
  mapBackground?: MapBackground;
}

/** A box on the Locations canvas, in canvas units. */
export interface MapFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The world map art behind the location boxes. Every image fits inside the one frame at its own aspect
 * ratio. In play the Map shows the first visible image; authoring shows slot 0. An owner-less rule row reads
 * the played persona, as on a location.
 */
export interface MapBackground {
  /** At least one image; the field goes with the last one. */
  images: GalleryImage[];
  frame: MapFrame;
  /** 0 to 1. */
  opacity: number;
}

/** `world` limits the pickers to this world's personas and its Custom Persona. Applied by lib/personaPick. */
export type AllowedPersonas = 'any' | 'world';

/** None (or the Custom Persona, which stands in its place), or one of this world's personas. */
export type StartPersona = { source: 'none' } | { source: 'world'; entityId: string };

/** Where an opening's text lands: `action` pre-fills the player's input box, `narration` is page one. */
export type OpeningKind = 'action' | 'narration';

/** One authored way to start a playthrough. The id is minted once, so a draw weight keyed by it survives
 *  the author rewriting the text. Placeholder chips in `text` resolve against the opening pins. */
export interface Opening {
  id: string;
  text: string;
  kind: OpeningKind;
  /** A Self opening: a start written for playing as its owner, drawn only while the player plays it. Absent =
   *  Others, the owner greeting the player. Read only on an owner with the Persona mark. */
  self?: true;
}

/** A complete authored world: overview plus all stats, locations, entities, traits, and updates. */
export interface World {
  id: string;
  /** App/world format version stamped on save/export (see lib/version `APP_VERSION`). Absent ⇒ legacy. */
  version?: string;
  worldOverview: WorldOverview;
  stats: Stat[];
  /** Folders organizing the player's stats in the editor and the stat panel. */
  statGroups?: StatGroup[];
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
  /** Scripts no stat or trait owns; they run with no `self`. Absent = none. */
  scripts?: Script[];
  /** World Tools, in Tools-tab order: offered in every playthrough of this world. Absent = none. */
  tools?: Tool[];
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
  /** The blueprint this placeholder copies (see lib/blueprints). A copy reads the blueprint's values live,
   *  under the blueprint's ids, and `values` holds only the copy's own. It is always named after its
   *  blueprint, and an owner holds one copy per blueprint. */
  blueprintId?: string;
  /** Blueprint value id → what this copy changes on that value. A value absent here reads live. */
  valueOverrides?: Record<string, CopyValueOverrides>;
  /** The editor folder this placeholder sits in on the Placeholders tab; null/absent = ungrouped. Only a
   *  shared placeholder is grouped: a scoped one sits under its entity or book, an owned one under its
   *  parent placeholder. Editor-only, never sent to the AI, and dropped from card and dictionary exports. */
  groupId?: string | null;
}

/** The fields a copy may override on one of its blueprint's values. */
export interface CopyValueFields {
  text: string;
  /** The draw weight: the blueprint's `weights` entry, 1 when absent. */
  weight: number;
}

/** What a copy changes on one blueprint value: its fields, or the value left out of this copy. A removed
 *  value never rolls here, and a pin naming it lays nothing. */
export type CopyValueOverrides = BlueprintOverrides<CopyValueFields> & { removed?: true };

/**
 * What one world's copy of an entity or dictionary follows. The record lives on the copy inside the world,
 * so two worlds holding the same source track it separately; a copy with no record is an independent copy
 * and follows nothing.
 *
 * Not `CommunityLink`: that is local-only bookkeeping about a downloaded library item and is never exported.
 * This record is part of the authored world and travels with a world export.
 */
export interface ContentLink {
  /** The local library item this copy follows. */
  libraryId?: string;
  /** The published listing behind that library item, where it has one. */
  sourceId?: string;
  /** The source revision this copy holds — what an update compares against. */
  sourceRevision?: string;
  /** The last revision the player reviewed, so a revision they kept does not return to review until the
   *  source changes again. Absent until something has been reviewed. */
  reviewedRevision?: string;
  /** The copy has been edited away from its source but still tracks it. */
  localReplacement?: boolean;
  /** The source's name as it read when the link was made. Display only, never identity — a name alone
   *  cannot establish a link. Carried so an exported world, or one whose library item is gone, can still
   *  say what the copy follows. */
  sourceName?: string;
  /** What each world-owned thing the source expects resolves to here: the source's own id for a shared
   *  placeholder or a location, against this world's id for it. Written by the Connect World References
   *  step and read by every later update, so the source renaming a reference keeps it connected. */
  connections?: Record<string, string>;
  /** The copy arrived bundled in an imported world file, and the library item it followed where that file
   *  was written is not on this machine. The value is that item's id, which groups the copies that
   *  followed one source, so Link bundled content places one library item for the group. */
  bundledFrom?: string;
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
  /** `blueprints` marks the world's Blueprints group: its shared placeholders are blueprints, read per
   *  owner through copies and never as World placeholders. At most one, at the top level. */
  system?: 'blueprints';
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
  /** That account's display name at download, so a picker can print who a copy follows without a lookup.
   *  Display only; `sourceAuthorId` is the identity. */
  sourceAuthorName?: string;
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
  author?: string;
  libraryDetails?: LibraryDetails;
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

/** Creator credit and imported tags stored only on the library record. */
export interface LibraryDetails {
  author?: string;
  tags?: string[];
}

/** Lightweight preview record used by the main-menu character-library grid; `image` is the card portrait. */
export interface EntityMetadata extends CommunityLink {
  id: string;
  name: string;
  author?: string;
  /** The player-facing blurb, shown on the detailed library card — the same one a listing publishes. */
  description?: string;
  image?: Base64Data;
  createdAt?: string;
  lastAccessed?: string;
  /** Listing tags, shown on the library card the way a world's are. */
  tags?: string[];
  /** The entity carries the Persona mark, so the tab's Personas filter shows it. */
  persona?: boolean;
  /** The library Avatar the entity picks, so a library delete can name its users. */
  vrmLibraryId?: string;
  /** Imported attribution and tags kept outside world content. */
  libraryDetails?: LibraryDetails;
}

/** A find-bar hit handed to a detail panel, so the panel can open the tab that holds the field. `itemId`
 *  names the item the hit sits in, or is null for Overview, which has no item list. */
export interface FocusFieldHint {
  fieldKey: string;
  itemId: string | null;
}
