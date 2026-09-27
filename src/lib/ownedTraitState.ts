// Each entity's owned traits in play, as the save stores them.

import { WORLD_OWNER } from './traitGates';
import type { GameState, OwnedTraitStates, PersonaRef } from '@/types';

/** The state a new game starts with: each entity's picks chosen, none switched off. */
export const ownedTraitStatesFrom = (picks: Readonly<Record<string, readonly string[]>>): OwnedTraitStates =>
  Object.fromEntries(Object.entries(picks).filter(([, ids]) => ids.length).map(([id, ids]) => [id, { chosen: [...ids] }]));

/** The entities a loaded playthrough holds: the world's, the discovered cast, and a library persona. */
export function heldEntityIds(worldEntityIds: Iterable<string>, state: GameState, persona: PersonaRef | undefined): Set<string> {
  const held = new Set(worldEntityIds);
  for (const d of state.discoveredEntities ?? []) held.add(d.entity.id);
  if (persona?.source === 'library') held.add(persona.entityId);
  return held;
}

const keep = <T>(map: Readonly<Record<string, T>> | undefined, held: (id: string) => boolean) =>
  map && Object.fromEntries(Object.entries(map).filter(([id]) => held(id)));

/** The key a bearer's trait keeps its stat record under. The player's world traits keep the bare trait id,
 *  as saves have always held it; a played persona's linked trait keys by `<entity id>/<trait id>`. */
export const recordKey = (ownerId: string, traitId: string): string =>
  (ownerId === WORLD_OWNER ? traitId : `${ownerId}/${traitId}`);

/** The bearer a stat record belongs to, read back from its key. */
const recordOwner = (key: string): string => (key.includes('/') ? key.slice(0, key.indexOf('/')) : WORLD_OWNER);

/** The state without the owned trait state, cascade-off lists and stat records of entities it no longer
 *  holds. */
export function withHeldOwners(state: GameState, held: ReadonlySet<string>): GameState {
  if (!state.ownedTraits && !state.cascadeOffTraitIds && !state.appliedTraitValues) return state;
  const isHeld = (id: string) => id === WORLD_OWNER || held.has(id);
  return {
    ...state,
    ownedTraits: keep(state.ownedTraits, (id) => held.has(id)),
    cascadeOffTraitIds: keep(state.cascadeOffTraitIds, isHeld),
    appliedTraitValues: keep(state.appliedTraitValues, (key) => isHeld(recordOwner(key))),
  };
}
