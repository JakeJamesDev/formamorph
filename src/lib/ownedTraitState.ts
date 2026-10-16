// Each entity's owned traits in play, as the save stores them.

import type { GameState, OwnedTraitStates, PersonaRef } from '@/types';
import type { OwnerId } from './scope';

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

/** The key a scope's trait keeps its stat record under. A global trait keeps the bare trait id, as saves
 *  have always held it; an entity's trait keys by `<entity id>/<trait id>`. */
export const recordKey = (ownerId: OwnerId, traitId: string): string =>
  (ownerId === null ? traitId : `${ownerId}/${traitId}`);

/** A record key read back as its owner and the rest; a bare trait id has no owner. */
export const splitRecordKey = (key: string): [owner: string | null, rest: string] => {
  const slash = key.indexOf('/');
  return slash < 0 ? [null, key] : [key.slice(0, slash), key.slice(slash + 1)];
};

const OWN_STATS_SUFFIX = '/stats';
/** The key an entity's trait keeps the record of what it moved on that entity's own stats. */
export const ownStatsRecordKey = (ownerId: string, traitId: string): string => `${ownerId}/${traitId}${OWN_STATS_SUFFIX}`;

/** The trait a record key belongs to, whichever of its owner's two records the key names. */
export const recordKeyTrait = (key: string): [owner: string | null, traitId: string] => {
  const [owner, rest] = splitRecordKey(key);
  return [owner, owner !== null && rest.endsWith(OWN_STATS_SUFFIX) ? rest.slice(0, -OWN_STATS_SUFFIX.length) : rest];
};

/** The state without the owned trait state, cascade-off lists, stat records and stat values of entities it no
 *  longer holds. The global parts stay. */
export function withHeldOwners(state: GameState, held: ReadonlySet<string>): GameState {
  const { cascadeOffTraitIds: cascade, appliedTraitValues: applied } = state;
  if (!state.ownedTraits && !cascade && !applied && !state.entityStats) return state;
  const isHeld = (id: string) => held.has(id);
  /** The saved map with only the held owners, and no owners part once none is left. */
  const heldOnly = <M extends { owners?: Record<string, unknown> }>(map: M | undefined): M | undefined => {
    if (!map?.owners) return map;
    const { owners, ...rest } = map;
    const kept = keep(owners, isHeld);
    const next = kept && Object.keys(kept).length ? { ...rest, owners: kept } : rest;
    // `next` is `map` minus or with a pruned `owners`, so it still fits M.
    return Object.keys(next).length ? next as M : undefined;
  };
  return {
    ...state,
    ownedTraits: keep(state.ownedTraits, isHeld),
    entityStats: keep(state.entityStats, isHeld),
    cascadeOffTraitIds: heldOnly(cascade),
    appliedTraitValues: heldOnly(applied),
  };
}
