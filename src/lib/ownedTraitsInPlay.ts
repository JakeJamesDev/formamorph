// Owned traits during play: which are active, and the order every owner's traits lay their placeholder pins.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Trait, TraitGroup } from '@/types';
import { traitOwners } from './ownedTraits';
import { libraryOwnersInPlay } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { WORLD_OWNER, type GateOwner } from './traitGates';
import { ownedTraitTree } from './traitTree';

/** The entity whose owned traits are the player's own: the played persona's, or null. */
export const playedEntityId = (ref: PersonaRef | undefined): string | null =>
  (ref && ref.source !== 'none' ? ref.entityId : null);

/** Entity id → its active owned trait ids: the chosen ones less those switched off. */
export function activeOwnedTraitIds(states: Readonly<OwnedTraitStates>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(states).map(([id, s]) => {
    const off = new Set(s.disabled ?? []);
    return [id, s.chosen.filter((t) => !off.has(t))];
  }));
}

type TraitWorldLists = { traits: readonly Trait[]; traitGroups: readonly TraitGroup[]; entities: readonly Entity[] };

/** The characters added from the library at Enter World, among the discovered cast. */
export const addedCharacters = (discovered: readonly DiscoveredEntity[]): Entity[] =>
  discovered.filter((d) => d.sourceTurnId === INITIAL_SOURCE_TURN_ID).map((d) => d.entity);

/** The library entities a playthrough holds, whose nodes sit last in the one tree: the library persona, then
 *  the added characters, with their owned trait requirements bound to the world. */
export const inPlayLibrary = (
  world: TraitWorldLists, libraryPersona: Entity | null | undefined, added: readonly Entity[] = [],
): Entity[] => libraryOwnersInPlay(world, libraryPersona, added);

/** Every entity that owns traits, as the gate module reads it: the world's, then the library's. */
export const entityTraitOwners = (world: TraitWorldLists, library: readonly Entity[] = []): GateOwner[] =>
  traitOwners(world, library).filter((owner) => owner.id !== WORLD_OWNER);

/**
 * The active traits whose pins lay, in the order play lays them. The cast's owned traits come first, in
 * one-tree order. The player's own traits follow: the world traits and the played entity's owned traits,
 * together in one-tree order. A later pin wins, so the player's picks beat the cast's.
 *
 * `playerTraits` are the player's active world traits as the save holds them; `owned` maps each entity to
 * its active owned trait ids.
 */
export function pinTraitsInOrder(
  world: TraitWorldLists,
  playerTraits: readonly Trait[],
  owned: Readonly<Record<string, readonly string[]>>,
  playedEntityId: string | null,
  library: readonly Entity[] = [],
): Trait[] {
  const tree = ownedTraitTree(world, world.entities, library);
  const order = traitOrderIndex(tree.traits, tree.groups);
  const cast: Trait[] = [];
  const played: Trait[] = [];
  for (const [entityId, entity] of tree.entityNodes) {
    const active = new Set(owned[entityId] ?? []);
    const traits = (entity.traits ?? []).filter((t) => active.has(t.id));
    (entityId === playedEntityId ? played : cast).push(...traits);
  }
  return [...inAuthoredOrder(cast, order), ...inAuthoredOrder([...playerTraits, ...played], order)];
}
