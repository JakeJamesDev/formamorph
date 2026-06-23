import type { ChatMessage } from './ai';

/** A base64 data-URL string, e.g. "data:image/png;base64,...". */
export type Base64Data = string;

/** Uploaded media with its MIME type (entity sound/model, location ambient sound, custom VRM). */
export interface MediaAsset {
  data: Base64Data;
  type: string;
}

export type StatType = 'number' | 'list';

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

export interface Trait {
  id: string;
  name: string;
  description: string;
  statChanges: StatChange[];
}

export interface Entity {
  id: string;
  name: string;
  type?: string;
  inGameDescription?: string;
  detailedDescription?: string;
  image?: Base64Data;
  sound?: MediaAsset;
  model?: MediaAsset;
}

/** Named `GameLocation` to avoid clashing with the DOM `Location` global. */
export interface GameLocation {
  id: string;
  name: string;
  inGameDescription?: string;
  detailedDescription?: string;
  backgroundImage?: Base64Data;
  ambientSound?: MediaAsset;
  /** Entity ids present at this location. */
  entities?: string[];
  /** v1.2.0: a candidate starting location (one chosen at random on new game). */
  isStarting?: boolean;
}

export interface StatUpdate {
  id: string;
  name: string;
  description: string;
  statChanges: StatChange[];
  messageHistory: ChatMessage[];
}

/**
 * Dictionary entry — matches the v1.2.0 save format:
 * `key` is a comma-separated list of trigger keywords; `value` is the content injected
 * into the AI prompt when a keyword appears in play. `name` mirrors `key` (used for the
 * list display, as in v1.2).
 */
export interface DictionaryEntry {
  id: string;
  name: string;
  key: string;
  value: string;
}

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
}

export interface World {
  id: string;
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  entities: Entity[];
  traits: Trait[];
  statUpdates: StatUpdate[];
  /** v1.2.0 */
  dictionary?: DictionaryEntry[];
}

/** Lightweight preview record used by the main-menu world grid. */
export interface WorldMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: Base64Data;
  createdAt: string;
  lastAccessed: string;
  tags?: string[];
}
