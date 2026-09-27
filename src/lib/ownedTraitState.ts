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

/** The state without the owned trait state and cascade-off lists of entities it no longer holds. */
export function withHeldOwners(state: GameState, held: ReadonlySet<string>): GameState {
  if (!state.ownedTraits && !state.cascadeOffTraitIds) return state;
  return {
    ...state,
    ownedTraits: keep(state.ownedTraits, (id) => held.has(id)),
    cascadeOffTraitIds: keep(state.cascadeOffTraitIds, (id) => id === WORLD_OWNER || held.has(id)),
  };
}
