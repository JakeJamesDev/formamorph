import type {
  Connection, DictionaryEntry, Entity, GameLocation, PlayerStat, Trait, TraitGroup,
} from '@/types';
import type { ResolvedPersona } from '../persona';
import type { WorldCalendar } from '../gameClock';

/** The story clock as the Time chip reads it: the hours elapsed since the opening, on the world's calendar. */
export interface ChipSceneTime {
  elapsed: number;
  calendar?: WorldCalendar;
}

/**
 * One moment, as a plain value, that every scene-derived chip takes its value from. Play builds one from
 * the playthrough, the editor from the authored world, the Settings preview from a sample world. Nothing
 * here reads live state: a stat-code box that moves the world before a turn produces a second scene.
 */
export interface ChipScene {
  /** The world's overview text, as the World Description chip sends it. */
  overview: string;
  /** The stats with their current values. */
  stats: PlayerStat[];
  /** The traits in force. An adapter that holds per-trait pins resolves those before it builds the scene. */
  traits: Trait[];
  traitGroups: TraitGroup[];
  persona: ResolvedPersona | null;
  /** Where the scene is, or nowhere: a world with no locations, or a start not yet resolved. */
  location: GameLocation | null;
  locations: GameLocation[];
  connections: Connection[];
  /** The roster every entity scope draws from. */
  entities: Entity[];
  /** Who is at the location: the Here scope, and whom the lower scopes leave out. */
  presentIds: string[];
  /** Who has taken part in the scene: the In Scene scope. */
  inSceneIds: string[];
  /** The lore entries to render, each carrying its position. */
  lore: DictionaryEntry[];
  /** The player's notes; blank when there are none. */
  notes: string;
  /** The story clock, or none while the clock is off or its opening hour is unknown. */
  time: ChipSceneTime | null;
  /** Placeholder resolution, applied to every value before it reaches a prompt. */
  resolve: (text: string) => string;
  /** The roster the Sub-locations and Reachable scopes list; `entities` when absent. Play passes the
   *  authored cast, since a runtime character belongs where it was invented and the outer scopes never
   *  list one. */
  outerScopeEntities?: Entity[];
  /** Participant names that match nobody in the roster. They join the In Scene Name content only. */
  inSceneNames?: string[];
}
