// Owned traits during play: which are active, and the order every owner's traits lay their placeholder pins.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Trait } from '@/types';
import { resolveBearers, type BearerWorld } from './bearers';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import type { GateOwner } from './traitGates';
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


/** The characters added from the library at Enter World, among the discovered cast. */
export const addedCharacters = (discovered: readonly DiscoveredEntity[]): Entity[] =>
  discovered.filter((d) => d.sourceTurnId === INITIAL_SOURCE_TURN_ID).map((d) => d.entity);

/** The library entities a playthrough holds, whose nodes sit last in the one tree: the library persona, then
 *  the added characters, with their owned trait requirements bound to the world. */
export const inPlayLibrary = (
  world: TraitWorld, libraryPersona: Entity | null | undefined, added: readonly Entity[] = [],
): Entity[] => [...(libraryPersona ? [libraryPersona] : []), ...added].map((e) => bindOwnedTraits(e, world));

/** Every present bearer as the gate module reads it in play: the player, the world's entities, then the
 *  library's. */
export const inPlayBearers = (world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): readonly GateOwner[] =>
  resolveBearers(world, persona, library).gate.owners;

/**
 * The active traits whose pins lay, in the order play lays them. The cast's owned traits come first, in
 * one-tree order. The player's own traits follow: the world traits and the played entity's owned traits,
 * together in one-tree order. A later pin wins, so the player's picks beat the cast's.
 *
 * `playerTraits` are the player's active world traits as the save holds them; `owned` maps each entity to
 * its active owned trait ids.
 */
export function pinTraitsInOrder(
  world: TraitWorld,
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
