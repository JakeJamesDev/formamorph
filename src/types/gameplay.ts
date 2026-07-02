import type { Stat, Trait, Entity } from './world';
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

/** A choice is a single plaintext action line. */
export type Choice = string;

export interface LogEntry {
  text: string;
  gameTime: number;
  repeat: number;
}

export interface BodyShape {
  pear: number;
  apple: number;
  hourglass: number;
}

export interface HairTypeDef {
  shapekey: string;
  canChangeLength: boolean;
}

export interface CharacterData {
  bodyShape: BodyShape;
  bellySize: number;
  breastsSize: number;
  bodyWeight: number;
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

/** A player-uploaded VRM stored in the local model library (IndexedDB), keyed by `id`. */
export interface PlayerModel {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  size: number;
  addedAt: string;
}

/** One saved snapshot of a play session (see GameplayContext.saveCurrentGameState). */
export interface GameState {
  playerStats: PlayerStat[];
  playerTraits: Trait[];
  /** Names of entities currently visible (matched against the world's entity list by name). */
  visibleEntities: string[];
  /** Director-invented characters promoted to persisted entities this playthrough (runtime characters). */
  discoveredEntities?: DiscoveredEntity[];
  logEntries: LogEntry[];
  gameplayText: string;
  locationId?: string;
  gameTime: number;
  fullMessageHistory: ChatMessage[];
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
  /** Legacy envelopes used the numeric `2` (≙ v1.2); current saves stamp the `APP_VERSION` string. */
  version: string | number;
}

/** v1.2.0: client-side discover hide preferences (persisted in localStorage). */
export interface HiddenWorldsPrefs {
  worldIds: string[];
  tags: string[];
}
