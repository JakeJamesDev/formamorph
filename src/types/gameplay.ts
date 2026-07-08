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

/** One entry in the play log; `repeat` counts consecutive identical entries collapsed into one. */
export interface LogEntry {
  text: string;
  gameTime: number;
  repeat: number;
}

/** Body-silhouette blend weights driving the corresponding VRM morphs. */
export interface BodyShape {
  pear: number;
  apple: number;
  hourglass: number;
}

/** A VRM hair variant: its morph shapekey and whether length is adjustable. */
export interface HairTypeDef {
  shapekey: string;
  canChangeLength: boolean;
}

/** The player character's appearance customization applied to the VRM model. */
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
  /** The live scene list — who is physically present this turn, with alias/reveal state for the tab. Legacy
   *  saves stored a bare `string[]` of names; those are normalized to `{ name, revealed: true }` on load. */
  visibleEntities: SceneEntity[];
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
  /** v2.x: the dictionary set chosen at world entry (reordered/toggled books, plus any added library
   *  dictionaries). Absent on older saves → loaders keep the world's current dictionaries. */
  dictionaries?: Dictionary[];
}

/** v1.2.0: client-side community-browser hide preferences (persisted in localStorage). */
export interface HiddenWorldsPrefs {
  worldIds: string[];
  tags: string[];
}
