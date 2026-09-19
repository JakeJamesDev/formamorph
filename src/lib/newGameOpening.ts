import { drawUnseenOpening, openingPool, type UnseenDraw } from './openings';
import { resolvePersona, type PersonaPick, type ResolvedPersona } from './persona';
import type { Entity, WorldOverview } from '@/types';

export interface NewGameOpeningSources {
  pick: PersonaPick;
  /** The authored world's entities. No persona is in state yet when a new game seeds. */
  worldEntities: Entity[];
  overview: WorldOverview | null | undefined;
  startingLocationId: string | null | undefined;
  picked: readonly Entity[];
  random: () => number;
}

/** The first draw of a new game. The persona resolves first, so the pool reads its cast and page one can
 *  render its name. */
export function drawNewGameOpening(sources: NewGameOpeningSources): { persona: ResolvedPersona | null; draw: UnseenDraw } {
  const { pick, worldEntities, overview, startingLocationId, picked, random } = sources;
  const resolution = resolvePersona(pick.ref, worldEntities, pick.libraryEntity ? [pick.libraryEntity] : []);
  const pool = openingPool({ overview, entities: resolution.cast, startingLocationId, picked });
  return { persona: resolution.persona, draw: drawUnseenOpening(pool, [], random) };
}
