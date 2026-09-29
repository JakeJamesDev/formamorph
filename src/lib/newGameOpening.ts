import { drawUnseenOpening, openingOwner, openingPool, type PoolEntry, type UnseenDraw } from './openings';
import { customPersonaEntity } from './blueprints';
import { resolvePersona, type PersonaPick, type ResolvedPersona } from './persona';
import type { Entity, GameLocation, WorldOverview } from '@/types';

export interface NewGameOpeningSources {
  pick: PersonaPick;
  /** The authored world's entities. No persona is in state yet when a new game seeds. */
  worldEntities: Entity[];
  overview: WorldOverview | null | undefined;
  /** The authored world's locations; the starting location's own openings join the pool. */
  locations?: readonly GameLocation[];
  startingLocationId: string | null | undefined;
  picked: readonly Entity[];
  random: () => number;
}

/** The rows a new game draws from, with what resolved to build them. The persona resolves first, so the
 *  pool reads its cast. The Test Bench reads this too, so it lists what play draws. */
export function newGamePool(
  sources: Omit<NewGameOpeningSources, 'random'>,
): { persona: ResolvedPersona | null; cast: Entity[]; customPersona: Entity | undefined; pool: PoolEntry[] } {
  const { pick, worldEntities, overview, locations, startingLocationId, picked } = sources;
  const { persona, cast } = resolvePersona(pick.ref, worldEntities, pick.libraryEntity ? [pick.libraryEntity] : []);
  const customPersona = customPersonaEntity(worldEntities);
  const pool = openingPool({ overview, entities: cast, locations, startingLocationId, picked, persona, customPersona });
  return { persona, cast, customPersona, pool };
}

/** The first draw of a new game. Page one renders the persona's name. `owner` is the entity whose row was
 *  drawn, which the Character Name chip names. */
export function drawNewGameOpening(
  sources: NewGameOpeningSources,
): { persona: ResolvedPersona | null; draw: UnseenDraw; owner: Entity | null } {
  const { picked, random } = sources;
  const { persona, cast, customPersona, pool } = newGamePool(sources);
  const draw = drawUnseenOpening(pool, [], random);
  return { persona, draw, owner: openingOwner(draw.ownerId, [...cast, ...picked], persona, customPersona) };
}
