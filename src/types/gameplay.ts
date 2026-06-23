import type { Stat, Trait, Entity } from './world';
import type { ChatMessage } from './ai';

/** A stat during gameplay — same shape as a definition Stat, with a live `value`. */
export type PlayerStat = Stat;

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
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  currentHairStyle: string;
  hairLength: number;
  hairTypes?: Record<string, HairTypeDef>;
}

/** One saved snapshot of a play session (see GameplayContext.saveCurrentGameState). */
export interface GameState {
  playerStats: PlayerStat[];
  playerTraits: Trait[];
  visibleEntities: Entity[];
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
  version: number;
}

/** v1.2.0: client-side discover hide preferences (persisted in localStorage). */
export interface HiddenWorldsPrefs {
  worldIds: string[];
  tags: string[];
}
